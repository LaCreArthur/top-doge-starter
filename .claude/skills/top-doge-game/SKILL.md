---
name: top-doge-game
description: Turn a core gameplay into a Top Doge game, the brawl hub on the DogeOS testnet. Use when the user wants to make, port or plug a game into Top Doge, or asks how a Top Doge game is built.
---

# Make a Top Doge game

Top Doge runs brawls of 6 players on one level: the top 3 split the pot, in a free league and two paid ones (testnet
DOGE). A game brings only its gameplay. The platform runs everything else: the players and their avatar, the
leagues, the live board and the ghosts, the Demo for newcomers, and a server that replays every run from its
inputs, so a score cannot be faked.

## The folder

A game is one folder, `games/<name>/`:

- `index.ts` default-exports a `GameModule`: the rules. Pure and integer-only; the server replays it.
- `page.ts` default-exports a `Page`: what the player sees and touches (drawing, controls, its own start screen,
  sounds). The host around it runs the clock, steps the rules, stamps inputs and draws the live board.
- `bot.ts` default-exports a `Bot`: the house's player, which fills the empty seats.
- `meta.ts` (optional) default-exports `{ blurb, minutes }`: the hub card's line and a run's usual length.

Start from the starter, https://github.com/LaCreArthur/top-doge-starter: the tap game's three files to change, the
platform to play them in a browser (`npm run play`), and the replay check (`npm test`). Node 24 or later, nothing to
install. Without it, copy the tap game below. Import the contract as `@doge-brawl/shared/game`.

## The rules that get a game refused

1. `index.ts` is the same on every device: integers only, no `Math.random`, no `Date`, no time, no I/O. All luck
   comes from `part(key, index)`, the level data the server derives from its secret key.
2. `score(state)` is a whole number `>= 0`, and higher places first. A race scores `maxSteps` minus its steps.
3. At most one input a step. Declare every kind the game takes in `inputs`; the server refuses the others.
4. Change what a run does, bump `rules`: recorded runs name their rules version.
5. `page.ts` never writes the state it is given. The top-right corner belongs to the live board while it shows.
   In `look.mode === "check"` (a replay) the page takes no input and plays no sound.
6. The bot's inputs come from the parts it has been given, never from the key.

## Check it before handing it over

The rules must replay: the same key and inputs give the same score, twice. A test with no platform, beside the three
files:

```ts
import assert from "node:assert"
import type { GameModule, Input } from "@doge-brawl/shared/game"
import rules from "./index.ts"
import bot from "./bot.ts"

const game: GameModule<any, any> = rules
const play = (key: number) => {
  const s = game.init(), parts: any[] = [], inputs: Input[] = []
  for (let step = 0; step < game.maxSteps && !game.over(s); step++) {
    if (step % game.partSteps === 0) {
      parts.push(game.part(key, parts.length))
      inputs.push(...[...bot(parts, 1)].filter((i): i is Input => !!i && i.step >= step))
    }
    game.step(s, step, parts, inputs.filter((i) => i.step === step))
  }
  return game.score(s)
}
assert.equal(play(7), play(7), "the same run gives the same score")
assert.ok(Number.isInteger(play(7)) && play(7) >= 0, "the score is a whole number >= 0")
```

It is the starter's `replay.test.ts` (`npm test`; alone, `node replay.test.ts`): it fails on a `Math.random`, a clock or
any other luck outside the parts.

## Hand it over

Push the folder to a public repo and send its link to Arthur, Top Doge's maker, on Telegram: https://t.me/Cr3Arthur.
It gets a game id and a cover, and the hub reads its games from the folders: nothing else changes.

## The contract, `@doge-brawl/shared/game`

