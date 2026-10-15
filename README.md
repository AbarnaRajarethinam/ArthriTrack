# ArthriTrack

A working local-first arthritis self-care MVP built with React 19, TypeScript, Vite, FastAPI and SQLAlchemy. Camera frames stay in the browser. The app is a self-care record, not a diagnostic or clinically validated medical product.

## Start on Windows (PowerShell)

Prerequisites: Python 3.12 or later and Node.js 22.12 or later recommended. The existing environment uses Python 3.13 and Node 20.12.2; see verification notes for actual checks.

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

In a second terminal, from the project root:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Keep the same hostname/browser: localhost and 127.0.0.1 have separate cookies. The API documentation is at http://127.0.0.1:8000/docs. `.env.example` documents configuration; environment variables must be set in the shell or deployment environment (the app does not automatically load `.env`).

On macOS/Linux, replace `.venv\Scripts\python.exe` with `.venv/bin/python` and use forward slashes. Run Alembic and Uvicorn from `backend/`.

## Walkthrough

1. Complete the four onboarding steps. Personal information is optional; data-processing consent is required. Progress persists on the server.
2. Open **Hand Assessment**, choose a hand/movement and allow the camera. Keep a single palm in view. Calibrate with comfortable movement for eight seconds, then start the countdown. Real MediaPipe landmarks drive the overlay and measurements.
3. Complete cycles or finish early. Review quality and results, then explicitly save. Uncertain/rejected sessions are stored for inspection but excluded from baselines. Three valid sessions per hand/movement establish a median reference; six enable repeated-change classification.
4. Add, edit and delete entries in **Symptom Journal**. **Care Routine** records your existing prescribed instructions and daily schedule, with Completed, Missed, Skipped and Not Sure logs.
5. Review actual saved records in **My Progress**. Ask **AI Companion** for bounded explanations; its deterministic provider requires no key.
6. In **Appointment Prep**, select dates/sections, edit notes/questions, generate the draft, review it, check the export confirmation and download a real PDF. No report is automatically shared.
7. Use **Settings** to change readability, export JSON, or delete all data for the current browser identity.

## Demo mode

After onboarding, choose **Explore demo**. An amber **DEMO DATA** banner identifies the isolated example space. All seeded records are synthetic. Camera assessments remain live in this mode and are saved only to the demo space.

- Left fist: repeated lower range estimates.
- Right fist: variable estimates.
- Left finger spreading: stable valid measurements plus an explicitly rejected session.
- Thumb opposition: insufficient data.
- Symptoms and daily routine status examples are included.

**Reset demo** rebuilds synthetic data without touching real records. Entering demo also resets the example space. Generate an appointment draft while in demo to see a labelled example report.

## Camera and measurements

