import * as THREE from 'three';
import { World } from './world/World';
import { Player } from './Player';
import { AnimalManager } from './mobs/AnimalManager';
import { Animal } from './mobs/Animal';
import { ParticleSystem } from './particles/ParticleSystem';
import { BreakEffect } from './particles/BreakEffect';
import { AtmosphereManager } from './world/AtmosphereManager';
import { FirstPersonHand } from './world/FirstPersonHand';
import { generateTextureAtlas, TextureAtlasSet } from './TextureGenerator';
import { BLOCKS, BLOCK_DEFS, ITEMS, ITEM_DEFS } from './blocks';
import { sounds } from './sound/SoundManager';
import { useGameStore, GraphicsQuality } from '../store/gameStore';
import { MultiplayerManager } from './multiplayer/MultiplayerManager';
import { SavedWorld, WorldStorage } from './storage/WorldStorage';

export class VoxelEngine {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  world: World;
  player: Player;
  animals: AnimalManager;
  particles: ParticleSystem;
  breakEffect: BreakEffect;
  atmosphere: AtmosphereManager;
  hand: FirstPersonHand;
  multiplayer: MultiplayerManager;

  waterMaterial: THREE.MeshStandardMaterial;
  opaqueMaterial: THREE.MeshStandardMaterial;
  textures: TextureAtlasSet;

  keys: Record<string, boolean> = {};
  lastTime = 0;
  reqFrame = 0;

  // Mouse & Camera smoothing target
  targetYaw = 0;
  targetPitch = 0;

  // Block interaction & targeting
  previewBox: THREE.Mesh;
  breakProgress = 0;
  targetHardness = 1.0;
  isBreaking = false;
  targetBlock: { x: number; y: number; z: number; normal: THREE.Vector3 } | null = null;
  targetMob: Animal | null = null;

  // Performance telemetry
  fps = 60;
  avgFps = 60;
  frameTime = 16.6;
  private frameCount = 0;
  private fpsTimer = 0;
  private fpsHistory: number[] = [];
  private autoSaveTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Atmosphere & Day/Night Celestial Manager
    this.atmosphere = new AtmosphereManager(this.scene, this.renderer);

    // Textures & PBR Materials (HD 64x64 tiles, 1024x1024 Atlas)
    this.textures = generateTextureAtlas();

    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.opaqueTexture,
      normalMap: this.textures.normalTexture,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: this.textures.roughnessTexture,
      roughness: 0.96,
      metalness: 0.0,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    // Real Life Sculpting & Wind Shader Uniforms
    const windUniform = { value: 0 };
    const realLifeModeUniform = { value: 0 };
    this.opaqueMaterial.userData.uTime = windUniform;
    this.opaqueMaterial.userData.uRealLifeMode = realLifeModeUniform;

    this.opaqueMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform;
      shader.uniforms.uRealLifeMode = realLifeModeUniform;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uRealLifeMode;
        attribute float aWind;
        attribute float aBlockType;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>

