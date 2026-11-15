// Player: thin wrapper around createMover. Movement constants and collision live in
// mover.js; this file only turns the key set into a world-space wish vector.
import * as THREE from 'three';
import { createMover } from './mover.js';

export function createPlayer(colliders, x = 0, z = 9.5, yaw = 0) {
  const mover = createMover(colliders, x, z, yaw);
  const wish = new THREE.Vector3();

  function step(dt, keys) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(mover.yaw);
      const cos = Math.cos(mover.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }
    const jump = keys.has('Space');
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    mover.step(dt, wish.x, wish.z, jump, crouch);
  }

  return {
    state: mover,
    step,
    look(dx, dy) { mover.look(dx, dy); },
    recoil(pitchKick, yawKick) { mover.recoil(pitchKick, yawKick); },
    groundSpeed() { return mover.groundSpeed(); },
  };
}
