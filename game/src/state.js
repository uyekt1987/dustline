// One state store for the whole sim. Actors are created by main.js.
import * as THREE from 'three';

export function createState(random) {
  return {
    time: 0,
    random,
    round: {
      number: 0, phase: 'buy', phaseTime: 0,
      score: { vanguard: 0, jackals: 0 }, winsNeeded: 5, maxRounds: 9,
      winner: null, reason: '',
    },
    actors: [],
    bomb: {
      state: 'carried', site: null, carrierId: null,
      plantProgress: 0, defuseProgress: 0, fuse: 0, pos: new THREE.Vector3(),
    },
    events: [],
    noise: [],
    feed: [],
    settings: { muted: false },
  };
}

export function aliveActors(state, team) {
  return state.actors.filter((a) => a.alive && (!team || a.team === team));
}

export function actorById(state, id) {
  for (const a of state.actors) if (a.id === id) return a;
  return null;
}

export function enemiesOf(state, actor) {
  return state.actors.filter((a) => a.alive && a.team !== actor.team);
}
