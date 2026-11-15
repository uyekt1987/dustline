// Combat: weapon defs, hitscan fire, damage, reload. One shared raycaster, temp vectors only.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  p9: { name: 'P9', price: 0, damage: 26, head: 80, mag: 12, reserve: -1, gap: 0.22, reload: 1.4, spreadStill: 0.004, spreadMove: 0.02, auto: false },
  vk7: { name: 'VK-7', price: 2700, damage: 34, head: 100, mag: 30, reserve: 90, gap: 0.096, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, auto: true },
  kx9: { name: 'KX-9', price: 1800, damage: 28, head: 85, mag: 32, reserve: 96, gap: 0.07, reload: 1.7, spreadStill: 0.003, spreadMove: 0.032, auto: true },
};
const MOVE_REF = 5.2;
const RAY_FAR = 80;

export function createCombat(scene, world, state, effects) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = RAY_FAR;
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const far = new THREE.Vector3();
  const targets = []; // reused per shot, never reallocated

  function teamColor(team) {
    return team === 'vanguard' ? (PALETTE.ally || '#7fb069') : (PALETTE.enemy || '#d8544a');
  }

  function damageActor(target, amount, part, killer, weapon) {
    if (!target.alive) return false;
    target.health -= amount;
    const died = target.health <= 0;
    if (died) {
      target.alive = false;
      target.health = 0;
      target.deaths += 1;
      if (killer && killer !== target) {
        killer.kills += 1;
        killer.money += 300;
      }
      state.feed.push({ killer: killer ? killer.id : null, victim: target.id, weapon, time: state.time });
      state.events.push({ type: 'kill', killer: killer ? killer.id : null, victim: target.id, weapon });
    }
    state.events.push({ type: 'hit', shooter: killer ? killer.id : null, target: target.id, part, killed: died });
    if (target.kind === 'player') {
      state.events.push({ type: 'damage', actor: target.id, fromX: killer ? killer.pos.x : target.pos.x, fromZ: killer ? killer.pos.z : target.pos.z });
    }
    return died;
  }

  function tryFire(actor, aimDir, spread) {
    const w = WEAPONS[actor.weapon];
    if (!w || !actor.alive || actor.cooldown > 0 || actor.mag <= 0 || actor.reloadLeft > 0) return { fired: false };
    actor.mag -= 1;
    actor.cooldown = w.gap;
    origin.set(actor.pos.x, actor.pos.y + actor.eye, actor.pos.z);
    dir.copy(aimDir);
    if (spread > 0) {
      const r = state.random;
      dir.x += (r() * 2 - 1) * spread;
      dir.y += (r() * 2 - 1) * spread;
      dir.z += (r() * 2 - 1) * spread;
    }
    dir.normalize();
    targets.length = 0;
    for (const s of world.shootables) targets.push(s);
    for (const a of state.actors) {
      if (!a.alive || !a.mesh || a === actor) continue; // never shoot yourself
      targets.push(a.mesh.torso, a.mesh.head);
    }
    raycaster.set(origin, dir);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const point = hit ? hit.point : far.copy(dir).multiplyScalar(RAY_FAR).add(origin);
    effects.tracer(origin, point, teamColor(actor.team));
    state.events.push({ type: 'shot', actor: actor.id, weapon: actor.weapon, x: origin.x, y: origin.y, z: origin.z });
    state.noise.push({ x: actor.pos.x, z: actor.pos.z, team: actor.team, time: state.time });
    if (hit && hit.object.userData.actor) {
      const target = hit.object.userData.actor;
      const part = hit.object.userData.part || 'torso';
      const killed = damageActor(target, part === 'head' ? w.head : w.damage, part, actor, actor.weapon);
      return { fired: true, hit: true, target, part, killed, point };
    }
    return { fired: true, hit: false, point };
  }

  function stepWeapon(actor, dt) {
    actor.cooldown = Math.max(0, actor.cooldown - dt);
    if (actor.reloadLeft <= 0) return;
    actor.reloadLeft -= dt;
    if (actor.reloadLeft > 0) return;
    actor.reloadLeft = 0;
    const w = WEAPONS[actor.weapon];
    const need = w.mag - actor.mag;
    const take = actor.reserve === -1 ? need : Math.min(need, actor.reserve);
    actor.mag += take;
    if (actor.reserve !== -1) actor.reserve -= take;
  }

  function startReload(actor) {
    const w = WEAPONS[actor.weapon];
    if (!w || actor.reloadLeft > 0 || actor.mag >= w.mag || actor.reserve === 0) return;
    actor.reloadLeft = w.reload;
    state.events.push({ type: 'reload', actor: actor.id });
  }

  function spreadFor(actor) {
    const w = WEAPONS[actor.weapon];
    const speed = actor.mover ? actor.mover.groundSpeed() : 0;
    return w.spreadStill + Math.min(1, speed / MOVE_REF) * w.spreadMove;
  }

  return { tryFire, damageActor, stepWeapon, startReload, spreadFor };
}
