# Robin Strategy

Minimal four-page site:

- `index.html`
- `pages/robin-fight.html`
- `pages/whitepaper.html`
- `pages/treasury.html`
- `pages/legal.html`

The current build uses stylized scene backgrounds as placeholders until the final custom page images are generated.

## ROBINCITY Clean Up

Local static run:

```powershell
python -m http.server 5174 --bind 127.0.0.1
```

Game URL:

```text
http://127.0.0.1:5174/pages/robin-fight.html
```

Music is generated in-browser with Web Audio. It defaults on and starts after the player presses Start; use the Music toggle in the HUD to mute or resume it.

Enemies use the black bear-market villain sheet in `assets/game/villains-bear-market.png`, with occasional huge bear-market brutes from `assets/game/bear-market-brute.png`.

Local agent API server:

```powershell
node tools/robin-fight-agent-server.mjs 5175
```

Agent autoplay URL:

```text
http://127.0.0.1:5175/agent
```

Agent decision endpoint:

```text
POST http://127.0.0.1:5175/api/agent/decision
```

Supabase global scoreboard:

1. Run `supabase/robin_fight_scores.sql` once in the Supabase SQL editor for project `ztngfvexnbuzwlpmnhrn`.
2. Deploy `supabase/functions/submit-robin-score`.
3. Paste the project's public publishable key into `assets/game/robin-fight-config.js`.
4. Reload `pages/robin-fight.html`; the sidebar changes from Local Winners to Global Winners when Supabase is live.

The browser can read only the safe leaderboard RPC and submit scores through the Edge Function. Raw score-table rows are not public-readable or public-insertable.

Test commands:

```powershell
node tools/robin-fight-smoke-test.mjs
node tools/robin-fight-headless-test.mjs
node tools/robin-fight-marathon.mjs 80 9000
```