        if (uRealLifeMode > 0.001) {
          vec3 worldP = (modelMatrix * vec4(position, 1.0)).xyz;
          vec3 disp = vec3(0.0);
          vec3 smoothNormal = normal;

          if (aBlockType < 0.5) {
            // --- 0. GRASS & SNOW TURF -> Rolling undulating earth mounds, rounded turf crowns ---
            float earthMound = sin(worldP.x * 0.45 + worldP.z * 0.40) * 0.08 + cos(worldP.x * 0.90 - worldP.z * 0.85) * 0.04;
            disp.y += earthMound;

            // Soft rounded edge beveling
            vec3 cellFrac = fract(worldP) - 0.5;
            float edgeDist = max(max(abs(cellFrac.x), abs(cellFrac.y)), abs(cellFrac.z));
            float edgeBevel = smoothstep(0.38, 0.5, edgeDist) * -0.055;
            disp += normal * edgeBevel;

            vec3 gradNorm = normalize(vec3(
              -cos(worldP.x * 0.45 + worldP.z * 0.40) * 0.12 - sin(worldP.x * 0.90) * 0.06,
              1.0,
              -cos(worldP.x * 0.45 + worldP.z * 0.40) * 0.10 + sin(worldP.z * 0.85) * 0.06
            ));
            smoothNormal = normalize(mix(normal, gradNorm, 0.65));

          } else if (aBlockType < 1.5) {
            // --- 1. DIRT / EARTH -> Earthy soil clods and natural slope curves ---
            float dirtWave = sin(worldP.x * 1.8 + worldP.y * 1.5 + worldP.z * 1.7) * 0.045
                           + cos(worldP.x * 3.5 - worldP.z * 3.2) * 0.025;
            disp += normal * dirtWave;
            vec3 dirtPerturb = vec3(
              sin(worldP.y * 3.0 + worldP.z * 3.0) * 0.2,
              cos(worldP.x * 3.0 + worldP.z * 3.0) * 0.2,
              sin(worldP.x * 3.0 + worldP.y * 3.0) * 0.2
            );
            smoothNormal = normalize(normal + dirtPerturb * 0.45);

          } else if (aBlockType < 2.5) {
            // --- 2. STONE, COBBLESTONE, BEDROCK -> Weathered rock facets, boulder bevels, organic stone chiseled surface ---
            float rock1 = sin(worldP.x * 0.85 + worldP.y * 0.70 + worldP.z * 0.90) * 0.075;
            float rock2 = cos(worldP.x * 1.90 - worldP.y * 1.60 + worldP.z * 1.75) * 0.040;
            float rock3 = sin(worldP.x * 4.20 + worldP.y * 4.00 + worldP.z * 4.10) * 0.018;
            disp += normal * (rock1 + rock2 + rock3);

            vec3 rockCell = fract(worldP) - 0.5;
            disp -= normalize(rockCell + vec3(0.0001)) * (length(rockCell) * 0.065);

            vec3 rockNormOffset = vec3(
              cos(worldP.x * 1.5 + worldP.y * 1.2) * 0.35 + sin(worldP.z * 2.8) * 0.15,
              sin(worldP.y * 1.5 + worldP.z * 1.2) * 0.25,
              cos(worldP.z * 1.5 + worldP.x * 1.2) * 0.35 + sin(worldP.y * 2.8) * 0.15
            );
            smoothNormal = normalize(normal + rockNormOffset * 0.55);

          } else if (aBlockType < 3.5) {
            // --- 3. SAND -> Smooth continuous rolling dunes and wind-swept micro-ripples ---
            float dune = sin(worldP.x * 0.50 + worldP.z * 0.65) * 0.070
                       + sin(worldP.x * 2.80 + worldP.z * 3.10) * 0.015;
            disp.y += dune;
            vec3 duneNorm = normalize(vec3(
              -cos(worldP.x * 0.50 + worldP.z * 0.65) * 0.16,
              1.0,
              -cos(worldP.x * 0.50 + worldP.z * 0.65) * 0.18
            ));
            smoothNormal = normalize(mix(normal, duneNorm, 0.70));

          } else if (aBlockType < 4.5) {
            // --- 4. TREE TRUNK (Oak Log) -> Cylindrical organic trunk with natural bark ridges ---
            vec2 centerOffset = fract(worldP.xz) - 0.5;
            float distToCenter = length(centerOffset);
            if (distToCenter > 0.001) {
              vec2 targetCircle = normalize(centerOffset) * 0.44;
              disp.xz = (targetCircle - centerOffset) * 0.88;
            }
            disp.x += sin(worldP.y * 2.8 + worldP.z * 4.0) * 0.025;
            disp.z += cos(worldP.y * 3.2 + worldP.x * 3.8) * 0.025;
            
            vec2 radNorm = normalize(fract(worldP.xz) - 0.5);
            smoothNormal = normalize(vec3(radNorm.x, normal.y * 0.15, radNorm.y));

          } else if (aBlockType < 5.5) {
            // --- 5. TREE LEAVES CANOPY -> Spherical lush foliage clusters with canopy volume ---
            vec3 leafCenterOffset = fract(worldP + 0.001) - 0.5;
            disp += normalize(leafCenterOffset + vec3(0.001)) * 0.18;
            disp.y += sin(worldP.x * 2.2 + worldP.z * 2.2) * 0.09;
            
            float foliageNoise = sin(worldP.x * 6.5 + worldP.y * 6.5 + worldP.z * 6.5) * 0.045;
            disp += foliageNoise;
            
            smoothNormal = normalize(normal + (fract(worldP + 0.001) - 0.5) * 2.2);

          } else if (aBlockType < 6.5) {
            // --- 6. ARCHITECTURAL BLOCKS (Planks, Bricks, Crafting Table, Glass) -> Chamfered bevels ---
            vec3 bFrac = fract(worldP) - 0.5;
            float bDist = max(max(abs(bFrac.x), abs(bFrac.y)), abs(bFrac.z));
            float chamfer = smoothstep(0.40, 0.5, bDist) * -0.04;
            disp += normal * chamfer;
            smoothNormal = normal;

          } else if (aBlockType < 7.5) {
            // --- 7. ORES & MINERALS -> Natural rock matrix with protruding crystalline gem facets ---
            float rockBase = sin(worldP.x * 1.2 + worldP.y * 1.1 + worldP.z * 1.2) * 0.05;
            disp += normal * rockBase;
            float gemProtrude = max(0.0, sin(worldP.x * 8.0 + worldP.y * 8.0) * sin(worldP.y * 8.0 + worldP.z * 8.0)) * 0.065;
            disp += normal * gemProtrude;
            smoothNormal = normalize(normal + vec3(sin(worldP.x * 8.0), cos(worldP.y * 8.0), sin(worldP.z * 8.0)) * 0.35);

          } else if (aBlockType < 8.5) {
            // --- 8. CACTUS -> Fluted cylindrical succulent columns ---
            vec2 cOffset = fract(worldP.xz) - 0.5;
            float cAngle = atan(cOffset.y, cOffset.x);
            float fluting = 0.43 + sin(cAngle * 12.0) * 0.035;
            vec2 targetCactus = normalize(cOffset) * fluting;
            disp.xz = (targetCactus - cOffset) * 0.85;
            smoothNormal = normalize(vec3(cos(cAngle), normal.y * 0.2, sin(cAngle)));

          } else {
            // --- 9. FOLIAGE / FLOWERS / TALL GRASS -> Organic wind sway & curved stems ---
            float grassSway = sin(uTime * 3.0 + worldP.x * 1.6 + worldP.z * 1.6) * 0.14;
            disp.x += grassSway * max(0.0, transformed.y - floor(transformed.y));
            smoothNormal = normalize(normal + vec3(grassSway * 0.5, 0.2, 0.0));
          }

          transformed += disp * uRealLifeMode;
          vNormal = normalize(mix(normalMatrix * normal, normalMatrix * smoothNormal, uRealLifeMode * 0.88));
        }

