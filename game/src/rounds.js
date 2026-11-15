// Round state machine: buy 15s / live 100s / ended 4s / match (first to 5, max 9).
// Economy: win +3250, loss +1900. The player is always the bomb carrier.
import { WEAPONS } from './combat.js';
import { actorById } from './state.js';

export const GRENADE_PRICE = 300;
export const AMMO_PRICE = 200;

const BUY_SECONDS = 15;
const LIVE_SECONDS = 100;
const END_SECONDS = 4;
const WIN_BONUS = 3250;
const LOSS_BONUS = 1900;

const PRICES = { vk7: 2700, kx9: 1800, grenade: GRENADE_PRICE, ammo: AMMO_PRICE };

export function createRounds(state, bomb, audio, world) {
  const r = state.round;

  function player() {
    for (const a of state.actors) if (a.kind === 'player') return a;
    return null;
  }

  function aliveCount(team) {
    let n = 0;
    for (const a of state.actors) if (a.alive && a.team === team) n++;
    return n;
  }

  function startRound(n) {
    if (r.phase === 'match') return;
    r.number = n; r.phase = 'buy'; r.phaseTime = BUY_SECONDS; r.reason = '';
    let vi = 0, ji = 0;
    for (const a of state.actors) {
      a.alive = true; a.health = 100; a.cooldown = 0; a.reloadLeft = 0; a.carrier = false;
      const def = WEAPONS[a.weapon] || WEAPONS.p9;
      a.mag = def.mag; a.reserve = def.reserve; a.grenades = 0;
      if (world) {
        const list = a.team === 'vanguard' ? world.spawns.vanguard : world.spawns.jackals;
        const s = list[(a.team === 'vanguard' ? vi++ : ji++) % list.length];
        a.mover.position.set(s.x, 0, s.z);
        a.mover.velocity.set(0, 0, 0);
        a.mover.yaw = s.yaw; a.mover.pitch = 0;
        a.pos.copy(a.mover.position);
        a.yaw = s.yaw; a.pitch = 0;
      }
    }
    const p = player();
    bomb.reset(p ? p.id : null);
    if (p) p.carrier = true;
    state.events.push({ type: 'roundStart', n });
  }

  function endRound(winner, reason) {
    if (r.phase === 'ended' || r.phase === 'match') return;
    r.score[winner] += 1;
    r.reason = reason;
    for (const a of state.actors) a.money += a.team === winner ? WIN_BONUS : LOSS_BONUS;
    state.events.push({ type: 'roundEnd', winner, reason });
    if (audio) {
      if (winner === 'vanguard') audio.roundWin();
      else audio.roundLose();
    }
    if (r.score[winner] >= r.winsNeeded || r.number >= r.maxRounds) {
      r.phase = 'match';
      r.winner = r.score.vanguard > r.score.jackals ? 'vanguard' : 'jackals';
      state.events.push({ type: 'matchEnd', winner: r.winner });
    } else {
      r.phase = 'ended';
      r.phaseTime = END_SECONDS;
    }
  }

  function step(dt) {
    state.time += dt;
    if (r.phase === 'match') return;
    r.phaseTime -= dt;
    if (r.phase === 'buy') {
      if (r.phaseTime <= 0) { r.phase = 'live'; r.phaseTime = LIVE_SECONDS; }
      return;
    }
    if (r.phase === 'ended') {
      if (r.phaseTime <= 0) startRound(r.number + 1);
      return;
    }
    if (r.phase !== 'live') return;
    // Carrier died: drop the bomb (bomb.js exposes the drop).
    if (bomb.state === 'carried' && bomb.carrierId) {
      const c = actorById(state, bomb.carrierId);
      if (!c || !c.alive) bomb.onCarrierDeath();
    }
    if (aliveCount('vanguard') === 0) { endRound('jackals', 'elimination'); return; }
    if (aliveCount('jackals') === 0) { endRound('vanguard', 'elimination'); return; }
    if (bomb.state === 'detonated') { endRound('vanguard', 'detonation'); return; }
    if (bomb.state === 'defused') { endRound('jackals', 'defuse'); return; }
    // Timer out with a plant live: the fuse decides, so keep playing.
    if (r.phaseTime <= 0 && bomb.state !== 'planted') endRound('jackals', 'timeout');
  }

  function buy(actor, item) {
    if (r.phase !== 'buy' || !(item in PRICES)) return false;
    const price = PRICES[item];
    if (actor.money < price) return false;
    if (item === 'vk7' || item === 'kx9') {
      actor.weapon = item;
      actor.mag = WEAPONS[item].mag;
      actor.reserve = WEAPONS[item].reserve;
    } else if (item === 'grenade') {
      actor.grenades += 1;
    } else if (item === 'ammo') {
      actor.reserve = WEAPONS[actor.weapon].reserve;
    }
    actor.money -= price;
    state.events.push({ type: 'buy', actor: actor.id, item });
    return true;
  }

  return { startRound, endRound, step, buy };
}
