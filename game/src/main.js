// DUSTLINE: boot and the one loop. Fixed 60 Hz sim, render at display rate.
// ?shot=start|play|end with &seed=N stages a deterministic frame, renders it
// twice, freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createState, aliveActors, actorById } from './state.js';
import { createWorld } from './world.js';
import { createMover } from './mover.js';
import { createCombat, WEAPONS } from './combat.js';
import { createGrenades } from './grenade.js';
import { createEffects } from './effects.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createBots } from './bots.js';
import { createRounds, GRENADE_PRICE, AMMO_PRICE } from './rounds.js';
import { createBomb } from './bomb.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const state = createState(random);
const effects = createEffects(scene);
const combat = createCombat(scene, world, state, effects);
const grenades = createGrenades(scene, world, combat, state, effects);
const weapon = createWeapon(camera);
const hud = createHud();
const audio = createAudio();
const input = createInput(renderer.domElement, onLockChange);
const bomb = createBomb(scene, world, state);
const rounds = createRounds(state, bomb, audio, world);
const bots = createBots(scene, world, state, combat, random, bomb);

// Actors: the player + 9 bots. pos mirrors mover.position (separate object);
// eye/height mirror the mover. Bots get their meshes lazily from bots.js.
let actorSeq = 0;
function makeActor(team, kind, name) {
  const id = kind === 'player' ? 'you' : `${team[0]}${actorSeq}`;
  actorSeq += 1;
  return {
    id, team, kind, name, alive: true, health: 100,
    pos: new THREE.Vector3(), yaw: 0, pitch: 0, eye: 1.6, height: 1.72,
    crouching: false, onGround: true,
    weapon: 'p9', mag: 12, reserve: -1, grenades: 0, money: 800,
    kills: 0, deaths: 0, cooldown: 0, reloadLeft: 0, carrier: false,
    mesh: null, mover: null, bot: null, owned: { p9: true },
  };
}

const spawnV = world.spawns.vanguard[2];
const playerObj = createPlayer(world.colliders, spawnV.x, spawnV.z, spawnV.yaw);
const player = makeActor('vanguard', 'player', 'YOU');
player.mover = playerObj.state;
player.pos.copy(player.mover.position);
player.yaw = player.mover.yaw;
state.actors.push(player);

// Invisible hitbox so bots can shoot the player (raycast ignores visibility).
{
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), mat);
  torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), mat);
  head.position.y = 1.53;
  torso.userData = { actor: player, part: 'torso' };
  head.userData = { actor: player, part: 'head' };
  torso.visible = false;
  head.visible = false;
  g.add(torso, head);
  scene.add(g);
  player.mesh = { group: g, torso, head, gun: null };
}

for (let i = 0; i < 4; i += 1) {
  const a = makeActor('vanguard', 'bot', `V-${i + 1}`);
  const s = world.spawns.vanguard[i];
  a.mover = createMover(world.colliders, s.x, s.z, s.yaw);
  a.pos.copy(a.mover.position);
  a.yaw = s.yaw;
  state.actors.push(a);
}
for (let i = 0; i < 5; i += 1) {
  const a = makeActor('jackals', 'bot', `J-${i + 1}`);
  const s = world.spawns.jackals[i];
  a.mover = createMover(world.colliders, s.x, s.z, s.yaw);
  a.pos.copy(a.mover.position);
  a.yaw = s.yaw;
  state.actors.push(a);
}