```ts
// The game contract: the only thing the server, the CLI, the hub and check my run know about a game.
// Each game is one folder, `v1/games/<name>/`; the list of games is read from the folders, so a new
// game touches only its own. A folder holds:
//   index.ts  default-exports a `GameModule`: the simulation, pure and integer only, that the server
//             replays from the inputs it timed. Its score is the only one that counts.
//   page.ts   default-exports a `Page`: the game's drawing, controls, lobby, countdown and sounds.
//             The host (shared/src/host.ts) runs the run around it: the clock and the stepping,
//             input stamping, the replay after a refused input, the live board, the ghosts, the modes.
//   bot.ts    default-exports a `Bot`, the house's player; may export `DEMO`, the Demo brawl's ghosts.
//   and optionally meta.ts (default export `{ blurb }`, the hub card's line), skins.ts (the game's
//   skins; the registry adds the game id and checks skin ids are unique), notes.ts (balancing notes,
//   shared/src/notes.ts) and dev.ts (its own flags on the dev page, shared/src/play.html).
// The smallest game that plays is shared/test/tap/. Its tests use the shared test kit
// (`shared/src/testkit.ts`), not their own browser or server. Changes to this file reach every game.
//
// A run, the same on the server and the page:
//   state = init(); for each step s < maxSteps until over(state):
//     step(state, s, parts so far, the inputs of step s)
//   score(state) is the result.
// The server sends part i (level data from the secret level key) ahead of the clock; the page
// simulates from the parts, never from the key.
// All of a game's luck comes from parts: spawns by time (a survivor wave) are in the part of
// their steps; draws that depend on play (match-3 refills) are a fixed block per step in the part
// of that step (at most one input a step, so a move at step s takes block s and never a draw
// another step could have shown), never a running counter across parts.

type Slot = "hat" | "body" | "back" // the avatar's slots

export type InputKind ="tap" | "press" | "release" | "steer" | "pick"

// One player input, at the step it lands on, sent only when it changes; at most one a step (the
// page holds a second one to the next step).
// - steer: a stick. `value` is the heading 0..255 (0 = +x, counter-clockwise), `power` the push
//   0..255 (0 = the stick is let go).
// - pick: a choice the game defines in `value`, a whole number (a match-3 swap as cell * 4 +
//   direction, a level-up card). The game ignores a pick that is not legal now.
// - tap, press, release: `value` and `power` are 0.
export type Input = { step: number; kind: InputKind; value: number; power: number }

export type GameModule<State = unknown, Part = unknown> = {
  id: number // 10 Doge To Mars, 20 DogeBread, 30 Doge Hop
  name: string
  rules: number // the rules version; a recorded run names it and a mismatch is refused
  stepMs: number // the length of one step in ms (Doge To Mars 20, DogeBread 50)
  maxSteps: number // a run ends here at the latest
  partSteps: number // steps of level data in one part
  inputs: readonly InputKind[] // the kinds this game takes; others are refused
  maxInputs: number // inputs in one run; more ends the run's socket

  // Pure and integer only (no floats that differ between engines, no Math.random, no time):
  // the same arguments give the same result on every device.
  part(key: number, index: number): Part // level data for steps [index * partSteps, (index + 1) * partSteps)
  init(): State
  step(state: State, step: number, parts: readonly Part[], inputs: readonly Input[]): void
  over(state: State): boolean // the finish or a death
  score(state: State): number // a whole number >= 0, higher places first (a time to finish is maxSteps minus the steps)
  // A finished run's route, drawn as a ghost in the later runs of its brawl (the host's ghosts): numbers the
  // game defines, never the inputs, which stay hidden until the brawl is finished. `parts`: the brawl's level.
  trace?(inputs: readonly Input[], parts: readonly Part[]): number[]
  // Whether the player's unlocks allow this input (Survivor's leader pick names the weapons open); the server refuses
  // one they do not. The page shows the same unlocks from Look.player.
  allows?(input: Input, player: Player): boolean

  checks: {
    // The step whose shown data an input at `step` answers, for the reaction check.
    cue?(state: State, input: Input): number
  }
}

// What a player has earned on the platform, for a game's unlocks: the avatar level, and the finished runs and paid wins of this game.
export type Player = { level: number; runs: number; wins: number }

// A finished run of the brawl: its wallet's doge name (shared/crowd), its game's trace (empty for a game with none), its score (the
// server's; a game's own bots have none, their trace gives it), its wallet's wear (the server's) and the hub's still of it (face).
export type Ghost = { name: string; trace: number[]; score?: number; wear?: Look["wear"]; face?: string }

// The page side, in `v1/games/<name>/page.ts`. The rules of a page: the host owns the board's rows, the ghosts' list
// and the stamping; the top-right corner is the board's while it shows (a game hides it with { board: false }, never
// draws over it); a page never writes the state it is given, and copies what it keeps of it.

// What the game sees of the run, for its art only: Hop's lesson in the Demo, no sounds in a check. wear: the skin id
// worn in each slot of the player's avatar, drawn by the game; face: its still, the hub's drawing of it (an image URL)
// for the board, set once drawn; player: the wallet's unlocks (absent for a guest: the starters only). mode: a brawl's
// run (live), a practice (local, counts nowhere), the Demo (a newcomer's first run, against the game's DEMO), a check
// (a finished run's inputs replayed: the game takes no input). watch: a check's player name; pot: the Demo's pot.
export type Look = {
  wear: Partial<Record<Slot, number>>
  face?: string
  player?: Player
  mode: "run" | "practice" | "demo" | "check"
  watch?: string
  pot?: string
}

// When a frame is, on the run's clock. GO is step 0, at ms 0.
export type At = {
  step: number // the last step simulated; -1 before step 0 (the lobby, the countdown)
  ms?: number // wall-clock ms since GO, negative in the countdown; absent until the clock is known
  place: number // the player's place on the live board; 0 while it is hidden
  over: boolean // the run has ended: the hub draws its result on top from here
  score?: number // once over: the score that counts (the server's in a live run)
  rewound: boolean // the first frame after a refused input was replayed
}

// What a page may ask of the host: send an input (the host stamps its step), and leave (a game's own Leave).
export type Hub = { send(kind: InputKind, value?: number, power?: number): void; leave(): void }

export type Page<State = any, Part = any> = {
  preload?(wear: Look["wear"]): Promise<unknown> // assets, fetched before the run opens
  // One call a run, so the lobby and the run share their scene; destroy() when the player leaves the run screen.
  open(el: HTMLElement, look: Look, hub: Hub): {
    // The game's own start screen, never called in a check: resolves when the player is ready, with the inputs it
    // chose (their steps) and, in a local run, the wall-clock ms of GO when it already played into the run (Hop's
    // lesson). Rejects when the game cannot load. Absent: the run opens at once.
    lobby?(): Promise<void | { startsAt?: number; inputs: Input[] }>
    // After each step played, with its inputs: what a frame covering several steps would miss (a kill, an fx). During a
    // refused input's replay, replaying: keep what you keep, play no sound or fx.
    stepped?(state: Readonly<State>, step: number, inputs: readonly Input[], replaying: boolean): void
    // Each animation frame from open() on: the state (read only), the parts so far, the ghosts. { board: false } hides
    // the live board for this frame.
    frame(state: Readonly<State>, at: At, parts: readonly Part[], ghosts: readonly Ghost[]): void | { board: false }
    destroy(): void
  }
  // The live board: a ghost's score and whether its run has ended at this step, beside the player's run (Hop's ghosts
  // fly from the player's first tap; absent: its final score, not ended); how a score reads (absent: the number);
  // which ghosts show (absent: all).
  rival?(ghost: Ghost, step: number, parts: readonly Part[], state: Readonly<State>): { score: number; out: boolean }
  format?(score: number): string
  field?(ghosts: readonly Ghost[]): Ghost[]
}

// Bot side, in `v1/games/<name>/bot.ts`, for the house's seats: called each time a part arrives, it gives the inputs
// for the steps of the newest part (it may run the module to look ahead). `skill` 0..1 spreads the scores of a bot
// brawl. A slow bot gives them as it decides them (a generator), and undefined after a decision with no input, so the
// house yields between them: a long block would hold the runs its isolate also serves, and their inputs would arrive
// too late.
export type Bot<Part = unknown> = (parts: readonly Part[], skill: number) => Iterable<Input | undefined>
```

