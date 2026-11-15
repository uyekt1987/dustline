// Movement ported verbatim from starter player.js: accel, friction, gravity,
// crouch and jump, resolved as a box against the world colliders one axis at a
// time. Only the input differs: step takes a world-space wish vector.
import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

export function createMover(colliders, x, z, yaw) {
  const m = {
    position: new THREE.Vector3(x, 0, z),
    velocity: new THREE.Vector3(),
    yaw, pitch: 0, eye: STAND_EYE, height: STAND_HEIGHT, crouching: false, onGround: true,
  };
  const probe = new THREE.Box3();

  // lift keeps feet and crown out of the horizontal tests, so standing on the
  // floor is not read as walking into a wall.
  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (const c of colliders) if (probe.intersectsBox(c)) return c;
    return null;
  }

  function step(dt, wishX, wishZ, jump, crouch) {
    if (crouch && !m.crouching) {
      m.crouching = true;
      m.height = CROUCH_HEIGHT;
    } else if (!crouch && m.crouching && !overlaps(m.position.x, m.position.y, m.position.z, STAND_HEIGHT, 0.02)) {
      m.crouching = false;
      m.height = STAND_HEIGHT;
    }
    const eyeTarget = m.crouching ? CROUCH_EYE : STAND_EYE;
    m.eye += (eyeTarget - m.eye) * Math.min(1, dt * 12);

    let wx = wishX, wz = wishZ;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    const speed = m.crouching ? CROUCH_SPEED : WALK_SPEED;
    const blend = Math.min(1, (m.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    m.velocity.x += (wx * speed - m.velocity.x) * blend;
    m.velocity.z += (wz * speed - m.velocity.z) * blend;
    if (m.onGround && !wl) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      m.velocity.x *= damp;
      m.velocity.z *= damp;
    }

    if (jump && m.onGround) {
      m.velocity.y = JUMP_SPEED;
      m.onGround = false;
    }
    m.velocity.y -= GRAVITY * dt;

    const nextX = m.position.x + m.velocity.x * dt;
    if (!overlaps(nextX, m.position.y, m.position.z, m.height, 0.04)) m.position.x = nextX;
    else m.velocity.x = 0;
    const nextZ = m.position.z + m.velocity.z * dt;
    if (!overlaps(m.position.x, m.position.y, nextZ, m.height, 0.04)) m.position.z = nextZ;
    else m.velocity.z = 0;

    m.position.y += m.velocity.y * dt;
    m.onGround = false;
    const hit = overlaps(m.position.x, m.position.y, m.position.z, m.height, 0);
    if (hit && m.velocity.y <= 0) {
      m.position.y = hit.max.y;
      m.velocity.y = 0;
      m.onGround = true;
    } else if (hit) {
      m.position.y = hit.min.y - m.height;
      m.velocity.y = 0;
    }
    if (m.position.y < 0) {
      m.position.y = 0;
      m.velocity.y = 0;
      m.onGround = true;
    }
    m.velocity.y = Math.max(-30, m.velocity.y);
  }

  function look(dx, dy, sensitivity = 0.0022) {
    m.yaw -= dx * sensitivity;
    m.pitch = Math.max(-1.45, Math.min(1.45, m.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    m.pitch = Math.min(1.45, m.pitch + pitchKick);
    m.yaw += yawKick;
  }

  m.step = step;
  m.look = look;
  m.recoil = recoil;
  m.groundSpeed = () => Math.hypot(m.velocity.x, m.velocity.z);
  return m;
}
