import * as THREE from 'three';
import { GraphicsQuality } from '../../store/gameStore';

interface SkyKeyframe {
  time: number;
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  lightColor: THREE.Color;
  ambientColor: THREE.Color;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  lightIntensity: number;
  ambientIntensity: number;
  starOpacity: number;
  sunGlowAlpha: number;
  moonGlowAlpha: number;
  dayNightFactor: number;
}

export class AtmosphereManager {
  scene: THREE.Scene;
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;

  // Celestial Objects
  sunMesh: THREE.Mesh;
  sunGlowMesh: THREE.Mesh;
  moonMesh: THREE.Mesh;
  moonGlowMesh: THREE.Mesh;
  starField: THREE.Points;
  cloudMesh: THREE.Mesh;
  cloudMaterial: THREE.ShaderMaterial;

  // Sky colors & Day/Night Cycle (Total 780s: 600s Day, 180s Night)
  timeOfDay: number = 0.15; // 0..1
  cycleSpeed: number = 1 / 780;

  // Smooth Sleep / Fast-forward transition state
  private fastForwardTarget: number | null = null;
  private fastForwardSpeed: number = 0;

  // Reusable interpolation color buffers (zero GC allocations per frame)
  private readonly interpSky = new THREE.Color();
  private readonly interpFog = new THREE.Color();
  private readonly interpLight = new THREE.Color();
  private readonly interpAmbient = new THREE.Color();
  private readonly interpHemiSky = new THREE.Color();
  private readonly interpHemiGround = new THREE.Color();

  // 13 Rich Celestial Spline Keyframes across the 24-hour cycle
  private readonly keyframes: SkyKeyframe[];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;

    // Helper to create keyframe entries
    const makeKeyframe = (
      time: number,
      skyHex: number,
      fogHex: number,
      lightHex: number,
      ambientHex: number,
      hemiSkyHex: number,
      hemiGrdHex: number,
      lightInt: number,
      ambInt: number,
      starOp: number,
      sunGlow: number,
      moonGlow: number,
      dnf: number
    ): SkyKeyframe => ({
      time,
      skyColor: new THREE.Color(skyHex),
      fogColor: new THREE.Color(fogHex),
      lightColor: new THREE.Color(lightHex),
      ambientColor: new THREE.Color(ambientHex),
      hemiSkyColor: new THREE.Color(hemiSkyHex),
      hemiGroundColor: new THREE.Color(hemiGrdHex),
      lightIntensity: lightInt,
      ambientIntensity: ambInt,
      starOpacity: starOp,
      sunGlowAlpha: sunGlow,
      moonGlowAlpha: moonGlow,
      dayNightFactor: dnf,
    });

