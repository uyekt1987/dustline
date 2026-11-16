# DUSTLINE — Tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/uyekt1987/dustline/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/uyekt1987/dustline/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![threejs-fps-02](https://img.shields.io/badge/make.fun-threejs--fps--02-f0a830)](https://make.fun/bounty/threejs-fps-02)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-0.187.0-232a33)](https://threejs.org)

A round-based tactical first-person shooter in the browser, built on three.js.
Vanguard (you and four bots) plants the charge at Site A or Site B; Jackals
(five bots) hold the yard. Short rounds, money between rounds, a buy menu, and
gunfire where stopping to aim pays.

## How to play

Serve `game/` with any static server — `node serve.ts` serves it on
http://localhost:8080 — and open it in desktop Chrome.

- **Objective:** as Vanguard, carry the charge to Site A (Depot) or Site B
  (Yard) and hold **E** to plant it, then defend it until it detonates. Or
  eliminate the Jackals. Jackals win by eliminating Vanguard, running the
  clock out, or defusing a planted charge. First team to 5 round wins takes
  the match (max 9 rounds).
- **Economy:** start with 800 credits; kills pay 300, a round win 3250, a
  loss 1900. Press **B** during the buy phase to spend them.
- **Weapons:** P9 sidearm (free), VK-7 rifle ($2700), KX-9 SMG ($1800),
  frag grenade ($300). Headshots deal far more damage; firing on the move
  spreads your shots.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock) |
| Click | Fire |
| R | Reload |
| 1 / 2 / 3 | Pistol / Rifle / SMG |
| G | Throw grenade |
| B | Buy menu (buy phase) |
| E (hold) | Plant the charge |
| Ctrl / C | Crouch |
| Space | Jump |
| M | Mute |

## The game

- **Foundry Yard:** an original dusk-lit industrial yard — three lanes, two
  bomb sites, crates, containers, pipes and a gantry of cover, with sightlines
  worth holding and corners worth clearing.
- **Bots:** nine bots that route through the map, hold angles, react to
  gunfire, retake a planted site and defuse. They share the player's movement
  and hitscan code, so a fair fight is a fair fight.
- **Feel:** fixed 60 Hz simulation apart from rendering, recoil and spread
  that punish firing on the move, tracers, impact sparks, muzzle flash,
  screen shake, and fully synthesized WebAudio sounds — no assets, no network.
- **Screenshots:** `?shot=start|play|end&seed=1` stages deterministic frames
  for capture; `shots.json` lists the three shipped shots.

## Entry

Built for the make.fun bounty
[The best three.js tactical FPS](https://make.fun/bounty/threejs-fps-02).
`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`dossier.json` with the kit's vendored library.

[DUSTLINE on make.fun](https://make.fun/bounty/threejs-fps-02?ref=vkd54d79)
