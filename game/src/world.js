// "Foundry Yard": 36 x 32 m, Site A Depot NW, Site B Yard NE, three lanes.
// Procedural canvas textures, dusk lighting, dust motes, waypoint graph.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function canvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function concreteDraw(ctx, w, h) {
  ctx.fillStyle = PALETTE.surface; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(232,228,216,0.05)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
  }
}

function hazardDraw(ctx, w, h) {
  ctx.fillStyle = PALETTE.hazard; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#161a21';
  for (let x = -h; x < w + h; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 16 + h, h); ctx.lineTo(x + h, h); ctx.closePath(); ctx.fill();
  }
}

function metalDraw(ctx, w, h) {
  ctx.fillStyle = PALETTE.hairline; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 0, w, h / 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (const [x, y] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]) {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
  }
}

function letterTex(letter) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(240,168,48,0.92)';
    ctx.font = '900 190px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, w / 2, h / 2 + 8);
    ctx.strokeStyle = 'rgba(22,26,33,0.9)'; ctx.lineWidth = 6;
    ctx.strokeText(letter, w / 2, h / 2 + 8);
  }, 1, 1);
}

// [x, z, w, d, h, kind] — crates 1.1 (crouch cover), containers 2.6 (block sight).
const COVER = [
  [-15.5, 6, 2.4, 1.2, 2.6, 'box'], [-13, 2, 1.2, 1.2, 1.1, 'crate'],
  [-13, -6, 1.2, 1.2, 1.1, 'crate'], [-9, 8, 1.2, 1.2, 1.1, 'crate'],
  [-4, 10, 3, 1.2, 2.6, 'box'], [0, -2, 1.2, 1.2, 1.1, 'crate'],
  [3, 4, 3, 1.2, 2.6, 'box'], [6, 8, 1.2, 1.2, 1.1, 'crate'],
  [13, 2, 1.2, 1.2, 1.1, 'crate'], [13, -6, 1.2, 1.2, 1.1, 'crate'],
  [15.5, -2, 1.2, 2.4, 2.6, 'box'], [-5.5, 2, 1.2, 1.2, 1.1, 'crate'],
  [5, -2.5, 1.2, 1.2, 1.1, 'crate'], [-14.5, -11, 1.2, 2.4, 2.6, 'box'],
  [-8.5, -11.5, 1.2, 1.2, 1.1, 'crate'], [-9, -6.8, 1.2, 1.2, 1.1, 'crate'],
  [14.5, -11, 1.2, 2.4, 2.6, 'box'], [8.5, -11.5, 1.2, 1.2, 1.1, 'crate'],
  [9, -6.8, 1.2, 1.2, 1.1, 'crate'], [-8, -9, 0.8, 0.8, 3.4, 'pillar'],
  [8, -9, 0.8, 0.8, 3.4, 'pillar'], [-6.5, 8, 0.8, 0.8, 3.4, 'pillar'],
  [6.5, 8, 0.8, 0.8, 3.4, 'pillar'], [-4, -12, 3, 1.2, 2.6, 'box'],
  [4, -12, 3, 1.2, 2.6, 'box'],
];

