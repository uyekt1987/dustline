// Audio: WebAudio only, all sounds synthesized. Lazy context in init(); every method
// no-ops before init or when muted.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let mutedFlag = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = mutedFlag ? 0 : 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, at = 0, slideTo = 0) {
    if (!ctx || mutedFlag) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function hiss(dur, freq = 1200, vol = 0.3, at = 0, type = 'bandpass') {
    if (!ctx || mutedFlag) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SHOTS = {
    p9: () => { hiss(0.08, 900, 0.35); tone(180, 0.09, 'sine', 0.35, 0, 70); },
    vk7: () => { hiss(0.12, 1800, 0.5); tone(120, 0.14, 'sine', 0.5, 0, 50); },
    kx9: () => { hiss(0.06, 2200, 0.35); tone(220, 0.06, 'square', 0.15, 0, 90); },
  };

  return {
    init,
    shot(id) { if (!ctx || mutedFlag) return; (SHOTS[id] || SHOTS.vk7)(); },
    reload() { hiss(0.04, 2500, 0.25); hiss(0.04, 1800, 0.25, 0.18); },
    hit() { tone(1200, 0.04, 'square', 0.15); },
    kill() { tone(880, 0.09, 'sine', 0.25); tone(1320, 0.14, 'sine', 0.25, 0.09); },
    explosion() {
      hiss(0.7, 300, 0.8, 0, 'lowpass');
      tone(90, 0.6, 'sine', 0.8, 0, 30);
    },
    beep(final) { tone(final ? 1320 : 880, final ? 0.12 : 0.07, 'sine', 0.25); },
    plant() { tone(660, 0.08, 'sine', 0.25); tone(880, 0.08, 'sine', 0.25, 0.1); tone(1100, 0.12, 'sine', 0.25, 0.2); },
    defuse() { tone(1100, 0.08, 'sine', 0.25); tone(880, 0.08, 'sine', 0.25, 0.1); tone(660, 0.12, 'sine', 0.25, 0.2); },
    footstep() { hiss(0.05, 400, 0.1, 0, 'lowpass'); },
    roundWin() { tone(523, 0.14, 'sine', 0.3); tone(659, 0.14, 'sine', 0.3, 0.14); tone(784, 0.3, 'sine', 0.3, 0.28); },
    roundLose() { tone(392, 0.14, 'sine', 0.3); tone(330, 0.14, 'sine', 0.3, 0.14); tone(262, 0.3, 'sine', 0.3, 0.28); },
    click() { tone(1000, 0.03, 'sine', 0.15); },
    setMuted(m) {
      mutedFlag = !!m;
      if (master) master.gain.value = mutedFlag ? 0 : 0.5;
    },
    muted() { return mutedFlag; },
  };
}
