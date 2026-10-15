# ArthriTrack Test Report

Executed 15 October 2026 in the supplied Windows workspace. `PASS` means the named automated check completed successfully; it does not imply physical-camera accuracy or clinical validity.

| Test Area | Test Performed | Result | Evidence | Limitations |
|---|---|---|---|---|
| Calibration | Unit trajectories for normal fist calibration, limited movement, timeout, pause/resume and repeated attempt reset | PASS | Vitest `frontend/src/vision/engine.test.ts`; included in 11 passing tests | No physical hand; wrong-hand/multi-hand/orientation feedback is controller code and manual protocol, not component-mocked here |
| Computer vision | Geometry finite/degenerate checks; local MediaPipe model initialized in Edge and rejected a blank 640×480 frame; target and segment regressions | PASS | 11 Vitest tests; 2 browser model tests across desktop/mobile | Blank frame proves model path/runtime only; real landmarks, handedness and accuracy require manual verification |
| Repetition counting | Low-high-low dwell, noise, interruption and incomplete capture; segment boundaries and target separation | PASS | Vitest deterministic trajectories | Full per-movement visible UI journey with mocked landmarks is not yet implemented |
| Results | Capture status requires observation/time evidence; per-target amplitude and cycle-repeatability branches type/build tested | PASS | Vitest quality tests; backend capture-contract tests; production build | Visual comprehension needs usability study |
| Dashboard | Empty state, demo data chart, mode switching, responsiveness; summary API timestamp test | PASS | Playwright desktop/mobile journey; backend summary test | Automated journey does not create 501 records; SQL pagination is integration-tested with offset/limit, not load-tested |
| Backend | Session/profile, consent, ownership, assessment, idempotency, trend, journal, routine, report/PDF, export/deletion | PASS | `19 passed` with pytest; one Starlette/httpx deprecation warning | PostgreSQL and concurrency/load behavior not run |
| Database | Alembic initial migration applied to isolated SQLite database; active schemas exercised | PASS | Isolated E2E database started after `alembic upgrade head` | No new relational migration required; backup/restore and PostgreSQL migration not run |
| Accessibility | Keyboard-native controls, labels/status roles, 390 px reflow/no overflow and reduced-motion CSS covered by code/E2E | MANUAL VERIFICATION REQUIRED | Mobile Playwright journey passed; protocol in `docs/MANUAL_VERIFICATION_PROTOCOL.md` | No screen-reader, contrast tool, 320 px automated journey, 200–400% zoom or target-user study |
| End-to-end | Onboarding, symptom create/edit/reload, routine/log, deterministic insights/safety, report confirmation/PDF, camera denial, demo isolation, progress, settings, console-error and mobile overflow | PASS | 4 Playwright tests passed in 43.6 seconds using Microsoft Edge | Does not simulate full successful camera assessment trajectory |
| Physical camera | No real hand/camera session available in the execution environment | MANUAL VERIFICATION REQUIRED | Manual protocol prepared | Handedness, task completion, device performance, comfort, reliability and accuracy unverified |

## Commands and exact results

```powershell
cd backend
..\.venv\Scripts\python.exe -B -m pytest tests -q -p no:cacheprovider
# 19 passed, 1 Starlette/httpx deprecation warning

cd ..\frontend
npm test
# 1 file, 11 tests passed

node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --incremental false
# passed

npm run build
# passed; 2529 modules transformed

$env:ARTHRITRACK_E2E_BASE_URL='http://127.0.0.1:5174'
npm run test:e2e
# 4 passed using isolated frontend/backend ports and an isolated migrated database
```

The initial frontend test/build attempt inside the restricted sandbox failed before test execution because the environment denied spawning the local esbuild process (`EPERM`). The same commands passed after explicit process permission. The first isolated E2E attempt produced two setup failures because port 5174 was absent from the temporary backend origin allowlist; after correcting only that test-server environment setting, all four tests passed. These were environment/configuration failures, not hidden as passing tests.

## Manual and blocked verification

The following were not executed and must not be reported as passing: physical fist/spread/opposition captures; anatomical left/right across front/rear cameras; camera switching; low-light behavior; real frame freeze; clinical/reference measurement agreement; target-user usability; screen reader; formal contrast; 400% zoom; PostgreSQL; Docker/reverse-proxy HTTPS; security penetration, backup restore and load testing.
