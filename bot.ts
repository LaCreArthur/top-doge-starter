import type { Bot } from "@doge-brawl/shared/game"

const bot: Bot<number> = function* (_parts, skill) {
  for (let step = 0; step < 60; step += Math.round(4 / Math.max(skill, 0.1))) yield { step, kind: "tap", value: 0, power: 0 }
}
export default bot
