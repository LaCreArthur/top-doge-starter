// A run of any game, the same on the server, the page, the bots and the replay of a finished brawl:
// the loop of `game.ts`, fed step by step, from the level key (server, replay) or from the parts a
// player was shown (page, bot).
import type { GameModule, Input, InputKind } from "./game.ts"

export type AnyGame = GameModule<any, any>

// A run's length on the server's clock: the countdown, the steps, and the time an input may arrive late.
export const COUNTDOWN_MS = 3000
// An input may arrive this long after its step, a round trip after the server's: the page's clock starts when
// "ready" reaches it. A Wi-Fi link holds a message up to about half a second (seen on testnet: 0 to 6 of 3600
// inputs a run past 400 ms, a round trip of up to 491 ms); a link with 450 ms each way lost every tap of a Mars
// run at 800 ms). The host drops a refused input and replays the run without it (host.ts refused).
export const LATE_MS = 2000
export const SUBMIT_MARGIN_MS = 60_000 // time left after a run to send the score before the brawl expires
export const runMs = (g: AnyGame) => COUNTDOWN_MS + g.maxSteps * g.stepMs + LATE_MS
// The steps the server plays: the game's own, or fewer under a test cap on the run's length.
export const playedSteps = (g: AnyGame, env: { MAX_RUN_MS?: string }) => Math.min(g.maxSteps, Math.floor(Number(env.MAX_RUN_MS ?? Infinity) / g.stepMs))

export const KINDS: readonly InputKind[] = ["tap", "press", "release", "steer", "pick"] // the byte of each kind in a packed run
// The public level of each game, its parts part(PRACTICE_KEY, i): practice and the Demo fly it. A brawl and the free
// league fly sealed levels (level.ts).
export const PRACTICE_KEY = 0
// A bot's inputs (game.ts Bot), its pauses dropped.
export const botInputs = (it: Iterable<Input | undefined>): Input[] => [...it].filter((x) => x !== undefined)

export type Play = ReturnType<typeof play>

// `partOf(i)` gives part i; each is asked once. `next(inputs)` plays the current step with its
// inputs. `cues[n]` is the cue of the n-th input fed.
export function play(g: AnyGame, partOf: (index: number) => unknown) {
  const state = g.init()
  const parts: unknown[] = []
  const cues: (number | undefined)[] = []
  let step = 0
  return {
    state,
    cues,
    get step() {
      return step
    },
    part(i: number) {
      while (parts.length <= i) parts.push(partOf(parts.length))
      return parts[i]
    },
    over: () => step >= g.maxSteps || g.over(state),
    next(inputs: readonly Input[]) {
      this.part(Math.floor(step / g.partSteps))
      for (const i of inputs) cues.push(g.checks.cue?.(state, i))
      g.step(state, step, parts.slice(0, Math.floor(step / g.partSteps) + 1), inputs)
      step++
    },
  }
}

// Plays every remaining step with the inputs from `from` on; returns how many it used.
export function finish(p: Play, inputs: readonly Input[], from = 0): number {
  let n = from
  while (!p.over()) {
    const at = []
    while (n < inputs.length && inputs[n].step === p.step) at.push(inputs[n++])
    p.next(at)
  }
  return n
}

// The largest value and power of each kind: a heading and a push, a choice the game defines.
const MAX: Record<InputKind, [number, number]> = { tap: [0, 0], press: [0, 0], release: [0, 0], steer: [255, 255], pick: [65535, 0] }
const whole = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max

// Inputs must be whole, strictly rising steps inside the run, of a kind the game takes.
export function checkInput(g: AnyGame, i: Input, last = -1): string | undefined {
  if (!Number.isSafeInteger(i.step) || i.step < 0 || i.step >= g.maxSteps) return "bad step"
  if (!g.inputs.includes(i.kind)) return "bad kind"
  if (!whole(i.value, MAX[i.kind][0]) || !whole(i.power, MAX[i.kind][1])) return "bad value"
  if (i.step <= last) return "not after the last input"
}


export function replay(g: AnyGame, partOf: (index: number) => unknown, inputs: readonly Input[]) {
  if (inputs.length > g.maxInputs) throw new Error("too many inputs")
  inputs.forEach((i, n) => {
    const why = checkInput(g, i, inputs[n - 1]?.step)
    if (why) throw new Error(`${why}: ${JSON.stringify(i)}`)
  })
  const p = play(g, partOf)
  if (finish(p, inputs) < inputs.length) throw new Error("inputs after the end of the run")
  return { score: g.score(p.state) as number, steps: p.step, cues: p.cues, state: p.state }
}

// 6 bytes an input (step 2, kind 1, value 2, power 1), the form the signature hashes. Two bytes of step cap
// a run at 65536 steps (22 min at 20 ms).
export function packInputs(inputs: readonly Input[]): `0x${string}` {
  const hex = (n: number, d: number) => n.toString(16).padStart(d, "0")
  return `0x${inputs.map((i) => hex(i.step, 4) + hex(KINDS.indexOf(i.kind), 2) + hex(i.value, 4) + hex(i.power, 2)).join("")}`
}

export function unpackInputs(packed: string): Input[] {
  const h = packed.replace(/^0x/, "")
  const at = (i: number, n: number) => parseInt(h.slice(i, i + n), 16)
  const out: Input[] = []
  for (let i = 0; i < h.length; i += 12) out.push({ step: at(i, 4), kind: KINDS[at(i + 4, 2)], value: at(i + 6, 4), power: at(i + 10, 2) })
  return out
}
