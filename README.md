# ROADWARD — draw the road the dark must walk

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/zxpast/makefun-best-game-01-r3/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/zxpast/makefun-best-game-01-r3/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A tower-defense survival game for make.fun's best-game-01 bounty (round 3).

## The one idea

Every night you draw the road the enemy must walk. A longer road keeps foes under your lanterns longer, but every extra bend costs embers you could have spent on lanterns.

## How to play

- Hold the Last Lantern through 10 nights. Bosses rise on night 5 (Murk Herald) and night 10 (The Gloam King, 3 phases).
- Drag from the gate to the beacon to draw the road. The first 16 cells are free; each cell after that costs 1 ember. Redrawing refunds the old road.
- 1-6 pick a lantern, click a plot beside the road to build it. 6 lantern kinds: Ember Spitter, Cinder Sniper, Frost Wisp, Splash Brazier, Dawn Bell, Moonpetal Cannon. The beacon lights at most 24 lanterns.
- U upgrades a selected lantern to Lv 3, X sells it back for 60%.
- Space starts the night. Between nights, pick 1 of 3 boons (reroll once for 15 embers).
- Survive night 10 to win, then keep going in endless nights.
- 3 difficulties: Ember, Blaze, Inferno. F toggles 1x/2x speed, M mutes, P pauses, R restarts, Esc deselects.
- 6 enemy kinds, including wisps that ignore frost and spitters that shoot your lanterns. WebAudio synth sound, screen shake, hit-stop, particles, floating rewards.

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Open `game/index.html` in desktop Chrome. No build step and no network: every script, image and sound is a file under `game/` or synthesized at runtime.

## Verify it (headless)

```sh
# autopilot plays full games on all 3 difficulties and prints the result
node test/sim-test.mjs
# render the 4 screenshots with the game's own draw code (no browser needed)
node shots/render-shots.mjs
# build the submission dossier
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The autopilot wins 11 of 12 games on Ember, 9 of 12 on Blaze and 10 of 12 on Inferno across seeds 1-12. Deterministic: the same seed always plays the same game.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
