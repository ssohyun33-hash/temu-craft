import * as THREE from 'three';
import { World } from '../world/World';
import { Animal, AnimalType } from './Animal';
import { BLOCKS } from '../blocks';

export class AnimalManager {
  scene: THREE.Scene;
  world: World;
  animals: Animal[] = [];
  maxAnimals = 16;
  spawnTimer = 0;
  onItemDrop?: (item: number, count: number, pos: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, world: World, onItemDrop?: (item: number, count: number, pos: THREE.Vector3) => void) {
    this.scene = scene;
    this.world = world;
    this.onItemDrop = onItemDrop;
  }

  update(dt: number, playerPos: THREE.Vector3) {
    // Update existing animals
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      animal.update(dt);

      // Remove dead animals
      if (animal.isDead) {
        this.scene.remove(animal.group);
        this.animals.splice(i, 1);
        continue;
      }

      // Despawn if too far
      const distSq = animal.position.distanceToSquared(playerPos);
      if (distSq > 90 * 90) {
        this.scene.remove(animal.group);
        this.animals.splice(i, 1);
      }
    }

    // Spawn periodically around player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.animals.length < this.maxAnimals) {
      this.spawnTimer = 3 + Math.random() * 4;
      this.trySpawnAnimal(playerPos);
    }
  }

  hitAnimal(animal: Animal, damage: number, knockbackDir: THREE.Vector3): boolean {
    const killed = animal.takeDamage(damage, knockbackDir, (dropItem, count, pos) => {
      if (this.onItemDrop) {
        this.onItemDrop(dropItem, count, pos);
      }
    });
    return killed;
  }

  private trySpawnAnimal(playerPos: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 32;
    const x = Math.floor(playerPos.x + Math.sin(angle) * dist);
    const z = Math.floor(playerPos.z + Math.cos(angle) * dist);

    // Find surface height
    for (let y = 50; y >= 10; y--) {
      const block = this.world.getBlockAt(x, y, z);
      const above = this.world.getBlockAt(x, y + 1, z);
      const above2 = this.world.getBlockAt(x, y + 2, z);

      if (block === BLOCKS.GRASS && above === BLOCKS.AIR && above2 === BLOCKS.AIR) {
        const types: AnimalType[] = ['pig', 'cow', 'sheep'];
        const type = types[Math.floor(Math.random() * types.length)];
        const animal = new Animal(type, new THREE.Vector3(x + 0.5, y + 1, z + 0.5), this.world);
        this.scene.add(animal.group);
        this.animals.push(animal);
        break;
      }
    }
  }

  clear() {
    for (const animal of this.animals) {
      this.scene.remove(animal.group);
    }
    this.animals = [];
  }
}
