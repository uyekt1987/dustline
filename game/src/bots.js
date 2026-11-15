// 9-bot AI: routes, vision + reaction + bursts, hearing, hold/retake/defuse.
// Bots never plant — the player is always the carrier; Vanguard bots cover.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './combat.js';
import { GRENADE_PRICE } from './rounds.js';

const EYE = 1.55;
const SITE_NODE = { A: 21, B: 22 };
const HOLD_NODES = { A: [15, 23], B: [17, 24] };
const ROAM_NODES = [7, 10, 13, 16];

const _eye = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

function botDefaults() {
  return {
    state: 'advance', path: [], pathIdx: 0, holdUntil: 0, targetId: null,
    lastSeen: 0, reaction: 0, aimErr: 0, burstLeft: 0, burstPause: 0,
    route: 'mid', thinkAt: 0, fall: 0, holdSite: null, roamIdx: 0, investigateUntil: 0,
  };
}

export function createBots(scene, world, state, combat, random, bomb) {
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeo = new THREE.SphereGeometry(0.155, 16, 12);
  const gunGeo = new THREE.BoxGeometry(0.08, 0.12, 0.62);
  const nodes = world.waypoints.nodes;

  function buildMesh(a) {
    const col = a.team === 'vanguard' ? PALETTE.ally : PALETTE.enemy;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.8 });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 1.0;
    const head = new THREE.Mesh(headGeo, dark);
    head.position.y = 1.53;
    const gun = new THREE.Mesh(gunGeo, dark);
    gun.position.set(0.18, 1.05, 0.3);
    torso.userData = { actor: a, part: 'torso' };
    head.userData = { actor: a, part: 'head' };
    g.add(torso, head, gun);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    a.mesh = { group: g, torso, head, gun };
  }

  function ensureBots() {
    for (const a of state.actors) {
      if (a.kind !== 'bot') continue;
      if (!a.bot) a.bot = botDefaults();
      else a.bot = Object.assign(botDefaults(), a.bot); // fill any missing fields
      if (!a.mesh) buildMesh(a);
    }
  }

  function setPath(a, destNode) {
    const from = world.nearestNode(a.pos.x, a.pos.z);
    a.bot.path = world.findPath(from, destNode);
    a.bot.pathIdx = 0;
  }

  function holdNodeFor(a) {
    if (a.team === 'jackals' && a.bot.holdSite === 'mid') {
      a.bot.roamIdx = (a.bot.roamIdx + 1) % ROAM_NODES.length;
      return ROAM_NODES[a.bot.roamIdx];
    }
    const site = a.team === 'jackals' ? a.bot.holdSite : a.bot.route;
    const list = HOLD_NODES[site] || HOLD_NODES.A;
    return list[Math.floor(random() * list.length)];
  }

  function siteFocus(a) {
    const site = bomb && bomb.state === 'planted' && bomb.site ? bomb.site : a.bot.route;
    return world.sites[site] ? world.sites[site].center : world.sites.A.center;
  }

  function faceToward(a, x, z) {
    a.yaw = Math.atan2(-(x - a.pos.x), -(z - a.pos.z));
    a.mover.yaw = a.yaw;
  }

  function spawnRound() {
    ensureBots();
    const teams = {
      vanguard: state.actors.filter((a) => a.kind === 'bot' && a.team === 'vanguard'),
      jackals: state.actors.filter((a) => a.kind === 'bot' && a.team === 'jackals'),
    };
    place(teams.vanguard, world.spawns.vanguard, ['A', 'A', 'A', 'B', 'B']);
    place(teams.jackals, world.spawns.jackals, ['A', 'A', 'B', 'B', 'mid']);
  }

  function place(list, spawns, routes) {
    const order = spawns.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const k = Math.floor(random() * (i + 1));
      const t = order[i]; order[i] = order[k]; order[k] = t;
    }
    list.forEach((a, i) => {
      const s = order[i % order.length];
      a.mover.position.set(s.x, 0, s.z);
      a.mover.velocity.set(0, 0, 0);
      a.mover.yaw = s.yaw; a.mover.pitch = 0;
      a.pos.copy(a.mover.position);
      a.yaw = s.yaw; a.pitch = 0;
      a.alive = true; a.health = 100; a.cooldown = 0; a.reloadLeft = 0; a.carrier = false;
      // Auto-buy: rifle, else SMG, else P9; grenade with what is left.
      const w = a.money >= WEAPONS.vk7.price ? 'vk7' : a.money >= WEAPONS.kx9.price ? 'kx9' : 'p9';
      a.weapon = w;
      a.mag = WEAPONS[w].mag; a.reserve = WEAPONS[w].reserve;
      a.money -= WEAPONS[w].price;
      if (a.money >= GRENADE_PRICE) { a.grenades = 1; a.money -= GRENADE_PRICE; }
      else a.grenades = 0;
      const b = a.bot;
      b.route = routes[i % routes.length];
      b.holdSite = b.route;
      b.state = 'advance'; b.path = []; b.pathIdx = 0; b.targetId = null;
      b.burstLeft = 0; b.burstPause = 0; b.reaction = 0; b.fall = 0; b.holdUntil = 0;
      b.thinkAt = state.time + random() * 0.15;
      a.mesh.group.rotation.set(0, 0, 0);
      a.mesh.group.position.copy(a.pos);
      if (a.team === 'vanguard') setPath(a, SITE_NODE[b.route]);
      else if (b.route === 'mid') setPath(a, ROAM_NODES[0]);
      else setPath(a, holdNodeFor(a));
    });
  }

  function visibleEnemy(a) {
    _eye.set(a.pos.x, a.pos.y + EYE, a.pos.z);
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    let best = null, bd = 40 * 40;
    for (const e of state.actors) {
      if (!e.alive || e.team === a.team) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      const d = Math.sqrt(d2) || 1;
      if ((dx * fx + dz * fz) / d < 0.5) continue; // outside ~60 deg half-FOV
      if (!world.los(_eye.x, _eye.y, _eye.z, e.pos.x, e.pos.y + 1.5, e.pos.z)) continue;
      best = e; bd = d2;
    }
    return best;
  }

  function think(a) {
    const b = a.bot;
    const seen = visibleEnemy(a);
    if (seen) {
      if (b.targetId !== seen.id) {
        b.targetId = seen.id;
        b.reaction = 0.25 + random() * 0.2;
      }
      b.lastSeen = state.time;
    } else if (b.targetId && state.time - b.lastSeen > 0.75) {
      b.targetId = null;
      b.burstLeft = 0;
    }

    const planted = bomb && bomb.state === 'planted';
    const pathDone = b.pathIdx >= b.path.length;
    if (planted) {
      // Vanguard defends the planted site; Jackals retake it.
      const site = bomb.site;
      const c = world.sites[site].center;
      const d2 = (a.pos.x - c.x) * (a.pos.x - c.x) + (a.pos.z - c.z) * (a.pos.z - c.z);
      if (d2 > 25 && (pathDone || b.state !== 'retake')) {
        b.state = 'retake';
        setPath(a, SITE_NODE[site]);
      } else if (d2 <= 25 && pathDone) {
        b.state = 'hold';
        b.holdUntil = state.time + 4;
      }
      return;
    }
    if (b.state === 'investigate') {
      if (pathDone) {
        if (state.time >= b.investigateUntil) { b.state = 'advance'; setPath(a, a.team === 'vanguard' ? SITE_NODE[b.route] : holdNodeFor(a)); }
        else b.holdUntil = state.time + 0.5;
      }
      return;
    }
    if (b.state === 'advance' && pathDone) {
      b.state = 'hold';
      b.holdUntil = state.time + 3 + random() * 3;
    } else if (b.state === 'hold' && state.time >= b.holdUntil && !b.targetId) {
      // Shift to a fresh angle near the same site.
      b.state = 'advance';
      setPath(a, a.team === 'vanguard' ? holdNodeFor(a) : holdNodeFor(a));
    }
  }

  function fireAt(a, target) {
    const b = a.bot;
    const dist = Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
    const head = random() < 0.25;
    const ty = target.pos.y + (head ? 1.53 : 1.0);
    b.aimErr = 0.012 + dist * 0.0009 + target.mover.groundSpeed() * 0.003;
    _dir.set(target.pos.x - a.pos.x, ty - (a.pos.y + EYE), target.pos.z - a.pos.z).normalize();
    _dir.x += (random() * 2 - 1) * b.aimErr;
    _dir.y += (random() * 2 - 1) * b.aimErr;
    _dir.z += (random() * 2 - 1) * b.aimErr;
    _dir.normalize();
    combat.tryFire(a, _dir, b.aimErr);
  }

  function act(a, dt) {
    const b = a.bot;
    if (!a.alive) {
      b.fall = Math.min(1, b.fall + dt / 0.4);
      a.mesh.group.rotation.x = -b.fall * 1.45;
      a.mesh.group.position.set(a.pos.x, -b.fall * 0.08, a.pos.z);
      return;
    }
    a.mesh.group.rotation.x = 0;

    // Defuse: Jackal at the planted bomb, no visible enemy.
    if (bomb && bomb.state === 'planted' && a.team === 'jackals' && !b.targetId) {
      const dx = bomb.pos.x - a.pos.x, dz = bomb.pos.z - a.pos.z;
      if (dx * dx + dz * dz < 2.25) {
        faceToward(a, bomb.pos.x, bomb.pos.z);
        bomb.defuseStep(a, dt);
        a.mover.step(dt, 0, 0, false, true);
        a.mesh.group.position.copy(a.pos);
        a.mesh.group.rotation.y = a.yaw;
        return;
      }
    }

    if (b.targetId) {
      const t = state.actors.find((e) => e.id === b.targetId);
      if (t && t.alive) {
        faceToward(a, t.pos.x, t.pos.z);
        if (b.reaction > 0) b.reaction -= dt;
        else if (b.burstPause > 0) b.burstPause -= dt;
        else if (b.burstLeft <= 0) b.burstLeft = 3 + Math.floor(random() * 3);
        else if (a.cooldown <= 0 && a.reloadLeft <= 0) {
          fireAt(a, t);
          b.burstLeft -= 1;
          if (b.burstLeft === 0) b.burstPause = 0.4 + random() * 0.5;
        }
        a.mover.step(dt, 0, 0, false, false);
        a.mesh.group.position.copy(a.pos);
        a.mesh.group.rotation.y = a.yaw;
        return;
      }
      b.targetId = null;
    }

    if (b.pathIdx < b.path.length) {
      const n = nodes[b.path[b.pathIdx]];
      const dx = n.x - a.pos.x, dz = n.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) { b.pathIdx += 1; }
      else {
        faceToward(a, n.x, n.z);
        a.mover.step(dt, dx / d, dz / d, false, false);
      }
    } else {
      // Hold: crouched, watching the site.
      const f = siteFocus(a);
      faceToward(a, f.x, f.z);
      a.mover.step(dt, 0, 0, false, true);
    }
    if (a.pos !== a.mover.position) a.pos.copy(a.mover.position);
    a.mesh.group.position.copy(a.pos);
    a.mesh.group.rotation.y = a.yaw;
  }

  function step(dt) {
    ensureBots();
    for (const a of state.actors) {
      if (a.kind !== 'bot') continue;
      if (a.alive && state.time >= a.bot.thinkAt) {
        a.bot.thinkAt = state.time + 0.15;
        think(a);
      }
      act(a, dt);
    }
  }

  function onNoise(x, z, team) {
    for (const a of state.actors) {
      if (a.kind !== 'bot' || !a.alive || a.team === team) continue;
      const b = a.bot;
      if (b.targetId || b.state === 'retake') continue;
      const dx = a.pos.x - x, dz = a.pos.z - z;
      if (dx * dx + dz * dz > 625) continue; // 25 m
      b.state = 'investigate';
      b.investigateUntil = state.time + 4;
      setPath(a, world.nearestNode(x, z));
    }
  }

  return { spawnRound, step, onNoise };
}
