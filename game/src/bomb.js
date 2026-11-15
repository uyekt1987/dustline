// The bomb: carried / dropped / planted / defused / detonated. Plant 3s, defuse 5s,
// fuse 35s. Methods live on state.bomb itself, so rounds/bots read bomb.state
// directly and there is exactly one source of truth.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { actorById } from './state.js';

const PLANT_SECONDS = 3;
const DEFUSE_SECONDS = 5;
const FUSE_SECONDS = 35;

export function createBomb(scene, world, state) {
  const b = state.bomb;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.24),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1d22'), roughness: 0.5, metalness: 0.4 }));
  body.position.y = 0.09;
  const lampMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent),
    emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 1,
  });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), lampMat);
  lamp.position.set(0, 0.2, 0);
  group.add(body, lamp);
  scene.add(group);
  b.mesh = group;

  let beepAt = 0;

  function siteAt(actor) {
    for (const k of ['A', 'B']) {
      if (world.sites[k].box.containsPoint(actor.pos)) return k;
    }
    return null;
  }

  function plantStep(actor, dt) {
    if (b.state !== 'carried' || b.carrierId !== actor.id || !actor.alive || actor.team !== 'vanguard') {
      if (dt <= 0) b.plantProgress = Math.max(0, b.plantProgress - 1 / 30);
      return;
    }
    const site = siteAt(actor);
    if (!site) {
      b.plantProgress = Math.max(0, b.plantProgress - (dt > 0 ? dt / PLANT_SECONDS : 1 / 30));
      return;
    }
    if (b.plantProgress === 0) state.events.push({ type: 'plant', site });
    if (dt <= 0) { b.plantProgress = Math.max(0, b.plantProgress - 1 / 30); return; }
    b.plantProgress += dt / PLANT_SECONDS;
    if (b.plantProgress >= 1) {
      b.plantProgress = 1;
      b.state = 'planted';
      b.site = site;
      b.fuse = FUSE_SECONDS;
      b.pos.set(actor.pos.x, 0, actor.pos.z);
      state.events.push({ type: 'planted', site });
    }
  }

  function defuseStep(actor, dt) {
    if (b.state !== 'planted' || !actor.alive || actor.team !== 'jackals') {
      if (dt <= 0) b.defuseProgress = Math.max(0, b.defuseProgress - 1 / 30);
      return;
    }
    const dx = b.pos.x - actor.pos.x, dz = b.pos.z - actor.pos.z;
    if (dx * dx + dz * dz > 2.25) {
      b.defuseProgress = Math.max(0, b.defuseProgress - (dt > 0 ? dt / DEFUSE_SECONDS : 1 / 30));
      return;
    }
    if (b.defuseProgress === 0) state.events.push({ type: 'defuse', site: b.site });
    if (dt <= 0) { b.defuseProgress = Math.max(0, b.defuseProgress - 1 / 30); return; }
    b.defuseProgress += dt / DEFUSE_SECONDS;
    if (b.defuseProgress >= 1) {
      b.defuseProgress = 1;
      b.state = 'defused';
      state.events.push({ type: 'defused', site: b.site });
    }
  }

  function update(dt) {
    if (b.state === 'carried') {
      const c = actorById(state, b.carrierId);
      if (c && c.alive) {
        b.pos.copy(c.pos);
        // On the carrier's back.
        group.position.set(
          c.pos.x + Math.sin(c.yaw) * 0.25, c.pos.y + 1.05, c.pos.z + Math.cos(c.yaw) * 0.25);
      }
      lampMat.emissiveIntensity = Math.sin(state.time * 4) > 0 ? 1 : 0.15;
    } else if (b.state === 'dropped') {
      group.position.set(b.pos.x, 0, b.pos.z);
      lampMat.emissiveIntensity = Math.sin(state.time * 4) > 0 ? 1 : 0.15;
      for (const a of state.actors) {
        if (!a.alive || a.team !== 'vanguard') continue;
        const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
        if (dx * dx + dz * dz < 1.44) {
          b.state = 'carried';
          b.carrierId = a.id;
          a.carrier = true;
          break;
        }
      }
    } else if (b.state === 'planted') {
      group.position.set(b.pos.x, 0, b.pos.z);
      b.fuse -= dt;
      lampMat.emissiveIntensity = Math.sin(state.time * (b.fuse < 10 ? 20 : 8)) > 0 ? 1 : 0.1;
      beepAt -= dt;
      if (beepAt <= 0) {
        state.events.push({ type: 'beep', final: b.fuse < 10 });
        beepAt = b.fuse < 10 ? 0.5 : 1;
      }
      if (b.fuse <= 0) {
        b.fuse = 0;
        b.state = 'detonated';
        state.events.push({ type: 'explosion', x: b.pos.x, y: 0.5, z: b.pos.z });
        state.events.push({ type: 'detonate', site: b.site });
      }
    } else {
      lampMat.emissiveIntensity = 0;
    }
  }

  function onCarrierDeath() {
    if (b.state !== 'carried') return;
    const c = actorById(state, b.carrierId);
    if (c) {
      b.pos.set(c.pos.x, 0, c.pos.z);
      c.carrier = false;
    }
    b.carrierId = null;
    b.state = 'dropped';
    b.plantProgress = 0;
  }

  function reset(carrierId) {
    b.state = 'carried';
    b.site = null;
    b.carrierId = carrierId;
    b.plantProgress = 0;
    b.defuseProgress = 0;
    b.fuse = 0;
    beepAt = 0;
    const c = actorById(state, carrierId);
    if (c) b.pos.copy(c.pos);
    group.visible = true;
  }

  b.plantStep = plantStep;
  b.defuseStep = defuseStep;
  b.update = update;
  b.onCarrierDeath = onCarrierDeath;
  b.reset = reset;
  return b;
}
