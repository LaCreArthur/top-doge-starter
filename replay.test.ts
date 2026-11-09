// The replay check of a game folder (the skill shows it; the starter runs it as `npm test`): the rules alone, in Node.
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