## The tap game: the smallest game that plays

The score is the taps in 3 seconds.

`index.ts`

```ts
import type { GameModule } from "@doge-brawl/shared/game"

export type State = { taps: number }

export default {
  id: 99,
  name: "Tap",
  rules: 1,
  stepMs: 50,
  maxSteps: 60,
  partSteps: 60,
  inputs: ["tap", "steer"],
  maxInputs: 60,
  part: () => 0,
  init: () => ({ taps: 0 }),
  step(s, _step, _parts, inputs) {
    s.taps += inputs.filter((i) => i.kind === "tap").length
  },
  over: () => false,
  score: (s) => s.taps,
  trace: (inputs) => inputs.map((i) => i.step),
  checks: {},
} satisfies GameModule<State, number>
```

`page.ts`

```ts
import type { Page } from "@doge-brawl/shared/game"
import type { State } from "./index.ts"

export default {
  open(el, look, hub) {
    const canvas = el.appendChild(document.createElement("canvas"))
    canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none"
    canvas.onpointerdown = () => hub.send("tap")
    const g = canvas.getContext("2d")!
    return {
      frame(s, at) {
        canvas.width = el.clientWidth
        canvas.height = el.clientHeight
        g.fillStyle = "#fff"
        g.font = "bold 64px system-ui"
        g.textAlign = "center"
        const text = at.ms === undefined || at.ms < 0 ? String(Math.ceil(-(at.ms ?? -3000) / 1000)) : String(at.score ?? s.taps)
        g.fillText(look.mode === "check" ? `${look.watch}: ${text}` : text, canvas.width / 2, canvas.height / 2)
      },
      destroy: () => canvas.remove(),
    }
  },
} satisfies Page<State, number>
```

`bot.ts`

```ts
import type { Bot } from "@doge-brawl/shared/game"

const bot: Bot<number> = function* (_parts, skill) {
  for (let step = 0; step < 60; step += Math.round(4 / Math.max(skill, 0.1))) yield { step, kind: "tap", value: 0, power: 0 }
}
export default bot
```
