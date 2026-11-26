# ArenaBoard

A four-player tournament desk for project P62, *AI in Software Engineering*. Create a seeded bracket, record three knockout matches and share a read-only link. Spectators receive score and leaderboard updates over WebSocket.

**[Read the illustrated project report](report/ArenaBoard-P62-Report.pdf)** · [Verification records](evidence/) · [Continuous integration](../../actions)

## Run the prototype

Use Node.js 24 with npm. From the repository root:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:3000**. Confirm the four aliases and opening Elo ratings, then choose **Create bracket**. Use **Copy spectator link** and open it in a separate browser profile or private window. Enter both semifinal scores and then the final in the organiser tab. The event URL also opens the board after a server restart. Keep the original organiser tab open: its editing key is held in session storage. Closing that session can end editing access.

The default single-process setup stores each tournament under `data/`. To use MongoDB with the supplied container stack:

```sh
docker compose up --build -d
```

Open the same local address. Run `docker compose down` to stop while preserving the database volume. The host port binds to loopback. The application accepts `MONGO_URL`, `DATA_DIR`, `HOST` and `PORT`. Use a single app replica for live updates. The classroom prototype has no account recovery, cross-event rating history or public hosting configuration.

## Tournament rules

Opening Elo sorts entrants from highest to lowest. Registration order breaks equal-rating ties. Seed 1 plays 4 and seed 2 plays 3. Each result is final and scores must be distinct integers from 0 through 999. Both semifinal winners advance. Standings sort by wins, current Elo and original seed.

The pre-match probability for A is `1 / (1 + 10 ** ((RB - RA) / 400))`. A completed match transfers `round(32 × (actualA - expectedA))` Elo points to A and the opposite value to B. The stored forecast stays fixed after scoring. Forecasts never determine advancement.

## Reproduce the evidence

```sh
npm test
npm run evaluate
node scripts/demo.js
npm run build
npx playwright install chromium
npm run browser-test
```

A locally installed Chromium-family browser also works via `CHROMIUM_PATH`. The browser test opens separate organiser and spectator contexts and writes the final screenshot. The simulation uses 10,000 synthetic matches and fixed seed 62. The demo measures sequential localhost reads against disposable file storage. The included logs document the run used for the report. Timing varies by machine.

## Code and verification

| Path | Purpose |
| --- | --- |
| `src/rules.js` | Validation, seeding, match advancement and Elo |
| `src/server.js` | Score authorization, revision checks, live updates, health and metrics |
| `src/store.js` | Atomic file replacement and conditional MongoDB writes |
| `client/` | React organiser and spectator views |
| `tests/` | Domain rules, concurrent writes, persistence and WebSocket integration |
| `scripts/` | Simulation, browser journey, local demo and container smoke test |
| `.github/workflows/ci.yml` | Build, tests, browser run and MongoDB container smoke test |
| `Jenkinsfile` | Alternative build and package pipeline for an agent with Node and Docker |

Read `GET /health` for process liveness and `GET /metrics` for completed HTTP request count, error count and cumulative request time. A spectator receives tournament state only. An organiser submits a score with the current revision and a per-event edit key. A stale update returns HTTP 409.
