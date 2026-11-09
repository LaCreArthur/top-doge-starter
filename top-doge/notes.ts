// A run's balancing notes. Each game's notes.ts notes a run from its state as it plays (a tracker: before a step,
// with its inputs, and after it) and prints them (line: one line; detail: the last run's lines). keep: a dev page
// keeps each run it plays; noted: a run played again from its inputs, and its score (`npm run runs` in a game, the hub's runs).
import type { Input } from "./game.ts"
import { play, type AnyGame } from "./play.ts"

export type Tracker<S = any, N = any> = { n: N; before?(s: S, inputs: readonly Input[]): void; after(s: S): void }
// notes(partOf): a tracker for a run on that level (the public one by default).
export type GameNotes<N = any> = { notes(partOf?: (index: number) => any): Tracker<any, N>; line(n: N): string; detail?(n: N): string[] }

// The run as the server plays it (play.ts), up to `steps`, noted step by step.
function runner(g: AnyGame, partOf: (index: number) => unknown, inputs: readonly Input[], t: Tracker) {
  const p = play(g, partOf)
  let i = 0
  return {
    p,
    to(steps: number) {
      while (p.step < steps && !p.over()) {
        const now: Input[] = []
        for (; i < inputs.length && inputs[i].step <= p.step; i++) if (inputs[i].step === p.step) now.push(inputs[i])
        t.before?.(p.state, now)
        p.next(now)
        t.after(p.state)
      }
    },
  }
}

export function noted<N>(g: AnyGame, partOf: (index: number) => unknown, inputs: readonly Input[], t: Tracker<any, N>) {
  const { p, to } = runner(g, partOf, inputs, t)
  to(g.maxSteps)
  return { notes: t.n, score: g.score(p.state) as number }
}

// A dev page's run, refereed as the server would from the inputs sent (stamped from `startsAt`), noted, and POSTed to
// its dev server's /runs under one id every 10 s, at the end and when the page goes (a quit or a reload): the rules
// version, the address (the page's mode and knobs) and `extra()` go with it. A long run's inputs pass the 64 KB a
// closing page's request may carry, so the 10 s save keeps it then. Returns the stop, for a page that starts another run.
export function keep(g: AnyGame, partOf: (index: number) => unknown, sent: readonly Input[], startsAt: number, t: Tracker, extra: () => object = () => ({})) {
  const r = runner(g, partOf, sent, t), at = new Date().toISOString(), id = at.replace(/[:.]/g, "-")
  let tick = 0
  const catchUp = () => r.to(Math.floor((Date.now() - startsAt) / g.stepMs))
  const save = (keepalive: boolean) =>
    r.p.step && fetch("/runs", { method: "POST", keepalive, body: JSON.stringify({ id, at, rules: g.rules, page: location.search, inputs: sent, notes: t.n, ...extra() }) })
  const stop = (keepalive = false) => {
    catchUp()
    save(keepalive)
    clearInterval(timer)
    removeEventListener("pagehide", gone)
  }
  const gone = () => stop(true)
  const timer = setInterval(() => {
    catchUp()
    if (r.p.over()) stop()
    else if (++tick % 40 === 0) save(false)
  }, 250)
  addEventListener("pagehide", gone)
  return stop
}
