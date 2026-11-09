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