MediaPipe WASM and the Google hand-landmarker model are served from `frontend/public/vision/`; no model CDN is needed at runtime. These assets were downloaded from the official Google model distribution. See [MediaPipe documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

Camera access needs localhost or HTTPS. Permission denial, unavailable cameras, interrupted streams and model errors are shown explicitly. Close other camera applications if access fails. The browser uses a mirrored preview and unmirrored inference input; handedness must be checked on target devices before relying on hand-specific trends.

- Fist: mean estimated PIP flexion across four fingers; calibrated hysteresis plus dwell prevents noise from becoming repetitions.
- Spread: average adjacent fingertip separation angles about the wrist.
- Opposition: thumb/fingertip distance divided by palm width, with ordered targets and approach/release detection. Proximity is not verified physical contact.
- Range: 5th–95th percentile span of accepted samples, in degrees (fist/spread) or palm widths (opposition).
- Speed: average absolute frame-to-frame change over contiguous accepted samples.
- Consistency: descriptive sample-speed variability, not a disease or clinical score.
- Quality: VALID requires at least 85% usable frames, three complete repetitions, five seconds and no more than five interruptions. UNCERTAIN requires at least 65% usable frames and one repetition. Otherwise RETRY_REQUIRED. All thresholds are prototype parameters.

The tracker checks visibility, one-hand presence, handedness classification confidence, finite geometry, orientation changes and implausible jumps. Handedness confidence is not landmark confidence. Lighting quality is addressed through detection and visibility feedback, not a validated illumination measurement. Processing is throttled to about 15 Hz on the main thread; CPU/browser performance varies.

## Architecture and files

```text
frontend/
  src/App.tsx                 navigation, overview, reminders
  src/api.ts                 API client and download utilities
  src/components/            shared UI and progress charts
  src/pages/                 onboarding, care workflows, camera assessment
  src/vision/                geometry, temporal engine, MediaPipe adapter, tests
  e2e/                       desktop/mobile browser journey
  public/vision/             locally served model and WASM
backend/
  app.py                     validated API, session identity and persistence
  services/analytics.py      per-hand/type baseline and trend rules
  services/provider.py       strict explanation schema and provider seam
  services/reports.py        reviewed-snapshot PDF generation
  alembic/                   versioned migrations
  tests/                     API, privacy, analytics, safety and PDF tests
docs/                        verification and limitations
docker-compose.yml           local Docker deployment
```

The MVP uses relational users plus indexed, user-owned structured records with validated JSON payloads. Foreign-key cascade removes all records on account deletion. It intentionally does not implement the proposal’s fully normalized ten-table clinical schema; that is a documented production follow-up. Baselines are recomputed deterministically from persisted valid records, preventing stale references after deletion. The old `backend/arthritrack.db` is preserved and **not imported**, because its unlabelled seeded records cannot be treated as real patient history. The new database is `backend/arthritrack-v2.db`.

## Privacy and identity

This is an isolated local-demo identity system: a random 384-bit token is stored in an HTTP-only SameSite=Strict cookie; only its SHA-256 hash is stored in the database. Every record query checks the authenticated owner and real/demo mode. Clients cannot choose a user ID. CORS and mutation Origin checks use an explicit allowlist. API responses disable caching; logs contain request method/status/duration, not health notes.

There is no email/password sign-in, account recovery, session-management UI, encrypted database, or security/regulatory certification. Losing cookies loses access to that profile. Export before clearing browser data. Do not use this prototype as a public clinical service without a security/privacy review and stronger identity, retention, rate limiting, backups and deployment controls.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./arthritrack-v2.db` | SQLite fallback; PostgreSQL uses `postgresql+psycopg://user:password@host/database` |
| `ALLOWED_ORIGINS` | localhost and 127.0.0.1 port 5173 | Comma-separated exact frontend origins |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `TREND_CHANGE_FRACTION` | `0.12` | Experimental relative repeated-change threshold |

No frontend secrets are needed. No WorkBuddy, CodeBuddy or Miora usage is claimed. The current provider is deterministic; `ExplanationProvider` is a code-level adapter seam with schema validation and fallback. External-model paraphrasing remains disabled until documented credentials and a reviewed output policy are available. No unverified exercise programme is offered.

## Tests and build

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
cd ..\frontend
npm test
npm run build
# With frontend and backend running:
npm run test:e2e
```

Playwright uses installed Microsoft Edge (`channel: msedge`). On another OS, install a supported Playwright browser and adjust the channel. Browser tests create their own private profiles. Geometry tests use synthetic coordinates only in the test suite, never in the live assessment path. Actual executed results are in `docs/VERIFICATION.md`.

## Docker and deployment

```powershell
docker compose up --build
```

Open http://localhost:5173. Nginx serves the production frontend and proxies `/api/` to FastAPI. SQLite persists in the `health-data` volume. For PostgreSQL, supply `DATABASE_URL`, provision the database separately and run `alembic upgrade head`; this configuration needs environment-specific verification. Do not copy local health databases into an image.

For remote deployment, put Nginx behind a trusted HTTPS reverse proxy, set `COOKIE_SECURE=true`, set the exact frontend origin, keep the API private, and use persistent storage/backups. Camera access over plain remote HTTP will fail. Docker/PostgreSQL deployment must be tested in the destination environment; local build success does not verify those environments.

## Remaining scope

See `docs/VERIFICATION.md` for verified behavior and limitations. In particular, this MVP has daily-only routines, no background push notifications, no cross-device account system, no clinical validation, no external LLM/sponsor integration, and no clinician-approved exercise library. Physical camera accuracy and comfort must be verified with target users and devices. The separate proposal mentioned in the pasted request was not present in the workspace.
