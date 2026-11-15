// Grenades: pool of 2, gravity + AABB bounce, 3 s fuse, radial falloff damage.
import * as THREE from 'three';

const POOL = 2;
const GRAVITY = 20;
const FUSE = 3;
const RADIUS = 7;
const DMG_CENTER = 120;
const DMG_EDGE = 20;
const REST_SPEED = 1.5;
const SIZE = 0.12;

export function createGrenades(scene, world, combat, state, effects) {
  const geo = new THREE.SphereGeometry(0.09, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c323a, roughness: 0.6, metalness: 0.5 });
  const pool = [];
  for (let i = 0; i < POOL; i += 1) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, owner: null, alive: false, mesh });
  }
  const box = new THREE.Box3();
  const chest = new THREE.Vector3();

  function explode(g) {
    g.alive = false;
    g.mesh.visible = false;
    effects.explosionFlash(g.pos);
    state.events.push({ type: 'explosion', x: g.pos.x, y: g.pos.y, z: g.pos.z });
    for (const a of state.actors) {
      if (!a.alive) continue;
      chest.set(a.pos.x, a.pos.y + 1.0, a.pos.z);
      const d = chest.distanceTo(g.pos);
      if (d >= RADIUS) continue;
      const dmg = DMG_CENTER - (d / RADIUS) * (DMG_CENTER - DMG_EDGE);
      combat.damageActor(a, dmg, 'blast', g.owner, 'grenade');
    }
  }

  function collide(g) {
    for (const c of world.colliders) {
      box.copy(c).expandByScalar(SIZE);
      if (!box.containsPoint(g.pos)) continue;
      const px = Math.min(g.pos.x - box.min.x, box.max.x - g.pos.x);
      const py = Math.min(g.pos.y - box.min.y, box.max.y - g.pos.y);
      const pz = Math.min(g.pos.z - box.min.z, box.max.z - g.pos.z);
      if (px <= py && px <= pz) {
        g.pos.x = g.pos.x - box.min.x < box.max.x - g.pos.x ? box.min.x : box.max.x;
        g.vel.x *= -0.45; g.vel.y *= 0.7; g.vel.z *= 0.7;
      } else if (py <= pz) {
        g.pos.y = g.pos.y - box.min.y < box.max.y - g.pos.y ? box.min.y : box.max.y;
        g.vel.y *= -0.45; g.vel.x *= 0.7; g.vel.z *= 0.7;
      } else {
        g.pos.z = g.pos.z - box.min.z < box.max.z - g.pos.z ? box.min.z : box.max.z;
        g.vel.z *= -0.45; g.vel.x *= 0.7; g.vel.y *= 0.7;
      }
    }
    if (g.pos.y < 0.09) { // ground plane
      g.pos.y = 0.09;
      g.vel.y = Math.abs(g.vel.y) > 0.5 ? g.vel.y * -0.45 : 0;
      g.vel.x *= 0.7;
      g.vel.z *= 0.7;
    }
  }

  return {
    throw(actor, dir) {
      if (actor.grenades <= 0) return false;
      const g = pool.find((p) => !p.alive);
      if (!g) return false;
      actor.grenades -= 1;
      g.pos.set(actor.pos.x, actor.pos.y + actor.eye, actor.pos.z);
      g.vel.copy(dir).multiplyScalar(16);
      g.vel.y += 5;
      g.fuse = FUSE;
      g.owner = actor;
      g.alive = true;
      g.mesh.visible = true;
      g.mesh.position.copy(g.pos);
      return true;
    },
    step(dt) {
      for (const g of pool) {
        if (!g.alive) continue;
        g.vel.y -= GRAVITY * dt;
        g.pos.addScaledVector(g.vel, dt);
        collide(g);
        if (g.vel.lengthSq() < REST_SPEED * REST_SPEED) g.vel.set(0, 0, 0);
        g.mesh.position.copy(g.pos);
        g.fuse -= dt;
        if (g.fuse <= 0) explode(g);
      }
    },
    get count() {
      let n = 0;
      for (const g of pool) if (g.alive) n += 1;
      return n;
    },
  };
}
