// Effects: pooled tracers, spark particles, one reusable explosion flash. No allocations in step().
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACERS = 24;
const TRACER_LIFE = 0.08;
const SPARKS = 256;
const SPARK_PER_HIT = 8;
const FLASH_TIME = 0.45;

export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < TRACERS; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, geo, mat, life: 0 });
  }
  let tracerIdx = 0;

  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i += 1) sparkPos[i * 3 + 1] = -999;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: new THREE.Color(PALETTE.accent), size: 0.05, transparent: true, opacity: 0.9, depthWrite: false }));
  sparkPts.frustumCulled = false;
  scene.add(sparkPts);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 18);
  flashLight.visible = false;
  scene.add(flashLight);
  const flashSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0, depthWrite: false }),
  );
  flashSphere.visible = false;
  scene.add(flashSphere);
  let flashT = 0;

  return {
    tracer(from, to, color) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % TRACERS;
      const p = t.geo.attributes.position.array;
      p[0] = from.x; p[1] = from.y; p[2] = from.z;
      p[3] = to.x; p[4] = to.y; p[5] = to.z;
      t.geo.attributes.position.needsUpdate = true;
      t.mat.color.set(color);
      t.mat.opacity = 1;
      t.line.visible = true;
      t.life = TRACER_LIFE;
    },
    spark(point, normal) {
      let n = 0;
      for (let i = 0; i < SPARKS && n < SPARK_PER_HIT; i += 1) {
        if (sparkLife[i] > 0) continue;
        const i3 = i * 3;
        sparkPos[i3] = point.x; sparkPos[i3 + 1] = point.y; sparkPos[i3 + 2] = point.z;
        sparkVel[i3] = normal.x * (3 + Math.random() * 4) + (Math.random() - 0.5) * 3;
        sparkVel[i3 + 1] = normal.y * (3 + Math.random() * 4) + Math.random() * 2;
        sparkVel[i3 + 2] = normal.z * (3 + Math.random() * 4) + (Math.random() - 0.5) * 3;
        sparkLife[i] = 0.4 + Math.random() * 0.3;
        n += 1;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
    explosionFlash(point) {
      flashLight.position.copy(point);
      flashSphere.position.copy(point);
      flashLight.visible = true;
      flashSphere.visible = true;
      flashT = FLASH_TIME;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) { t.line.visible = false; t.mat.opacity = 0; }
        else t.mat.opacity = t.life / TRACER_LIFE;
      }
      let anySpark = false;
      for (let i = 0; i < SPARKS; i += 1) {
        if (sparkLife[i] <= 0) continue;
        anySpark = true;
        sparkLife[i] -= dt;
        const i3 = i * 3;
        if (sparkLife[i] <= 0) { sparkPos[i3 + 1] = -999; continue; }
        sparkVel[i3 + 1] -= 9 * dt;
        sparkPos[i3] += sparkVel[i3] * dt;
        sparkPos[i3 + 1] += sparkVel[i3 + 1] * dt;
        sparkPos[i3 + 2] += sparkVel[i3 + 2] * dt;
      }
      if (anySpark) sparkGeo.attributes.position.needsUpdate = true;
      if (flashT > 0) {
        flashT -= dt;
        const k = Math.max(0, flashT / FLASH_TIME);
        flashLight.intensity = 80 * k;
        flashSphere.scale.setScalar(1 + (1 - k) * 7);
        flashSphere.material.opacity = 0.55 * k;
        if (flashT <= 0) { flashLight.visible = false; flashSphere.visible = false; flashLight.intensity = 0; }
      }
    },
  };
}
