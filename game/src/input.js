// Keyboard and mouse, and the pointer lock that turns the mouse into look. Plain browser
// APIs only. Adds a pressed-key queue (takePressed) and KeyE hold state.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  let pressed = new Set();
  const state = { keys, pressed, locked: false, firing: false, lookX: 0, lookY: 0, eHeld: false };

  function setKey(event, down) {
    if (down) {
      if (!event.repeat) pressed.add(event.code);
      keys.add(event.code);
    } else keys.delete(event.code);
    if (event.code === 'KeyE') state.eHeld = keys.has('KeyE');
    if (event.code === 'Space') event.preventDefault();
  }

  window.addEventListener('keydown', (event) => setKey(event, true));
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => {
    keys.clear();
    pressed.clear();
    state.eHeld = false;
    state.firing = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (state.locked && event.button === 0) state.firing = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      pressed.clear();
      state.eHeld = false;
      state.firing = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    takePressed() {
      const out = pressed;
      pressed = new Set();
      state.pressed = pressed;
      return out;
    },
    requestLock() {
      canvas.requestPointerLock();
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
  };
}
