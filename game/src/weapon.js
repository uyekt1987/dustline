// Player view models: P9 pistol, VK-7 rifle (starter shape), KX-9 SMG. Visual only;
// ammo/cooldown live on the actor and are owned by combat.js.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './combat.js';

const MUZZLE_TIME = 0.06;
const BASE_POS = { x: 0.24, y: -0.2, z: -0.42 };
// per-weapon: flash z, kick, receiver/barrel/stock sizes
const DEFS = {
  p9: { flashZ: -0.68, kick: 0.03, recv: [0.06, 0.09, 0.22], barrel: [0.04, 0.04, 0.16], barrelAt: [0, 0.02, -0.17], stock: null },
  vk7: { flashZ: -0.95, kick: 0.055, recv: [0.09, 0.1, 0.42], barrel: [0.045, 0.045, 0.4], barrelAt: [0, 0.025, -0.38], stock: [0.075, 0.08, 0.22] },
  kx9: { flashZ: -0.82, kick: 0.04, recv: [0.08, 0.09, 0.32], barrel: [0.04, 0.04, 0.26], barrelAt: [0, 0.02, -0.27], stock: [0.06, 0.07, 0.14] },
};

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const models = {};
  for (const id of Object.keys(DEFS)) {
    const d = DEFS[id];
    const model = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(...d.recv), body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(...d.barrel), grip);
    barrel.position.set(...d.barrelAt);
    model.add(receiver, barrel);
    if (d.stock) {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(...d.stock), grip);
      stock.position.set(0, -0.02, d.recv[2] / 2 + d.stock[2] / 2 - 0.02);
      model.add(stock);
    }
    if (id === 'p9') {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), grip);
      handle.position.set(0, -0.09, 0.07);
      handle.rotation.x = 0.25;
      model.add(handle);
    } else {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), grip);
      mag.position.set(0, -0.1, -0.02);
      mag.rotation.x = 0.15;
      model.add(mag);
    }
    model.position.set(BASE_POS.x, BASE_POS.y, BASE_POS.z);
    model.visible = id === 'vk7';
    camera.add(model);
    models[id] = model;
  }

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, DEFS.vk7.flashZ);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = { weapon: 'vk7', flash: 0, kick: 0 };
  let model = models.vk7;

  function setWeapon(id) {
    if (!models[id] || id === state.weapon) return;
    model.visible = false;
    state.weapon = id;
    model = models[id];
    model.visible = true;
    model.position.set(BASE_POS.x, BASE_POS.y, BASE_POS.z);
    flash.position.z = DEFS[id].flashZ;
    state.kick = 0;
  }

  function step(dt, actor) {
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = BASE_POS.z + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (actor && actor.reloadLeft > 0) {
      const total = WEAPONS[actor.weapon].reload;
      model.rotation.x = -0.55 * Math.min(1, (total - actor.reloadLeft) * 2);
      model.position.y = BASE_POS.y - 0.06 * Math.sin(Math.min(1, actor.reloadLeft / total) * Math.PI);
    } else {
      model.position.y = BASE_POS.y;
    }
  }

  function pullTrigger() {
    state.flash = MUZZLE_TIME;
    state.kick = DEFS[state.weapon].kick;
  }

  function setVisible(v) {
    model.visible = v;
    if (!v) flash.visible = false;
  }

  return { state, step, setWeapon, pullTrigger, setVisible };
}