// Waypoints: 3 lanes x 7 rows, plus sites, entrances, connectors. 29 nodes.
const NODES = [
  [-13, 13], [0, 13], [13, 13], [-13, 8], [0, 8], [13, 8],
  [-13, 4], [0, 4], [13, 4], [-13, 0], [0, 0], [13, 0],
  [-13, -4], [0, -4], [13, -4], [-13, -8], [0, -8], [13, -8],
  [-13, -12], [0, -12], [13, -12],
  [-11, -9], [11, -9], [-11, -6], [11, -6],
  [-6.5, 0], [6.5, 0], [-6.5, -4], [6.5, -4],
];
const EDGES = [
  [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [9, 10], [10, 11],
  [12, 13], [13, 14], [15, 16], [16, 17], [18, 19], [19, 20],
  [0, 3], [3, 6], [6, 9], [9, 12], [12, 15], [15, 18],
  [1, 4], [4, 7], [7, 10], [10, 13], [13, 16], [16, 19],
  [2, 5], [5, 8], [8, 11], [11, 14], [14, 17], [17, 20],
  [21, 15], [21, 16], [21, 23], [22, 17], [22, 16], [22, 24],
  [23, 12], [23, 13], [24, 14], [24, 13],
  [25, 9], [25, 10], [26, 11], [26, 10], [27, 12], [27, 13], [28, 14], [28, 13],
];

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];
  const group = new THREE.Group();
  scene.add(group);
  scene.fog = new THREE.Fog(new THREE.Color('#2a3242'), 18, 48);

  const concrete = canvasTex(256, 256, concreteDraw, 9, 8);
  const hazard = canvasTex(128, 128, hazardDraw, 1, 1);
  const metal = canvasTex(128, 128, metalDraw, 6, 1);
  const groundMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95, metalness: 0 });
  const wallMat = new THREE.MeshStandardMaterial({ map: metal, roughness: 0.7, metalness: 0.35 });
  const crateMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.rust), roughness: 0.85, metalness: 0.1 });
  const boxMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.6, metalness: 0.5 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface), roughness: 0.7, metalness: 0.4 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.8 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 32), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  function box(x, z, w, d, h, mat, y0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, (y0 || 0) + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, y0 || 0, z - d / 2),
      new THREE.Vector3(x + w / 2, (y0 || 0) + h, z + d / 2)));
    shootables.push(mesh);
    return mesh;
  }

  // Walls, 4.6 high. Hazard skirt along the base.
  box(0, -16.2, 37.6, 0.8, 4.6, wallMat);
  box(0, 16.2, 37.6, 0.8, 4.6, wallMat);
  box(-18.2, 0, 0.8, 32.8, 4.6, wallMat);
  box(18.2, 0, 0.8, 32.8, 4.6, wallMat);
  box(0, -15.75, 36, 0.1, 0.5, hazardMat, 0);
  box(0, 15.75, 36, 0.1, 0.5, hazardMat, 0);

  for (const [x, z, w, d, h, kind] of COVER) {
    box(x, z, w, d, h, kind === 'crate' ? crateMat : kind === 'pillar' ? pillarMat : boxMat);
  }

  // Pipes along the west/east walls, 2.2 m up.
  const pipeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.rust), roughness: 0.5, metalness: 0.6 });
  for (const x of [-17.6, 17.6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16, 12), pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 2.2, 0);
    pipe.castShadow = true;
    group.add(pipe);
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - 0.4, 0, -8), new THREE.Vector3(x + 0.4, 2.6, 8)));
    shootables.push(pipe);
  }

  // Site letters on the ground + wall signs.
  const sites = {
    A: { center: new THREE.Vector3(-11, 0, -9), box: new THREE.Box3(new THREE.Vector3(-14, 0, -12), new THREE.Vector3(-8, 3, -6)) },
    B: { center: new THREE.Vector3(11, 0, -9), box: new THREE.Box3(new THREE.Vector3(8, 0, -12), new THREE.Vector3(14, 3, -6)) },
  };
  for (const key of ['A', 'B']) {
    const s = sites[key];
    const paint = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: letterTex(key), transparent: true, depthWrite: false }));
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(s.center.x, 0.02, s.center.z);
    group.add(paint);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: letterTex(key), transparent: true }));
    sign.position.set(s.center.x, 2.6, -15.75);
    group.add(sign);
  }

  // Dusk lighting: warm amber key from the SW, cool blue fill, hemisphere.
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb36b'), 2.4);
  sun.position.set(-14, 18, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(new THREE.Color('#6f87b8'), 0.75);
  fill.position.set(12, 10, -14);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(new THREE.Color('#7a86b8'), new THREE.Color('#3a2f28'), 1.0));

  // Dust motes, ~200 points; main.js drifts them in render.
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(200 * 3);
  for (let i = 0; i < 200; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * 17;
    dustPos[i * 3 + 1] = 0.2 + Math.random() * 3.8;
    dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * 15;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: new THREE.Color(PALETTE.accent), size: 0.06, transparent: true, opacity: 0.5, sizeAttenuation: true,
  }));
  group.add(dust);

  // Waypoint graph.
  const nodes = NODES.map(([x, z], id) => ({ id, x, z }));
  const edges = EDGES;
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }

  function nearestNode(x, z) {
    let best = 0, bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  function findPath(a, b) {
    if (a === b) return [a];
    const prev = new Map([[a, -1]]);
    const q = [a];
    while (q.length) {
      const cur = q.shift();
      if (cur === b) break;
      for (const nb of adj[cur]) {
        if (!prev.has(nb)) { prev.set(nb, cur); q.push(nb); }
      }
    }
    if (!prev.has(b)) return [];
    const path = [];
    let cur = b;
    while (cur !== -1) { path.push(cur); cur = prev.get(cur); }
    return path.reverse();
  }

  // Line of sight: one shared raycaster, a hit short of the target blocks.
  const ray = new THREE.Raycaster();
  const _o = new THREE.Vector3();
  const _d = new THREE.Vector3();
  function los(ax, ay, az, bx, by, bz) {
    _o.set(ax, ay, az);
    _d.set(bx - ax, by - ay, bz - az);
    const dist = _d.length();
    if (dist < 0.001) return true;
    _d.divideScalar(dist);
    ray.set(_o, _d);
    ray.far = dist;
    return ray.intersectObjects(shootables, false).length === 0;
  }

  const spawns = {
    vanguard: [-8, -4, 0, 4, 8].map((x) => ({ x, z: 13, yaw: 0 })),
    jackals: [-8, -4, 0, 4, 8].map((x) => ({ x, z: -13, yaw: Math.PI })),
  };

  return {
    colliders, shootables, group,
    waypoints: { nodes, edges },
    sites, spawns, dust, los, nearestNode, findPath,
    bounds: { minX: -18, maxX: 18, minZ: -16, maxZ: 16 },
  };
}