        if (aWind > 0.0) {
          float wave = sin(uTime * 2.0 + position.x * 0.85 + position.z * 0.85) * 0.075
                     + cos(uTime * 3.2 + position.x * 1.40 - position.z * 1.15) * 0.035;
          transformed.x += wave * aWind;
          transformed.z += (wave * 0.75) * aWind;
        }
        `
      );
    };

    // Realistic Screen-Space & Wave Reflective Water Material
    this.waterMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.waterTexture,
      normalMap: this.textures.waterNormalTexture,
      normalScale: new THREE.Vector2(0.4, 0.4),
      color: 0x3388ff,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.waterMaterial.userData.uTime = windUniform;
    this.waterMaterial.userData.uRealLifeMode = realLifeModeUniform;

    this.waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform;
      shader.uniforms.uRealLifeMode = realLifeModeUniform;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uRealLifeMode;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        if (uRealLifeMode > 0.001) {
          vec3 worldP = (modelMatrix * vec4(position, 1.0)).xyz;
          float w1 = sin(uTime * 2.4 + worldP.x * 0.70 + worldP.z * 0.75) * 0.085;
          float w2 = cos(uTime * 3.6 + worldP.x * 1.30 - worldP.z * 1.20) * 0.040;
          float w3 = sin(uTime * 5.0 + worldP.x * 2.50 + worldP.z * 2.20) * 0.020;
          transformed.y += (w1 + w2 + w3) * uRealLifeMode;
          
          vec3 smoothWaterNorm = normalize(vec3(
            -(cos(uTime * 2.4 + worldP.x * 0.70) * 0.08 + sin(uTime * 3.6 + worldP.x * 1.30) * 0.05),
            1.0,
            -(cos(uTime * 2.4 + worldP.z * 0.75) * 0.08 - sin(uTime * 3.6 + worldP.z * 1.20) * 0.05)
          ));
          vNormal = normalize(mix(normalMatrix * normal, normalMatrix * smoothWaterNorm, uRealLifeMode * 0.90));
        }
        `
      );
    };

    // Initialize systems
    this.world = new World(this.scene, this.opaqueMaterial, this.waterMaterial);
    this.player = new Player(this.camera, this.world);
    this.hand = new FirstPersonHand(this.camera);
    this.particles = new ParticleSystem(this.scene);
    this.world.setParticleSystem(this.particles);
    this.breakEffect = new BreakEffect(this.scene);
    this.multiplayer = new MultiplayerManager(this.scene, this.world, this.particles);

    this.animals = new AnimalManager(this.scene, this.world, (dropItem, count, pos) => {
      const state = useGameStore.getState();
      state.addToInventory(dropItem, count);
      sounds.playClick();
      this.particles.spawnBlockBreak(pos, 0xffffff);
    });

    // Initial spawn area generation immediately so world is ready
    this.world.initSpawnArea(8, 8, 3);
    this.player.spawnAtSafeLocation();
    this.targetYaw = this.player.yaw;
    this.targetPitch = this.player.pitch;

    // Block selection wireframe box
    const boxGeo = new THREE.BoxGeometry(1.006, 1.006, 1.006);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    this.previewBox = new THREE.Mesh(boxGeo, boxMat);
    this.previewBox.visible = false;
    this.scene.add(this.previewBox);

    this.setupEvents();
    this.applyQuality(useGameStore.getState().graphicsQuality);
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.renderer.domElement;
      const state = useGameStore.getState();
      if (!isLocked) {
        if (!state.isMobileControls && !state.isInventoryOpen && !state.isCraftingTableOpen && !state.isFurnaceOpen && state.hasStarted && !state.isDead && !state.isSleeping) {
          state.setPaused(true);
        }
      } else {
        if (state.isPaused) {
          state.setPaused(false);
        }
      }
    });

    window.addEventListener('blur', () => {
      this.keys = {};
    });

    document.addEventListener('keydown', (e) => {
      // Don't capture inputs when user is typing in chat/input boxes
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      this.keys[key] = true;
      if (e.code) {
        this.keys[e.code.toLowerCase()] = true;
      }

      // Fn+4 / F4 / Alt+4 / Ctrl+4 Viewer Mode & WASD flight toggle
      if (e.key === 'F4' || e.code === 'F4' || ((e.key === '4' || e.code === 'Digit4') && (e.altKey || e.ctrlKey || e.metaKey || (e as any).fnKey))) {
        e.preventDefault();
        const state = useGameStore.getState();
        state.toggleViewerMode();
        this.player.isFlying = !state.isViewerMode;
      }
      if (key === 'v' || key === 'n' || e.code === 'KeyV' || e.code === 'KeyN') {
        const state = useGameStore.getState();
        state.toggleNoclip();
      }
      if (key === 'f' || e.code === 'KeyF') {
        const state = useGameStore.getState();
        this.player.isFlying = !this.player.isFlying;
      }
      if (key === 'e' || e.code === 'KeyE') {
        const state = useGameStore.getState();
        if (!state.isDead && !state.isSleeping) {
          if (!state.hasStarted) {
            state.setHasStarted(true);
          }
          if (state.isInventoryOpen || state.isCraftingTableOpen) {
            state.toggleInventory();
            if (state.isCraftingTableOpen) state.setCraftingTableOpen(false);
            this.renderer.domElement.requestPointerLock();
          } else {
            state.setPaused(false);
            state.toggleInventory();
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
          }
        }
      }
      if (e.key === 'Escape' || e.code === 'Escape') {
        const state = useGameStore.getState();
        if (state.isInventoryOpen || state.isCraftingTableOpen) {
          state.toggleInventory();
          if (state.isCraftingTableOpen) state.setCraftingTableOpen(false);
          this.renderer.domElement.requestPointerLock();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      if (e.code) {
        this.keys[e.code.toLowerCase()] = false;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.renderer.domElement) {
        const sens = 0.0022;
        this.targetYaw -= e.movementX * sens;
        this.targetPitch -= e.movementY * sens;
        this.targetPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.targetPitch));
      }
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      const state = useGameStore.getState();
      if (state.isInventoryOpen || state.isCraftingTableOpen || state.isPaused || state.isDead || state.isSleeping || !state.hasStarted) {
        return;
      }
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock();
      } else {
        if (e.button === 0) {
          this.handleLeftClick();
        } else if (e.button === 2) {
          this.handleRightClick();
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isBreaking = false;
        this.breakProgress = 0;
        this.breakEffect.hide();
      }
    });
  }

  private getItemColor(id: number): string {
    if (id in ITEM_DEFS) return ITEM_DEFS[id].iconColor;
    switch (id) {
      case BLOCKS.GRASS: return '#5b8c34';
      case BLOCKS.DIRT: return '#79553a';
      case BLOCKS.STONE: return '#757575';
      case BLOCKS.COBBLESTONE: return '#5e5e5e';
      case BLOCKS.SAND: return '#d9cb94';
      case BLOCKS.WATER: return '#2b62d9';
      case BLOCKS.OAK_LOG: return '#533b21';
      case BLOCKS.OAK_LEAVES: return '#3a7d28';
      case BLOCKS.OAK_PLANKS: return '#ad8553';
      case BLOCKS.CRAFTING_TABLE: return '#9c7444';
      case BLOCKS.GLASS: return '#d7f2ff';
      case BLOCKS.BRICKS: return '#9e4a36';
      case BLOCKS.BEDROCK: return '#212121';
      case BLOCKS.COAL_ORE: return '#222222';
      case BLOCKS.IRON_ORE: return '#d1b292';
      case BLOCKS.GOLD_ORE: return '#f7c828';
      case BLOCKS.DIAMOND_ORE: return '#35e8db';
      case BLOCKS.EMERALD_ORE: return '#18c955';
      case BLOCKS.LAPIS_ORE: return '#1a4fc7';
      case BLOCKS.REDSTONE_ORE: return '#d91818';
      case BLOCKS.WHITE_WOOL: return '#edebe6';
      case BLOCKS.BED: return '#bd2020';
      case BLOCKS.SNOW_GRASS: return '#f2f7fa';
      case BLOCKS.CACTUS: return '#1b6b1b';
      case BLOCKS.RED_FLOWER: return '#db2121';
      case BLOCKS.YELLOW_FLOWER: return '#edc01a';
      case BLOCKS.TORCH: return '#ff7b00';
      default: return '#888888';
    }
  }

  handleLeftClick() {
    const state = useGameStore.getState();

    // Trigger arm swing
    this.hand.triggerSwing();

    // Check if clicking on mob
    if (this.targetMob) {
      const knockback = new THREE.Vector3().subVectors(this.targetMob.position, this.player.position).normalize();
      this.animals.hitAnimal(this.targetMob, 2, knockback);
      sounds.playPlayerHurt();
      this.particles.spawnBlockBreak(this.targetMob.position, 0xff2222);
      return;
    }

    if (!this.targetBlock) return;

    if (state.gameMode === 'creative') {
      // Instant break in creative mode
      this.breakTargetBlock();
    } else {
      // Begin survival breaking
      this.isBreaking = true;
      this.breakProgress = 0;
      const { x, y, z } = this.targetBlock;
      const blockId = this.world.getBlockAt(x, y, z);
      const def = BLOCK_DEFS[blockId];
      this.targetHardness = def?.hardness || 1.0;
    }
  }

  breakTargetBlock() {
    if (!this.targetBlock) return;
    const { x, y, z } = this.targetBlock;
    const blockId = this.world.getBlockAt(x, y, z);

    if (blockId === BLOCKS.AIR || blockId === BLOCKS.BEDROCK) {
      this.isBreaking = false;
      this.breakEffect.hide();
      return;
    }

    const state = useGameStore.getState();
    const def = BLOCK_DEFS[blockId];

    // Play block break sound & spawn rich debris particles
    sounds.playBlockBreak();
    this.particles.spawnBlockBreak(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0x777777);

    // Give drop in survival mode
    if (state.gameMode === 'survival') {
      let dropId = def?.dropItem || blockId;

      if (blockId === BLOCKS.STONE) dropId = BLOCKS.COBBLESTONE;
      if (blockId === BLOCKS.COAL_ORE) dropId = ITEMS.COAL_ITEM;
      if (blockId === BLOCKS.IRON_ORE) dropId = ITEMS.IRON_NUGGET;
      if (blockId === BLOCKS.GOLD_ORE) dropId = ITEMS.GOLD_NUGGET;
      if (blockId === BLOCKS.DIAMOND_ORE) dropId = ITEMS.DIAMOND_ITEM;
      if (blockId === BLOCKS.EMERALD_ORE) dropId = ITEMS.EMERALD_ITEM;
      if (blockId === BLOCKS.LAPIS_ORE) dropId = ITEMS.LAPIS_ITEM;
      if (blockId === BLOCKS.REDSTONE_ORE) dropId = ITEMS.REDSTONE_ITEM;

      const dropCount = def?.dropCount || 1;
      state.addToInventory(dropId, dropCount);
    }

    // Remove block from world
    this.world.setBlockAt(x, y, z, BLOCKS.AIR);
    this.multiplayer.broadcastBlockChange(x, y, z, BLOCKS.AIR);
    this.isBreaking = false;
    this.breakProgress = 0;
    this.breakEffect.hide();
  }

  handleRightClick() {
    const state = useGameStore.getState();
    const held = state.hotbar[state.activeHotbarSlot];

    // Trigger arm swing
    this.hand.triggerSwing();

    // 1. Consume food if held
    if (held && held.id in ITEM_DEFS && ITEM_DEFS[held.id].isFood) {
      const food = ITEM_DEFS[held.id];
      if (state.hunger < 20 || state.health < 20) {
        sounds.playEat();
        state.setHunger((h) => Math.min(20, h + (food.foodRestore || 3)));
        state.setHealth((hp) => Math.min(20, hp + (food.healthRestore || 1)));
        state.removeFromHotbar(state.activeHotbarSlot, 1);
        return;
      }
    }

    if (!this.targetBlock) return;
    const { x, y, z, normal } = this.targetBlock;
    const clickedBlockId = this.world.getBlockAt(x, y, z);

    // 2. Open Crafting Table or Furnace if clicked
    if (clickedBlockId === BLOCKS.CRAFTING_TABLE) {
      state.setCraftingTableOpen(true);
      return;
    }
    if (clickedBlockId === BLOCKS.FURNACE) {
      state.setFurnaceOpen(true);
      return;
    }

    // 3. Sleep in Bed if clicked
    if (clickedBlockId === BLOCKS.BED) {
      // If evening or night, advance to bright morning
      if (this.atmosphere.timeOfDay >= 0.70 || this.atmosphere.timeOfDay < 0.05) {
        this.atmosphere.skipNightToMorning();
        state.setTimeOfDay(0.08);
        sounds.playClick();
      }
      return;
    }

    // 4. Place block
    if (!held || !(held.id in BLOCK_DEFS)) return;

    const placeX = x + normal.x;
    const placeY = y + normal.y;
    const placeZ = z + normal.z;

    // Check player collision bounds when placing solid blocks
    const minX = Math.floor(this.player.position.x - 0.3);
    const maxX = Math.floor(this.player.position.x + 0.3);
    const minY = Math.floor(this.player.position.y);
    const maxY = Math.floor(this.player.position.y + 1.75);
    const minZ = Math.floor(this.player.position.z - 0.3);
    const maxZ = Math.floor(this.player.position.z + 0.3);

    const isInsidePlayer =
      placeX >= minX && placeX <= maxX &&
      placeY >= minY && placeY <= maxY &&
      placeZ >= minZ && placeZ <= maxZ;

    if (isInsidePlayer && BLOCK_DEFS[held.id]?.isSolid !== false) {
      return;
    }

    sounds.playBlockPlace();
    this.world.setBlockAt(placeX, placeY, placeZ, held.id);
    this.multiplayer.broadcastBlockChange(placeX, placeY, placeZ, held.id);

    if (state.gameMode === 'survival') {
      state.removeFromHotbar(state.activeHotbarSlot, 1);
    }
  }

  raycast(): { x: number; y: number; z: number; normal: THREE.Vector3 } | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const maxDistance = 6.0;

    // Check animal/mob raycast first
    this.targetMob = null;
    for (const animal of this.animals.animals) {
      const mobBox = new THREE.Box3().setFromObject(animal.group);
      const hit = raycaster.ray.intersectBox(mobBox, new THREE.Vector3());
      if (hit && hit.distanceTo(this.camera.position) <= maxDistance) {
        this.targetMob = animal;
        return null;
      }
    }

    // Voxel DDA (Digital Differential Analyzer) Raymarching
    const origin = this.camera.position;
    const dir = raycaster.ray.direction;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = dir.x > 0 ? (Math.floor(origin.x + 1) - origin.x) * tDeltaX : (origin.x - Math.floor(origin.x)) * tDeltaX;
    let tMaxY = dir.y > 0 ? (Math.floor(origin.y + 1) - origin.y) * tDeltaY : (origin.y - Math.floor(origin.y)) * tDeltaY;
    let tMaxZ = dir.z > 0 ? (Math.floor(origin.z + 1) - origin.z) * tDeltaZ : (origin.z - Math.floor(origin.z)) * tDeltaZ;

    let normal = new THREE.Vector3();
    let distance = 0;

    while (distance < maxDistance) {
      const blockId = this.world.getBlockAt(x, y, z);
      if (blockId !== BLOCKS.AIR && blockId !== BLOCKS.WATER) {
        return { x, y, z, normal };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          distance = tMaxX;
          tMaxX += tDeltaX;
          normal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          distance = tMaxY;
          tMaxY += tDeltaY;
          normal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal.set(0, 0, -stepZ);
        }
      }
    }

    return null;
  }

  applyQuality(quality: GraphicsQuality) {
    this.atmosphere.setQuality(quality);

    if (this.multiplayer && this.multiplayer.isHost) {
      this.multiplayer.broadcastHostSettings({ graphicsQuality: quality });
    }

    const isRealLife = quality === 'Real Life Resolution';
    if (this.opaqueMaterial.userData.uRealLifeMode) {
      this.opaqueMaterial.userData.uRealLifeMode.value = isRealLife ? 1.0 : 0.0;
    }
    if (this.waterMaterial.userData.uRealLifeMode) {
      this.waterMaterial.userData.uRealLifeMode.value = isRealLife ? 1.0 : 0.0;
    }

    if (quality === 'Very Low') {
      // Crisp resolution, no shadows, no normal maps, flat unshaded
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.renderer.toneMapping = THREE.LinearToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      this.opaqueMaterial.normalMap = null;
      this.opaqueMaterial.roughnessMap = null;
      this.opaqueMaterial.roughness = 1.0;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = null;
      this.waterMaterial.roughness = 0.4;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Low') {
      // Crisp resolution, simple diffuse lighting, no shadows
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
      this.renderer.toneMapping = THREE.LinearToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      this.opaqueMaterial.normalMap = null;
      this.opaqueMaterial.roughnessMap = null;
      this.opaqueMaterial.roughness = 0.9;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = null;
      this.waterMaterial.roughness = 0.25;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Medium') {
      // PCF 1024 Soft Shadows, Roughness maps, basic clouds
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      this.opaqueMaterial.normalMap = null;
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.85;
      this.opaqueMaterial.metalness = 0.02;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.2, 0.2);
      this.waterMaterial.roughness = 0.15;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'High') {
      // Default High Quality: 2048 PCF Soft Shadows, Normal & Roughness PBR, Volumetric Clouds
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;

      this.opaqueMaterial.normalMap = this.textures.normalTexture;
      this.opaqueMaterial.normalScale.set(0.35, 0.35);
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.95;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.4, 0.4);
      this.waterMaterial.roughness = 0.08;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Very High') {
      // 3072 PCF Soft Shadows, High Micro-detail, Volumetric God Rays
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;

      this.opaqueMaterial.normalMap = this.textures.normalTexture;
      this.opaqueMaterial.normalScale.set(0.35, 0.35);
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.95;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.5, 0.5);
      this.waterMaterial.roughness = 0.05;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Ultra') {
      // 4096 PCF Soft Shadows, Micro-bump maps, Bloom Glow
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;

      this.opaqueMaterial.normalMap = this.textures.normalTexture;
      this.opaqueMaterial.normalScale.set(0.35, 0.35);
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.95;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.6, 0.6);
      this.waterMaterial.roughness = 0.03;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Cinematic') {
      // Ultra AAA Preset: 4096 Ultra Shadows, Maximum Raymarched Clouds, Sun Bloom, Deep Reflections
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;

      this.opaqueMaterial.normalMap = this.textures.normalTexture;
      this.opaqueMaterial.normalScale.set(0.35, 0.35);
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.95;
      this.opaqueMaterial.metalness = 0.0;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.7, 0.7);
      this.waterMaterial.roughness = 0.02;
      this.waterMaterial.needsUpdate = true;
    } else if (quality === 'Real Life Resolution') {
      // Real Life Resolution Preset: RTX 5090 Tier, 8192 Shadows, 2048x2048 Textures, High-Intensity Lights, Max PBR Shaders
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;

      this.opaqueMaterial.normalMap = this.textures.normalTexture;
      this.opaqueMaterial.normalScale.set(0.55, 0.55);
      this.opaqueMaterial.roughnessMap = this.textures.roughnessTexture;
      this.opaqueMaterial.roughness = 0.92;
      this.opaqueMaterial.metalness = 0.02;
      this.opaqueMaterial.needsUpdate = true;

      this.waterMaterial.normalMap = this.textures.waterNormalTexture;
      this.waterMaterial.normalScale.set(0.85, 0.85);
      this.waterMaterial.roughness = 0.01;
      this.waterMaterial.needsUpdate = true;
    }
  }

  start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.reqFrame);
    this.multiplayer.cleanup();
  }

  async hostMultiplayer(pin?: string): Promise<string> {
    const generatedPin = await this.multiplayer.hostRoom(pin);
    this.world.reseed(`room_${generatedPin}`, this.player.position.x, this.player.position.z);
    this.player.spawnAtSafeLocation();
    return generatedPin;
  }

  async joinMultiplayer(pin: string): Promise<boolean> {
    const success = await this.multiplayer.joinRoom(pin);
    if (success) {
      this.world.reseed(`room_${pin}`, this.player.position.x, this.player.position.z);
      this.player.spawnAtSafeLocation();
    }
    return success;
  }

  loop = (time: number) => {
    this.reqFrame = requestAnimationFrame(this.loop);

    const state = useGameStore.getState();
    const rawDt = (time - this.lastTime) / 1000;
    const dt = Math.min(rawDt, 0.1);
    this.lastTime = time;

    // Update wind and wave shader time
    const tVal = time * 0.001;
    if (this.opaqueMaterial.userData.uTime) {
      this.opaqueMaterial.userData.uTime.value = tVal;
    }
    if (this.waterMaterial.userData.uTime) {
      this.waterMaterial.userData.uTime.value = tVal;
    }

    // FPS Limiter
    if (state.fpsLimit > 0 && rawDt < 1 / state.fpsLimit) {
      return;
    }

    // Telemetry
    this.frameTime = rawDt * 1000;
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > 20) this.fpsHistory.shift();
      this.avgFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Camera smoothing interpolation based on graphics quality
    const q = state.graphicsQuality;
    const smoothRate = q === 'Very Low' ? 1.0 : (q === 'Low' ? 32 : (q === 'Medium' ? 24 : (q === 'High' ? 18 : (q === 'Very High' ? 14 : (q === 'Ultra' ? 10 : 8)))));
    
    if (q === 'Very Low') {
      this.player.yaw = this.targetYaw;
      this.player.pitch = this.targetPitch;
    } else {
      this.player.yaw += (this.targetYaw - this.player.yaw) * Math.min(1.0, dt * smoothRate);
      this.player.pitch += (this.targetPitch - this.player.pitch) * Math.min(1.0, dt * smoothRate);
    }

    // Chunk generation & mesh updates
    this.world.update(this.player.position, state.renderDistance, dt);

    // Update simulation
    if (!state.isPaused) {
      this.player.update(dt, this.keys);
      this.animals.update(dt, this.player.position);
      this.particles.update(dt);
      this.atmosphere.update(dt, this.player.position, this.player.isSubmerged, state.renderDistance);

      // Sync atmosphere timeOfDay to store for UI
      state.setTimeOfDay(this.atmosphere.timeOfDay);

      // Update Held Item & First Person Hand
      const currentItem = state.hotbar[state.activeHotbarSlot];
      this.hand.updateHeldItem(currentItem ? currentItem.id : BLOCKS.AIR, (id) => this.getItemColor(id));
      const isMoving = this.player.velocity.x * this.player.velocity.x + this.player.velocity.z * this.player.velocity.z > 0.1;
      const isSprinting = (this.keys['shift'] || this.keys['control']) && isMoving;
      this.hand.update(dt, isMoving, isSprinting, this.isBreaking, state.graphicsQuality);

      // Multiplayer network tick & remote mesh updates
      this.multiplayer.update(
        dt,
        this.player.position,
        this.player.yaw,
        this.player.pitch,
        currentItem ? currentItem.id : BLOCKS.AIR,
        isMoving,
        isSprinting
      );

      // Raycasting & Block Mining logic
      this.targetBlock = this.raycast();
      if (this.targetBlock) {
        this.previewBox.position.set(this.targetBlock.x + 0.5, this.targetBlock.y + 0.5, this.targetBlock.z + 0.5);
        this.previewBox.visible = true;

        if (this.isBreaking) {
          const { x, y, z } = this.targetBlock;
          const blockId = this.world.getBlockAt(x, y, z);
          const blockDef = BLOCK_DEFS[blockId];

          let toolSpeedMultiplier = 1.0;
          const heldItem = state.hotbar[state.activeHotbarSlot];
          const itemDef = heldItem ? ITEM_DEFS[heldItem.id] : null;

          if (itemDef && itemDef.isTool && itemDef.toolType === blockDef?.effectiveTool) {
            const tier = itemDef.toolTier || 1;
            toolSpeedMultiplier = tier === 1 ? 2.8 : (tier === 2 ? 4.8 : (tier === 3 ? 7.5 : 12.5));
          }

          const hardness = Math.max(0.1, blockDef?.hardness || 1.0);
          this.breakProgress += (dt * toolSpeedMultiplier) / hardness;

          if (Math.random() < 0.25) sounds.playBlockHit();

          this.breakEffect.updateProgress(x, y, z, this.breakProgress);

          if (this.breakProgress >= 1.0) {
            this.breakTargetBlock();
          }
        } else {
          this.breakEffect.hide();
        }
      } else {
        this.previewBox.visible = false;
        this.breakProgress = 0;
        this.breakEffect.hide();
      }

      // Animated Water waves normal offsets
      const waterNorm = this.textures.waterNormalTexture;
      if (waterNorm) {
        waterNorm.offset.x = (time * 0.00012) % 1;
        waterNorm.offset.y = (time * 0.00018) % 1;
      }
      const waterMap = this.waterMaterial.map;
      if (waterMap) {
        waterMap.offset.x = (time * 0.00008) % 1;
        waterMap.offset.y = (time * 0.0001) % 1;
      }

      // Auto-save world periodically (every 40 seconds)
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer > 40) {
        this.autoSaveTimer = 0;
        this.saveCurrentWorld().catch(() => {});
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  loadSavedWorld(world: SavedWorld) {
    const store = useGameStore.getState();
    store.loadWorldStateIntoStore(world);

    // Reseed terrain & restore modified blocks
    const modified = world.modifiedBlocks || [];
    this.world.setModifiedBlocksFromArray(modified);

    const spawnX = world.playerData ? world.playerData.x : 8;
    const spawnZ = world.playerData ? world.playerData.z : 8;
    this.world.reseed(world.seed, spawnX, spawnZ, true);

    if (world.playerData) {
      this.player.setPositionAndRotation(
        world.playerData.x,
        world.playerData.y,
        world.playerData.z,
        world.playerData.yaw,
        world.playerData.pitch
      );
      this.targetYaw = world.playerData.yaw;
      this.targetPitch = world.playerData.pitch;
    } else {
      this.player.spawnAtSafeLocation();
      this.targetYaw = this.player.yaw;
      this.targetPitch = this.player.pitch;
    }

    if (typeof world.timeOfDay === 'number') {
      this.atmosphere.setTimeOfDay(world.timeOfDay);
    }

    // If multiplayer world, initialize room
    if (world.type === 'multiplayer' && world.pin) {
      if (world.isHost) {
        this.multiplayer.hostRoom(world.pin);
      } else {
        this.multiplayer.joinRoom(world.pin);
      }
    }
  }

  captureCurrentWorld(nameOverride?: string): SavedWorld {
    const state = useGameStore.getState();
    const existing = state.currentWorld;
    const modifiedBlocks = this.world.getModifiedBlocksArray();

    const id = existing?.id || (state.multiplayerMode === 'offline'
      ? `world_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      : `room_${state.roomPin || 'default'}`);

    const worldType: 'singleplayer' | 'multiplayer' = state.multiplayerMode === 'offline' ? 'singleplayer' : 'multiplayer';
    const worldName = nameOverride?.trim() || existing?.name || (worldType === 'singleplayer' ? 'Survival World' : `Multiplayer PIN #${state.roomPin}`);

    const savedWorld: SavedWorld = {
      id,
      name: worldName,
      type: worldType,
      seed: existing?.seed || this.world.generator.seed || 'default_seed',
      gameMode: state.gameMode,
      createdAt: existing?.createdAt || Date.now(),
      lastPlayedAt: Date.now(),
      pin: state.roomPin || undefined,
      isHost: state.isHost,
      syncedToCloud: existing?.syncedToCloud || false,
      playerData: {
        x: Math.round(this.player.position.x * 100) / 100,
        y: Math.round(this.player.position.y * 100) / 100,
        z: Math.round(this.player.position.z * 100) / 100,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: state.health,
        hunger: state.hunger,
      },
      inventory: {
        hotbar: [...state.hotbar],
        backpack: [...state.backpack],
        activeSlot: state.activeHotbarSlot,
      },
      modifiedBlocks,
      blockCount: modifiedBlocks.length,
      timeOfDay: this.atmosphere.timeOfDay,
    };

    return savedWorld;
  }

  async saveCurrentWorld(nameOverride?: string): Promise<{ success: boolean; cloudSynced: boolean; needsTableSetup?: boolean; message?: string }> {
    const world = this.captureCurrentWorld(nameOverride);
    const store = useGameStore.getState();
    store.setCurrentWorld(world);

    store.setCloudSyncState('syncing', 'Saving world...');
    const result = await WorldStorage.saveWorld(world);

    if (result.needsTableSetup) {
      store.setNeedsTableSetup(true);
      store.setCloudSyncState('setup_needed', 'Database table "worlds" needed in Supabase');
    } else if (result.cloudSynced) {
      store.setNeedsTableSetup(false);
      store.setCloudSyncState('synced', 'World saved & synced to Supabase Cloud ☁️');
    } else {
      store.setNeedsTableSetup(false);
      store.setCloudSyncState('idle', result.message || 'Saved locally');
    }

    // Refresh world list in store
    const localWorlds = WorldStorage.getLocalWorlds();
    store.setSavedWorlds(localWorlds);

    return result;
  }
}
