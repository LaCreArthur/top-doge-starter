// Every game's live board, in the run's top-right corner (the top left is the page's gear), as Paper.io 2, Snake.io and
// Snake Rivals show theirs: the top 3, the places that win DOGE, each with the player's doge and its medal, then the
// player's own row a gap below while they are under them. A row slides to its new place when someone is passed. Alone
// (a practice, a brawl no one has finished yet, a dev page) there is no board: the game shows its own score. The host
// (host.ts) gives the rows in place order, each score as the game formats it, every frame: an unchanged board costs one
// string compare.
export type Standing = { name: string; score: string; me?: boolean; out?: boolean; face?: string } // out: a rival whose run has ended; face: its doge (an image URL), else its initial

const ROW = 26, GAP = 4, CUT = 9 // px; CUT: the extra gap above the player's own row when it is below the top 3
const CSS = `
.runboard { position: absolute; z-index: 2; right: 14px; top: max(14px, env(safe-area-inset-top)); width: 150px; pointer-events: none; font: 700 12px Rubik, system-ui, sans-serif; color: #fff; }
.runboard > div { position: absolute; left: 0; right: 0; top: 0; height: ${ROW}px; display: flex; align-items: center; gap: 6px; padding: 0 9px 0 2px; border-radius: ${ROW / 2}px; background: rgb(8 10 42 / 0.72); transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms; animation: board-in 300ms both; }
.runboard i { flex: none; position: relative; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font: 12px/1 DogeSans, Rubik, sans-serif; font-style: normal; color: #c9d4ff; background: rgb(255 255 255 / 0.14) var(--face, none) 52% 18% / 300% no-repeat; }
.runboard i::after { content: attr(data-n); position: absolute; left: -4px; bottom: -3px; width: 12px; height: 12px; border-radius: 50%; display: grid; place-items: center; font: 9px/1 DogeSans, Rubik, sans-serif; color: #1d1300; background: var(--medal, #3a3f6b); box-shadow: 0 0 0 1.5px rgb(8 10 42); }
.runboard .p1 i::after { --medal: #ffd21f; } .runboard .p2 i::after { --medal: #e9edf5; } .runboard .p3 i::after { --medal: #f0a35e; }
.runboard .p4 i::after, .runboard .p5 i::after, .runboard .p6 i::after { color: #fff; }
.runboard span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #c9d4ff; }
.runboard b { font: 14px DogeSans, Rubik, sans-serif; font-weight: normal; font-variant-numeric: tabular-nums; }
.runboard .out { opacity: 0.45; }
.runboard .me { background: rgb(52 30 4 / 0.85); box-shadow: inset 0 0 0 1.5px #fff3b0, 0 0 0 1.5px #ffb31a, 0 0 12px rgb(255 179 26 / 0.6); }
.runboard .me span { color: #fff3b0; }
.runboard .me b { color: #fff6c2; }
.runboard .me.up { animation: board-up 520ms ease-out; }
@keyframes board-in { from { opacity: 0; } }
@keyframes board-up { 30% { scale: 1.08; box-shadow: inset 0 0 0 1.5px #fff, 0 0 0 2px #ffd21f, 0 0 26px #ffd21f; } }
@media (prefers-reduced-motion: reduce) { .runboard > div { transition: none; animation: none; } }
`

export function board(root: HTMLElement) {
  const el = document.createElement("div")
  el.className = "runboard"
  el.innerHTML = `<style>${CSS}</style>`
  root.append(el)
  const rows = new Map<string, HTMLElement>()
  let shown = "", place = 0
  // Shows the rows (fewer than two hide the board) and returns the player's place, 0 when not on it.
  return (all: Standing[]) => {
    const list = all.length > 1 ? all : []
    const key = list.map((r) => `${r.name}\t${r.score}\t${r.out ? 1 : 0}\t${r.face ?? ""}`).join("\n")
    if (key === shown) return place
    shown = key
    const mine = list.findIndex((r) => r.me), was = place
    place = mine + 1
    const on = list.slice(0, 3).concat(mine >= 3 ? [list[mine]] : [])
    for (const [name, row] of rows) if (!on.some((r) => r.name === name)) row.remove(), rows.delete(name)
    on.forEach((r, slot) => {
      const at = list.indexOf(r) + 1
      let row = rows.get(r.name)
      if (!row) (row = document.createElement("div")), (row.innerHTML = "<i></i><span></span><b></b>"), rows.set(r.name, row), el.append(row)
      row.className = `p${at}${r.me ? " me" : ""}${r.out ? " out" : ""}${row.classList.contains("up") ? " up" : ""}`
      row.style.transform = `translateY(${slot * (ROW + GAP) + (slot === 3 ? CUT : 0)}px)`
      const [i, span, b] = row.children as unknown as HTMLElement[]
      i.dataset.n = String(at)
      i.style.setProperty("--face", r.face ? `url("${r.face}")` : "none")
      i.textContent = r.face ? "" : r.name[0]
      span.textContent = r.name
      b.textContent = r.score
    })
    const me = mine >= 0 ? rows.get(list[mine].name) : undefined
    if (me && was && place < was) {
      me.classList.remove("up"), void me.offsetWidth, me.classList.add("up")
      me.onanimationend = () => me.classList.remove("up")
    }
    return place
  }
}