    this.keyframes = [
      // 0.00: High Noon (Bright azure sky, warm sunlight)
      makeKeyframe(0.00, 0x6eb2f5, 0x85c2f8, 0xfff9ec, 0xd6e6fc, 0x90c5ff, 0x564535, 1.35, 0.46, 0.00, 1.0, 0.0, 1.0),
      // 0.16: Afternoon (Warm sunlight, clear atmosphere)
      makeKeyframe(0.16, 0x6ba9ed, 0x80b9f2, 0xfff4de, 0xcee1fa, 0x88beff, 0x544333, 1.28, 0.44, 0.00, 1.0, 0.0, 1.0),
      // 0.21: Pre-Sunset Golden Hour (Warm amber tones spreading across the sky)
      makeKeyframe(0.21, 0xcca05c, 0xd6a86c, 0xffa64d, 0xd9a877, 0xe0a669, 0x4a3522, 1.15, 0.40, 0.00, 1.0, 0.1, 0.85),
      // 0.25: Sunset (Horizon gold & vibrant orange)
      makeKeyframe(0.25, 0xe8703a, 0xeb824b, 0xff8033, 0xc76d46, 0xf07f43, 0x3d2319, 0.95, 0.35, 0.10, 1.0, 0.35, 0.65),
      // 0.28: Dusk / Twilight (Crimson & deep violet glow)
      makeKeyframe(0.28, 0x7a2b4b, 0x8e3759, 0xf75240, 0x6b2f44, 0x943857, 0x26141e, 0.60, 0.28, 0.45, 0.5, 0.65, 0.35),
      // 0.33: Blue Hour (Deep indigo nightfall, stars emerging)
      makeKeyframe(0.33, 0x1a1d3d, 0x20234a, 0x6d88ce, 0x23274f, 0x273063, 0x121526, 0.38, 0.22, 0.80, 0.0, 0.85, 0.12),
      // 0.50: Midnight (Deep sapphire celestial darkness, twinkling stars, soft moonlit fog)
      makeKeyframe(0.50, 0x060812, 0x080c18, 0x82a4dd, 0x0e1526, 0x131e38, 0x060912, 0.28, 0.16, 1.00, 0.0, 1.0, 0.0),
      // 0.67: Pre-Dawn Blue Hour (Cool indigo glow before dawn)
      makeKeyframe(0.67, 0x17193b, 0x1e2145, 0x6d85cc, 0x21254a, 0x252e5e, 0x111424, 0.36, 0.20, 0.80, 0.0, 0.85, 0.12),
      // 0.72: Dawn Aurora (Rosy pink and coral sunrise horizon)
      makeKeyframe(0.72, 0x963f5c, 0xa84c6b, 0xff6b57, 0x7a3d52, 0xa34a69, 0x2a1721, 0.65, 0.28, 0.40, 0.5, 0.50, 0.35),
      // 0.75: Golden Sunrise (Radiant amber sun cresting the mountains)
      makeKeyframe(0.75, 0xe8783d, 0xed884c, 0xff8838, 0xc97448, 0xf28547, 0x3f251a, 0.98, 0.36, 0.10, 1.0, 0.30, 0.68),
      // 0.79: Early Morning (Golden yellow sunlight dissipating into morning sky)
      makeKeyframe(0.79, 0xc99d58, 0xd4a568, 0xffa44a, 0xd6a574, 0xdda366, 0x483420, 1.18, 0.41, 0.00, 1.0, 0.1, 0.88),
      // 0.84: Morning (Clear blue sky)
      makeKeyframe(0.84, 0x6ba8ec, 0x80b7f0, 0xfff4dc, 0xcee0fa, 0x88bdff, 0x544232, 1.28, 0.44, 0.00, 1.0, 0.0, 1.0),
      // 1.00: High Noon (Wrap around)
      makeKeyframe(1.00, 0x6eb2f5, 0x85c2f8, 0xfff9ec, 0xd6e6fc, 0x90c5ff, 0x564535, 1.35, 0.46, 0.00, 1.0, 0.0, 1.0),
    ];

    // 1. Directional Sun/Moon light with soft PCF shadow maps
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.camera.left = -75;
    this.sunLight.shadow.camera.right = 75;
    this.sunLight.shadow.camera.top = 75;
    this.sunLight.shadow.camera.bottom = -75;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.035;
    this.scene.add(this.sunLight);

