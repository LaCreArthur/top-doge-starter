// A run in the page, around any game's page.ts (game.ts Page): the clock and the stepping, input stamping, the replay
// after a refused input, the live board and the ghosts. The hub (web/src/run.ts) and the dev page (play.html) feed it:
// a live run's socket gives the clock (start), the parts, the refused inputs and the end; a local run gives its level
// (partOf) and finds its end itself. The game draws, plays its lobby, countdown and sounds, and sends its inputs.
import type { At, GameModule, Ghost, Input, InputKind, Page, Look } from "./game.ts"
import { board } from "./board.ts"
import { play } from "./play.ts"

export type Host = ReturnType<typeof host>

export function host<S, P>(el: HTMLElement, game: GameModule<S, P>, page: Page<S, P>, look: Look, o: {
  leave(): void
  send?(i: Input): void // a live run: each input to the server, once stamped
  partOf?(index: number): P // a local run: its level, each part made 1 s before its first step, as the server sends it
  inputs?: readonly Input[] // a check: the run's inputs, played as the player's
  ghosts?: Ghost[] // the Demo's bots
  hash?: boolean // the dev page and the host test: throw when the page writes the state
}) {
  const check = look.mode === "check"
  const ranked = look.mode === "run" || look.mode === "demo" // a practice and a check are unranked: no board
  const parts: P[] = []
  const inputs: Input[] = check ? [...(o.inputs ?? [])] : [] // the player's, stamped, in step order
  let p = play(game, (i) => parts[i])
  let startsAt: number | undefined
  let ghosts = o.ghosts ?? []
  let last = -1 // the step of the last input stamped
  let lobbyInputs: Input[] = [] // the lobby's choices, sent at GO, first
  let early: Omit<Input, "step"> | undefined // the last input sent before GO, stamped after them
  let steer: Omit<Input, "step"> | undefined // a steer waiting for a step: a newer one replaces it
  let over = false, score: number | undefined, endSteps: number | undefined
  let rewound = false, place = 0, gone = false
  let ended!: (score: number) => void
  const end = new Promise<number>((ok) => (ended = ok))
  const watch = <T,>(call: () => T): T => {
    if (!o.hash) return call()
    const before = fingerprint(p.state)
    const r = call()
    if (fingerprint(p.state) !== before) throw new Error(`${game.name}'s page wrote the state`)
    return r
  }

  const clock = () => (startsAt === undefined ? -1 : Math.floor((Date.now() - startsAt) / game.stepMs))
  // An input takes the step the clock is on, or the one after the last when that is taken: steps always rise
  // (play.ts checkInput), and a second input in one step waits for the next.
  const stamp = (i: Omit<Input, "step">) => {
    const step = Math.max(clock(), last + 1)
    if (step >= game.maxSteps) return
    last = step
    const input = { ...i, step }
    inputs.push(input)
    o.send?.(input)
  }
  const send = (kind: InputKind, value = 0, power = 0) => {
    if (check || over || gone) return
    const i = { kind, value, power }
    if (clock() < 0) early = i // before GO: the last one is kept
    else if (kind === "steer") steer = i // sampled once a step, so a stick never runs ahead of the clock
    else stamp(i)
  }

  const view = page.open(el, look, { send, leave: () => o.leave() })
  const boardEl = el.appendChild(document.createElement("div"))
  const showBoard = board(boardEl)

  // The steps due: up to the clock (or the server's end), never past the parts received.
  const advance = () => {
    if (gone || startsAt === undefined) return
    const now = clock()
    if (o.partOf) while (parts.length * game.partSteps < game.maxSteps && Date.now() >= startsAt + (parts.length * game.partSteps * game.stepMs) - 1000) parts.push(o.partOf(parts.length))
    if (now >= 0) {
      for (const i of lobbyInputs.splice(0)) {
        const input = { ...i, step: Math.max(i.step, last + 1) }
        inputs.push(input), o.send?.(input), (last = input.step)
      }
      if (early) stamp(early), (early = undefined)
    }
    if (steer && now > last) stamp(steer), (steer = undefined)
    const to = Math.min(endSteps ?? now, parts.length * game.partSteps, game.maxSteps)
    while (p.step < to && !p.over()) stepOnce(false)
    if (!over && o.partOf && p.over()) close(game.score(p.state))
  }
  let next = 0 // the next input to play
  const stepOnce = (replaying: boolean) => {
    const at: Input[] = []
    while (next < inputs.length && inputs[next].step === p.step) at.push(inputs[next++])
    const step = p.step
    p.next(at)
    if (view.stepped) watch(() => view.stepped!(p.state, step, at, replaying))
  }
  const close = (s: number) => {
    over = true
    score = s
    ended(s)
  }

  const draw = () => {
    if (gone) return
    advance()
    const ms = startsAt === undefined ? undefined : Date.now() - startsAt
    const at: At = { step: p.step - 1, ms, place, over, score, rewound }
    rewound = false
    const shown = watch(() => view.frame(p.state, at, parts, ghosts))
    const fly = ranked && !over && at.step >= 0 && shown?.board !== false
    const field = page.field ? page.field(ghosts) : ghosts
    const rows = !fly ? [] : [
      { name: "You", score: game.score(p.state), me: true, out: false, face: look.face },
      ...field.map((g) => ({ name: g.name, ...(page.rival?.(g, at.step, parts, p.state) ?? { score: g.score ?? 0, out: false }), me: false, face: g.face })),
    ]
    const format = page.format ?? String
    place = showBoard(rows.sort((a, b) => b.score - a.score || +b.me - +a.me).map((r) => ({ ...r, score: format(r.score) })))
    raf = requestAnimationFrame(draw)
  }
  let raf = requestAnimationFrame(draw)
  const timer = setInterval(advance, 50) // a hidden tab draws no frames; its run still steps and ends

  // The lobby, then the run may open: the game's own start screen, never in a check; its inputs go first.
  const lobby: Promise<number | undefined> = (check || !view.lobby ? Promise.resolve(undefined) : view.lobby()).then((r) => {
    if (!r) return undefined
    if (r.startsAt === undefined || o.send) return void (lobbyInputs = [...r.inputs])
    // A lesson that flowed into a local run: its inputs are already played, on its own clock.
    inputs.push(...r.inputs), (last = r.inputs.at(-1)?.step ?? -1)
    return r.startsAt
  })

  return {
    lobby,
    // The run's end: a local run's score once it is over; a live run's once the server's end is given.
    end,
    sent: inputs,
    // GO's wall-clock ms: the countdown runs until then.
    start(at: number) {
      startsAt = at
    },
    part(index: number, data: P) {
      parts[index] = data
    },
    // A live input the server refused: the run is played again without it.
    refused(step: number) {
      const i = inputs.findIndex((x) => x.step === step)
      if (i < 0) return
      inputs.splice(i, 1)
      const to = p.step
      p = play(game, (k) => parts[k])
      next = 0
      while (p.step < to && !p.over()) stepOnce(true)
      rewound = true
    },
    // The brawl's finished runs, as they come.
    rivals(list: Ghost[]) {
      ghosts = list
    },
    // A live run's end, from the server: its score, and its steps (the page steps there first).
    finish(s: number, steps?: number) {
      endSteps = steps
      advance()
      close(s)
    },
    destroy() {
      gone = true
      cancelAnimationFrame(raf)
      clearInterval(timer)
      view.destroy()
      boardEl.remove()
    },
  }
}

// A number for everything reachable from a value, to see a write: numbers, strings, arrays, typed arrays, maps, sets.
function fingerprint(v: unknown): number {
  let h = 2166136261
  const mix = (n: number) => (h = Math.imul(h ^ (n | 0), 16777619) ^ Math.imul((n * 1e3) | 0, 2654435761))
  const seen = new Set<object>()
  const walk = (x: unknown): void => {
    if (typeof x === "number") return void mix(x)
    if (typeof x === "string") return void [...x].forEach((c) => mix(c.charCodeAt(0)))
    if (typeof x === "boolean") return void mix(x ? 1 : 2)
    if (x === null || typeof x !== "object" || seen.has(x)) return void mix(3)
    seen.add(x)
    if (ArrayBuffer.isView(x)) return void Array.prototype.forEach.call(x, mix)
    if (x instanceof Map) return void x.forEach((val, k) => (walk(k), walk(val)))
    if (x instanceof Set) return void x.forEach(walk)
    for (const k of Object.keys(x)) walk(k), walk((x as Record<string, unknown>)[k])
  }
  walk(v)
  return h
}
