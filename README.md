# Top Doge starter

Make a game for [Top Doge](https://vibe-doge-play.vibe-doge.workers.dev), the brawl hub on the DogeOS testnet: six
players fly the same level, and the top 3 split the pot. Your game brings its gameplay; Top Doge runs the players and
their doge, the leagues, the live board, the bots and a server that replays every run.

This folder is your game. It starts as the tap game, where the score is the taps in 3 seconds. Change its three files:

- `index.ts`: the rules, pure and in whole numbers. The server replays them.
- `page.ts`: the screen, what the player sees and touches.
- `bot.ts`: the bot that fills the empty seats.

```bash
npm run play
```

Plays it at http://localhost:5300/play.html, as the hub's practice does (`?field` adds five bots to beat).

```bash
npm test
```

Checks that it replays: the same inputs give the same score. Node 24 or later; nothing to install
(`npm install && npm run check` adds the type check).

With an agent: it finds the `top-doge-game` skill in `.claude/skills/` (`AGENTS.md` points every other agent at it),
with the contract and the rules that get a game refused.

`top-doge/` is the platform as the hub runs it (the contract `game.ts`, the host, the live board): don't change it.

## Send it

Push your game to a public repo and send the link to Arthur on Telegram: https://t.me/Cr3Arthur