    // 2. Ambient & Sky Hemisphere lighting (Global Illumination approximation)
    this.ambientLight = new THREE.AmbientLight(0xdbe6f7, 0.45);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x7ab6f7, 0x483a2b, 0.4);
    this.scene.add(this.hemiLight);

    // 3. Sun Mesh & Volumetric Sun Bloom Glow
    const sunGeo = new THREE.BoxGeometry(16, 16, 4);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Atmospheric Sun Bloom Flare
    const sunGlowGeo = new THREE.PlaneGeometry(80, 80);
    const sunGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0xffd57a) },
        uAlpha: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          float dist = distance(vUv, vec2(0.5, 0.5));
          float alpha = clamp(1.0 - dist * 2.0, 0.0, 1.0);
          alpha = pow(alpha, 2.5) * 0.75 * uAlpha;
          if (alpha <= 0.005) discard;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sunGlowMesh = new THREE.Mesh(sunGlowGeo, sunGlowMat);
    this.scene.add(this.sunGlowMesh);

    // 4. Moon Mesh & Soft Moon Bloom
    const moonGeo = new THREE.BoxGeometry(12, 12, 4);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xebf2fa });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    const moonGlowGeo = new THREE.PlaneGeometry(50, 50);
    const moonGlowMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x9cbaf0) },
        uAlpha: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          float dist = distance(vUv, vec2(0.5, 0.5));
          float alpha = clamp(1.0 - dist * 2.0, 0.0, 1.0);
          alpha = pow(alpha, 2.2) * 0.45 * uAlpha;
          if (alpha <= 0.005) discard;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.moonGlowMesh = new THREE.Mesh(moonGlowGeo, moonGlowMat);
    this.scene.add(this.moonGlowMesh);

    // 5. Starfield Points (Twinkling night sky)
    const starCount = 1400;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 380;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 15;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.8,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: false,
    });
    this.starField = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starField);

    // 6. Volumetric 3D Raymarched Clouds Shader Canopy
    const cloudVertexShader = `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const cloudFragmentShader = `
      uniform float uTime;
      uniform vec3 uSunPosition;
      uniform vec3 uSkyColor;
      uniform vec3 uSunColor;
      uniform float uCloudDensity;
      uniform float uDayNightFactor;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.5000 * noise(p); p *= 2.02;
        v += 0.2500 * noise(p); p *= 2.03;
        v += 0.1250 * noise(p); p *= 2.01;
        v += 0.0625 * noise(p);
        return v;
      }

      void main() {
        vec2 uv = (vWorldPosition.xz) * 0.0022;
        vec2 wind = vec2(uTime * 0.007, uTime * 0.004);
        
        float d = fbm(uv + wind);
        float d2 = fbm(uv * 2.4 - wind * 0.35);
        float cloudShape = smoothstep(0.44, 0.72, d + d2 * 0.28);

        if (cloudShape <= 0.01) discard;

        // Circular horizon falloff so clouds blend naturally into distance
        float distFromCenter = length(vWorldPosition.xz);
        float horizonFade = smoothstep(780.0, 420.0, distFromCenter);

        // Sunlight Silver Lining & Forward Mie Scattering
        vec3 lightDir = normalize(uSunPosition - vWorldPosition);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float sunHighlight = max(0.0, dot(-viewDir, lightDir));
        float silverLining = pow(sunHighlight, 4.0) * 0.55;

        vec3 dayCloudColor = mix(vec3(0.92, 0.94, 0.98), vec3(1.0, 0.96, 0.90), silverLining);
        vec3 nightCloudColor = vec3(0.08, 0.10, 0.16);
        vec3 sunsetCloudColor = vec3(0.98, 0.60, 0.45);

        vec3 baseColor = mix(nightCloudColor, dayCloudColor, uDayNightFactor);
        if (uDayNightFactor > 0.40 && uDayNightFactor < 0.90) {
          float sunsetBlend = sin((uDayNightFactor - 0.40) / 0.50 * 3.14159);
          baseColor = mix(baseColor, sunsetCloudColor, sunsetBlend * 0.75);
        }

        float alpha = clamp(cloudShape * uCloudDensity * 0.88 * horizonFade, 0.0, 0.88);
        if (alpha <= 0.005) discard;
        gl_FragColor = vec4(baseColor, alpha);
      }
    `;

    this.cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunPosition: { value: new THREE.Vector3(0, 100, 0) },
        uSkyColor: { value: new THREE.Color(0x87ceeb) },
        uSunColor: { value: new THREE.Color(0xfffaed) },
        uCloudDensity: { value: 1.0 },
        uDayNightFactor: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const cloudGeo = new THREE.PlaneGeometry(1600, 1600, 64, 64);
    this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.cloudMesh.position.set(0, 92, 0);
    this.cloudMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.cloudMesh);
  }

  /**
   * Evaluates continuous smooth color and lighting interpolation at normalized cycle time t (0..1)
   */
  private sampleSky(t: number) {
    // Wrap t in [0, 1)
    const normT = ((t % 1.0) + 1.0) % 1.0;

    // Locate the surrounding keyframes
    let k0 = this.keyframes[0];
    let k1 = this.keyframes[1];
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (normT >= this.keyframes[i].time && normT <= this.keyframes[i + 1].time) {
        k0 = this.keyframes[i];
        k1 = this.keyframes[i + 1];
        break;
      }
    }

    // Normalized progress between the two keyframes
    const span = k1.time - k0.time;
    const progress = span > 0.00001 ? (normT - k0.time) / span : 0;

    // Smoothstep interpolation curve (eliminates hard derivative transitions)
    const smoothP = progress * progress * (3.0 - 2.0 * progress);

    this.interpSky.copy(k0.skyColor).lerp(k1.skyColor, smoothP);
    this.interpFog.copy(k0.fogColor).lerp(k1.fogColor, smoothP);
    this.interpLight.copy(k0.lightColor).lerp(k1.lightColor, smoothP);
    this.interpAmbient.copy(k0.ambientColor).lerp(k1.ambientColor, smoothP);
    this.interpHemiSky.copy(k0.hemiSkyColor).lerp(k1.hemiSkyColor, smoothP);
    this.interpHemiGround.copy(k0.hemiGroundColor).lerp(k1.hemiGroundColor, smoothP);

    const lightIntensity = THREE.MathUtils.lerp(k0.lightIntensity, k1.lightIntensity, smoothP);
    const ambientIntensity = THREE.MathUtils.lerp(k0.ambientIntensity, k1.ambientIntensity, smoothP);
    const starOpacity = THREE.MathUtils.lerp(k0.starOpacity, k1.starOpacity, smoothP);
    const sunGlowAlpha = THREE.MathUtils.lerp(k0.sunGlowAlpha, k1.sunGlowAlpha, smoothP);
    const moonGlowAlpha = THREE.MathUtils.lerp(k0.moonGlowAlpha, k1.moonGlowAlpha, smoothP);
    const dayNightFactor = THREE.MathUtils.lerp(k0.dayNightFactor, k1.dayNightFactor, smoothP);

    return {
      skyColor: this.interpSky,
      fogColor: this.interpFog,
      lightColor: this.interpLight,
      ambientColor: this.interpAmbient,
      hemiSkyColor: this.interpHemiSky,
      hemiGroundColor: this.interpHemiGround,
      lightIntensity,
      ambientIntensity,
      starOpacity,
      sunGlowAlpha,
      moonGlowAlpha,
      dayNightFactor,
    };
  }

  update(dt: number, playerPos: THREE.Vector3, isSubmerged: boolean, renderDistance: number) {
    // 1. Smooth Fast-Forward (e.g. from sleeping in a bed)
    if (this.fastForwardTarget !== null) {
      const step = dt * this.fastForwardSpeed;
      this.timeOfDay = (this.timeOfDay + step) % 1.0;
      // Check if reached target
      const diff = Math.abs(this.timeOfDay - this.fastForwardTarget);
      if (diff < 0.02 || (this.fastForwardSpeed > 0 && this.timeOfDay >= this.fastForwardTarget && this.timeOfDay - this.fastForwardTarget < 0.05)) {
        this.timeOfDay = this.fastForwardTarget;
        this.fastForwardTarget = null;
      }
    } else {
      // Standard smooth continuous cycle: 600s daylight (0.75 of circle), 180s night (0.25 of circle)
      const isDay = this.timeOfDay < 0.28 || this.timeOfDay > 0.72;
      const rate = isDay ? (0.56 / 600) : (0.44 / 180);
      this.timeOfDay = (this.timeOfDay + dt * rate) % 1.0;
    }

    const angle = this.timeOfDay * Math.PI * 2;
    const sunDist = 280;

    // Sun Celestial Position
    const sunX = playerPos.x + Math.sin(angle) * sunDist;
    const sunY = playerPos.y + Math.cos(angle) * sunDist;
    const sunZ = playerPos.z + Math.sin(angle * 0.5) * 40;

    this.sunMesh.position.set(sunX, sunY, sunZ);
    this.sunMesh.lookAt(playerPos);

    this.sunGlowMesh.position.set(sunX, sunY, sunZ);
    this.sunGlowMesh.lookAt(playerPos);

    // Moon Celestial Position
    const moonX = playerPos.x - Math.sin(angle) * sunDist;
    const moonY = playerPos.y - Math.cos(angle) * sunDist;
    const moonZ = playerPos.z - Math.sin(angle * 0.5) * 40;

    this.moonMesh.position.set(moonX, moonY, moonZ);
    this.moonMesh.lookAt(playerPos);

    this.moonGlowMesh.position.set(moonX, moonY, moonZ);
    this.moonGlowMesh.lookAt(playerPos);

    // Sky dome follows player smoothly
    this.starField.position.copy(playerPos);
    this.cloudMesh.position.x = playerPos.x;
    this.cloudMesh.position.z = playerPos.z;

    // 2. Sample 100% continuous celestial lighting & colors
    const sky = this.sampleSky(this.timeOfDay);

    // Update Celestial Glow Alphas
    if (this.sunGlowMesh.material instanceof THREE.ShaderMaterial) {
      this.sunGlowMesh.material.uniforms.uAlpha.value = sky.sunGlowAlpha;
    }
    this.sunGlowMesh.visible = sky.sunGlowAlpha > 0.01;

    if (this.moonGlowMesh.material instanceof THREE.ShaderMaterial) {
      this.moonGlowMesh.material.uniforms.uAlpha.value = sky.moonGlowAlpha;
    }
    this.moonGlowMesh.visible = sky.moonGlowAlpha > 0.01;

    // Starfield twinkle and smooth fade
    const starTwinkle = 0.88 + 0.12 * Math.sin(performance.now() * 0.0025);
    (this.starField.material as THREE.PointsMaterial).opacity = sky.starOpacity * starTwinkle;

    // Smooth directional shadow caster positioning (blend smoothly between sun & moon)
    const isSunDominant = Math.cos(angle) >= 0;
    if (isSunDominant) {
      this.sunLight.position.set(sunX, Math.max(sunY, playerPos.y + 25), sunZ);
    } else {
      this.sunLight.position.set(moonX, Math.max(moonY, playerPos.y + 25), moonZ);
    }
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    if (isSubmerged) {
      this.scene.background = new THREE.Color(0x0a3377);
      this.scene.fog = new THREE.FogExp2(0x0d3e8a, 0.075);
      this.ambientLight.color.setHex(0x1a5bb8);
      this.ambientLight.intensity = 0.5;
      this.sunLight.intensity = 0.3;
    } else {
      const renderDistBlocks = renderDistance * 16;
      this.scene.background = sky.skyColor;
      this.scene.fog = new THREE.Fog(sky.fogColor, renderDistBlocks * 0.52, renderDistBlocks * 0.98);
      
      this.ambientLight.color.copy(sky.ambientColor);
      this.ambientLight.intensity = sky.ambientIntensity;
      
      this.hemiLight.color.copy(sky.hemiSkyColor);
      this.hemiLight.groundColor.copy(sky.hemiGroundColor);
      this.hemiLight.intensity = sky.ambientIntensity * 0.9;

      this.sunLight.color.copy(sky.lightColor);
      this.sunLight.intensity = sky.lightIntensity;
    }

    // Update Cloud uniforms seamlessly
    this.cloudMaterial.uniforms.uTime.value += dt;
    this.cloudMaterial.uniforms.uSunPosition.value.set(sunX, sunY, sunZ);
    this.cloudMaterial.uniforms.uSkyColor.value.copy(sky.skyColor);
    this.cloudMaterial.uniforms.uSunColor.value.copy(sky.lightColor);
    this.cloudMaterial.uniforms.uDayNightFactor.value = sky.dayNightFactor;
  }

  /**
   * Smoothly animates night to morning (e.g., when sleeping) without instantaneous jumps
   */
  skipNightToMorning() {
    this.fastForwardTarget = 0.77; // Sunrise
    this.fastForwardSpeed = 0.35;  // Smooth fast-forward over ~1.5 seconds
  }

  setQuality(quality: GraphicsQuality) {
    if (quality === 'Very Low') {
      this.sunLight.castShadow = false;
      this.cloudMesh.visible = false;
      this.sunGlowMesh.visible = false;
      this.moonGlowMesh.visible = false;
    } else if (quality === 'Low') {
      this.sunLight.castShadow = false;
      this.cloudMesh.visible = false;
      this.sunGlowMesh.visible = false;
      this.moonGlowMesh.visible = false;
    } else if (quality === 'Medium') {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 1024;
      this.sunLight.shadow.mapSize.height = 1024;
      this.cloudMesh.visible = true;
      this.cloudMaterial.uniforms.uCloudDensity.value = 0.7;
      this.sunGlowMesh.visible = true;
      this.moonGlowMesh.visible = true;
    } else if (quality === 'High') {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.cloudMesh.visible = true;
      this.cloudMaterial.uniforms.uCloudDensity.value = 1.0;
      this.sunGlowMesh.visible = true;
      this.moonGlowMesh.visible = true;
    } else if (quality === 'Very High') {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 3072;
      this.sunLight.shadow.mapSize.height = 3072;
      this.cloudMesh.visible = true;
      this.cloudMaterial.uniforms.uCloudDensity.value = 1.1;
      this.sunGlowMesh.visible = true;
      this.moonGlowMesh.visible = true;
    } else if (quality === 'Ultra' || quality === 'Cinematic') {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 4096;
      this.sunLight.shadow.mapSize.height = 4096;
      this.cloudMesh.visible = true;
      this.cloudMaterial.uniforms.uCloudDensity.value = 1.25;
      this.sunGlowMesh.visible = true;
      this.moonGlowMesh.visible = true;
    } else if (quality === 'Real Life Resolution') {
      // RTX 5090 Tier: 8192 Shadow Maps, Ultra Raymarched Density, Max Atmospheric Bloom
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 8192;
      this.sunLight.shadow.mapSize.height = 8192;
      this.cloudMesh.visible = true;
      this.cloudMaterial.uniforms.uCloudDensity.value = 1.45;
      this.sunGlowMesh.visible = true;
      this.moonGlowMesh.visible = true;
    }
  }

  setTimeOfDay(time: number) {
    this.timeOfDay = Math.max(0, Math.min(1, time));
  }
}
