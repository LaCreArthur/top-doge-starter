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
