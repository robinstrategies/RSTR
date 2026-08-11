# Robin Strategies

Minimal four-page site:

- `index.html`
- `pages/robin-fight.html`
- `pages/whitepaper.html`
- `pages/treasury.html`
- `pages/legal.html`

The current build uses stylized scene backgrounds as placeholders until the final custom page images are generated.

## Robinman Alley Fight

Local static run:

```powershell
python -m http.server 5174 --bind 127.0.0.1
```

Game URL:

```text
http://127.0.0.1:5174/pages/robin-fight.html
```

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

Test commands:

```powershell
node tools/robin-fight-smoke-test.mjs
node tools/robin-fight-headless-test.mjs
```