// Per-weapon ammo cache: combat.js keeps ammo on the actor for its current
// weapon only, so main.js saves/restores it across switches.
const ammoCache = {};
function resetAmmoCache() {
  for (const id of Object.keys(WEAPONS)) ammoCache[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
}
resetAmmoCache();

const rayDir = new THREE.Vector3();
const tmpV = new THREE.Vector3();
let started = false;
let buyOpen = false;
let muted = false;
let frozen = false;
let accumulator = 0;
let lastTime = performance.now();
let lastRound = 0;
let spectate = null;
let shakeT = 0;
let prevFiring = false;
const lastFoot = new THREE.Vector3().copy(player.pos);

function syncActor(a) {
  a.pos.copy(a.mover.position);
  a.yaw = a.mover.yaw;
  a.pitch = a.mover.pitch;
  a.eye = a.mover.eye;
  a.height = a.mover.height;
  a.crouching = a.mover.crouching;
  a.onGround = a.mover.onGround;
}

function syncCamera() {
  if (!player.alive && spectate && spectate.alive) {
    camera.position.set(spectate.pos.x, spectate.pos.y + spectate.eye, spectate.pos.z);
    camera.rotation.set(0, spectate.yaw, 0, 'YXZ');
    return;
  }
  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  if (shakeT > 0) {
    camera.position.x += (Math.random() * 2 - 1) * shakeT * 0.25;
    camera.position.y += (Math.random() * 2 - 1) * shakeT * 0.25;
  }
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - player.pos.x;
  const dy = point.y - (player.pos.y + player.eye);
  const dz = point.z - player.pos.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.mover.yaw = Math.atan2(-dx, -dz);
  player.mover.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncActor(player);
  syncCamera();
}

function shootPlayer(spread) {
  camera.getWorldDirection(rayDir);
  const res = combat.tryFire(player, rayDir, spread);
  if (!res.fired) return false;
  weapon.pullTrigger();
  playerObj.recoil(0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  if (res.hit && res.target) effects.spark(res.point, tmpV.copy(rayDir).multiplyScalar(-1));
  hud.setAmmo(player.mag, player.reserve, WEAPONS[player.weapon].name);
  return true;
}

function switchWeapon(id) {
  if (!player.owned[id] || player.weapon === id) return;
  ammoCache[player.weapon] = { mag: player.mag, reserve: player.reserve };
  player.weapon = id;
  player.mag = ammoCache[id].mag;
  player.reserve = ammoCache[id].reserve;
  player.reloadLeft = 0;
  player.cooldown = 0;
  weapon.setWeapon(id);
  hud.setAmmo(player.mag, player.reserve, WEAPONS[id].name);
  audio.click();
}

function buyItems() {
  return [
    { id: 'vk7', name: 'VK-7 Rifle', price: WEAPONS.vk7.price, owned: !!player.owned.vk7 },
    { id: 'kx9', name: 'KX-9 SMG', price: WEAPONS.kx9.price, owned: !!player.owned.kx9 },
    { id: 'grenade', name: 'Frag Grenade', price: GRENADE_PRICE, owned: false },
    { id: 'ammo', name: 'Refill Ammo', price: AMMO_PRICE, owned: false },
  ];
}

function onBuyItem(id) {
  if (rounds.buy(player, id)) {
    player.owned[id] = true;
    if (id === 'vk7' || id === 'kx9') {
      ammoCache[id] = { mag: player.mag, reserve: player.reserve };
      weapon.setWeapon(id);
    }
    audio.click();
    hud.hideBuyMenu();
    hud.showBuyMenu(buyItems(), player.money, onBuyItem);
    hud.setAmmo(player.mag, player.reserve, WEAPONS[player.weapon].name);
    hud.setMoney(player.money);
  }
}

function openBuy() {
  if (state.round.phase !== 'buy') return;
  buyOpen = true;
  hud.showBuyMenu(buyItems(), player.money, onBuyItem);
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeBuy(relock) {
  if (!buyOpen) return;
  buyOpen = false;
  hud.hideBuyMenu();
  if (relock && started) input.requestLock();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (!buyOpen && state.round.phase !== 'match') {
    hud.showOverlay(started ? 'paused' : 'start', state.round.score.vanguard);
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.init();
  if (state.round.phase === 'match') {
    restartMatch();
    input.requestLock();
    return;
  }
  closeBuy(false);
  input.requestLock();
});

function restartMatch() {
  state.round.score.vanguard = 0;
  state.round.score.jackals = 0;
  state.round.number = 0;
  state.round.winner = null;
  for (const a of state.actors) {
    a.money = 800;
    a.weapon = 'p9';
    a.owned = { p9: true };
    a.kills = 0;
    a.deaths = 0;
  }
  resetAmmoCache();
  weapon.setWeapon('p9');
  rounds.startRound(1);
  lastRound = 1;
  bots.spawnRound();
  spectate = null;
  hud.hideOverlay();
  syncHud();
}

function syncHud() {
  hud.setHealth(player.health);
  hud.setAmmo(player.mag, player.reserve, WEAPONS[player.weapon].name);
  hud.setMoney(player.money);
  const t = state.bomb.state === 'planted' ? state.bomb.fuse : state.round.phaseTime;
  hud.setTimer(t);
  hud.setScore(state.round.score.vanguard, state.round.score.jackals);
  hud.setAlive(aliveActors(state, 'vanguard').length, aliveActors(state, 'jackals').length);
  hud.setRound(Math.max(1, state.round.number));
  hud.setCrosshair(6 + combat.spreadFor(player) * 3000);
  const b = state.bomb;
  if (b.state === 'planted') hud.setBomb(`BOMB PLANTED — ${Math.ceil(b.fuse)}s`, 'hot');
  else if (b.state === 'detonated') hud.setBomb('DETONATED', 'hot');
  else if (b.state === 'defused') hud.setBomb('DEFUSED', '');
  else if (b.state === 'dropped') hud.setBomb('CHARGE DROPPED — recover it', 'hot');
  else if (b.carrierId === player.id) hud.setBomb('CHARGE — plant at A or B (hold E)', '');
  else {
    const c = actorById(state, b.carrierId);
    hud.setBomb(c ? `CHARGE — ${c.name} carries it` : 'CHARGE', '');
  }
}

function drainEvents() {
  for (const e of state.events) {
    if (e.type === 'shot') {
      const dx = e.x - player.pos.x, dz = e.z - player.pos.z;
      if (dx * dx + dz * dz < 2025) audio.shot(e.weapon);
    } else if (e.type === 'hit') {
      if (e.shooter === player.id) {
        hud.hitMarker(e.killed);
        audio.hit();
        if (e.killed) audio.kill();
      }
    } else if (e.type === 'kill') {
      const k = actorById(state, e.killer);
      const v = actorById(state, e.victim);
      if (k && v) hud.killFeed(`${k.name} ▸ ${v.name} [${WEAPONS[e.weapon] ? WEAPONS[e.weapon].name : e.weapon}]`);
      if (e.victim === player.id) {
        const mates = aliveActors(state, 'vanguard');
        spectate = mates.length ? mates[0] : null;
      }
    } else if (e.type === 'explosion') {
      audio.explosion();
      shakeT = Math.min(1, shakeT + 0.7);
    } else if (e.type === 'detonate') {
      effects.explosionFlash(tmpV.set(state.bomb.pos.x, 0.8, state.bomb.pos.z));
      shakeT = 1;
    } else if (e.type === 'beep') {
      audio.beep(e.final);
    } else if (e.type === 'plant' || e.type === 'planted') {
      audio.plant();
    } else if (e.type === 'defuse' || e.type === 'defused') {
      audio.defuse();
    } else if (e.type === 'reload') {
      if (e.actor === player.id) audio.reload();
    } else if (e.type === 'buy') {
      if (e.actor === player.id) audio.click();
    } else if (e.type === 'damage') {
      const dx = e.fromX - player.pos.x, dz = e.fromZ - player.pos.z;
      hud.damageFlash(Math.atan2(dx, dz) - player.yaw + Math.PI);
      shakeT = Math.min(1, shakeT + 0.25);
    } else if (e.type === 'roundEnd') {
      hud.banner(
        e.winner === 'vanguard' ? 'VANGUARD WIN' : 'JACKALS WIN',
        e.reason === 'elimination' ? 'Enemy team eliminated'
          : e.reason === 'detonation' ? 'Charge detonated'
            : e.reason === 'defuse' ? 'Charge defused'
              : e.reason === 'timeout' ? 'Time expired — site held' : e.reason,
      );
    } else if (e.type === 'matchEnd') {
      hud.showOverlay('match', { v: state.round.score.vanguard, j: state.round.score.jackals });
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }
  state.events.length = 0;
  for (const n of state.noise) bots.onNoise(n.x, n.z, n.team);
  state.noise.length = 0;
}

function step(dt) {
  rounds.step(dt);
  if (state.round.number !== lastRound) {
    lastRound = state.round.number;
    resetAmmoCache();
    bots.spawnRound();
  }
  if (player.alive) {
    playerObj.step(dt, input.state.keys);
    syncActor(player);
    const moved = Math.hypot(player.pos.x - lastFoot.x, player.pos.z - lastFoot.z);
    if (moved > 2.4) {
      lastFoot.copy(player.pos);
      if (player.onGround) audio.footstep();
    }
    if (input.state.eHeld) bomb.plantStep(player, dt);
    else bomb.plantStep(player, 0);
    combat.stepWeapon(player, dt);
    weapon.step(dt, player);
  }
  if (state.round.phase === 'live') bots.step(dt);
  for (const a of state.actors) {
    if (a.kind === 'bot' && a.alive) combat.stepWeapon(a, dt);
  }
  grenades.step(dt);
  bomb.update(dt);
  effects.step(dt);
  player.mesh.group.position.copy(player.pos);
  player.mesh.group.rotation.y = player.yaw;
  drainEvents();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    shakeT = Math.max(0, shakeT - dt * 1.4);
    const look = input.takeLook();
    if (player.alive) playerObj.look(look.x, look.y);
    const pressed = input.takePressed();
    if (!buyOpen && player.alive) {
      if (pressed.has('Digit1')) switchWeapon('p9');
      if (pressed.has('Digit2')) switchWeapon('vk7');
      if (pressed.has('Digit3')) switchWeapon('kx9');
      if (pressed.has('KeyG')) {
        camera.getWorldDirection(rayDir);
        if (grenades.throw(player, rayDir)) audio.click();
      }
    }
    if (pressed.has('KeyB')) {
      if (buyOpen) closeBuy(true);
      else openBuy();
    }
    if (pressed.has('KeyM')) {
      muted = !muted;
      audio.setMuted(muted);
      hud.setMuted(muted);
    }
    if (pressed.has('KeyR') && player.alive) combat.startReload(player);
    if (player.alive && input.state.firing && input.state.locked) {
      const w = WEAPONS[player.weapon];
      if (w.auto || !prevFiring) {
        if (player.mag > 0) shootPlayer(combat.spreadFor(player));
        else combat.startReload(player);
      }
    }
    prevFiring = input.state.firing;
    if (state.round.phase !== 'buy' && buyOpen) closeBuy(false);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncActor(player);
    syncCamera();
    weapon.setVisible(player.alive);
    syncHud();
  }
  world.dust.rotation.y += dt * 0.005;
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBanner();
  rounds.startRound(1);
  lastRound = 1;
  bots.spawnRound();
  syncActor(player);
  if (name === 'start') {
    player.mover.position.set(0, 0, 13);
    player.mover.yaw = 0;
    player.mover.pitch = 0;
    syncActor(player);
    settle(20);
    openBuy();
    syncHud();
  } else if (name === 'play') {
    player.mover.position.set(0, 0, 8);
    player.mover.yaw = 0;
    player.mover.pitch = 0;
    syncActor(player);
    // Stage two Jackals in the mid lane, facing the player, and one teammate.
    const jacks = state.actors.filter((a) => a.team === 'jackals');
    const mates = state.actors.filter((a) => a.kind === 'bot' && a.team === 'vanguard');
    const spots = [[0, 2], [3.5, -1]];
    jacks.slice(0, 2).forEach((j, i) => {
      j.mover.position.set(spots[i][0], 0, spots[i][1]);
      j.mover.velocity.set(0, 0, 0);
      syncActor(j);
      j.yaw = Math.atan2(-(player.pos.x - j.pos.x), -(player.pos.z - j.pos.z));
      j.mover.yaw = j.yaw;
      j.bot.state = 'hold';
      j.bot.holdUntil = 999;
      j.bot.thinkAt = 999;
      j.bot.path = [];
      j.bot.pathIdx = 0;
      j.mesh.group.position.copy(j.pos);
      j.mesh.group.rotation.y = j.yaw;
    });
    if (mates[0]) {
      mates[0].mover.position.set(-2.5, 0, 5);
      mates[0].mover.velocity.set(0, 0, 0);
      syncActor(mates[0]);
      mates[0].yaw = 0;
      mates[0].mover.yaw = 0;
      mates[0].bot.state = 'hold';
      mates[0].bot.holdUntil = 999;
      mates[0].bot.thinkAt = 999;
      mates[0].bot.path = [];
      mates[0].bot.pathIdx = 0;
      mates[0].mesh.group.position.copy(mates[0].pos);
      mates[0].mesh.group.rotation.y = 0;
    }
    // Force the round live so the HUD shows the timer running.
    state.round.phase = 'live';
    state.round.phaseTime = 87;
    // Player fires once at the first Jackal's head with the VK-7: kill, tracer.
    player.owned.vk7 = true;
    player.weapon = 'vk7';
    player.mag = WEAPONS.vk7.mag;
    player.reserve = WEAPONS.vk7.reserve;
    weapon.setWeapon('vk7');
    const target = jacks[0];
    tmpV.set(target.pos.x, target.pos.y + 1.53, target.pos.z);
    aimAt(tmpV);
    scene.updateMatrixWorld(true); // staged meshes need fresh matrices for the raycast
    shootPlayer(0);
    hud.hitMarker(true, 4000);
    syncHud();
  } else {
    // end: round won at Site A, two Jackals down, banner up.
    state.round.score.vanguard = 1;
    state.round.phase = 'ended';
    state.round.phaseTime = 4;
    const jacks = state.actors.filter((a) => a.team === 'jackals');
    jacks.slice(0, 2).forEach((j, i) => {
      j.alive = false;
      j.health = 0;
      j.mover.position.set(-10 + i * 3, 0, -7);
      syncActor(j);
      j.bot.fall = 1;
      j.mesh.group.position.set(j.pos.x, -0.08, j.pos.z);
      j.mesh.group.rotation.x = -1.45;
      j.mesh.group.rotation.y = 0;
    });
    player.mover.position.set(0, 0, 2);
    player.mover.yaw = 0.35;
    player.mover.pitch = 0;
    syncActor(player);
    hud.banner('VANGUARD WIN', 'Site A secured — charge detonated');
    syncHud();
  }
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
syncHud();
rounds.startRound(1);
lastRound = 1;
bots.spawnRound();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
