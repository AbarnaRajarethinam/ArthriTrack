# ArthriTrack Implementation Report

Date: 15 October 2026. This report covers the completed enhancement slice in the current workspace. It does not claim physical-camera or clinical validation.

## Implemented improvements

### Guided assessment and calibration

- Replaced the timer-only assessment journey with explicit Select, Camera Positioning, Demonstration, Calibration, Ready, Recording and Results states.
- Added task descriptions, task-specific motion demonstrations, an optional browser speech guide, hand framing/size/orientation guidance, accessible progress, pause/finish/cancel/retry actions, and one results screen.
- Implemented phase-based calibration requiring sufficient observations in start, moved and return positions. Calibration has a bounded 30-second attempt, recoverable tracking interruptions, retries, and separate `SUFFICIENT`, `LIMITED`, and `INSUFFICIENT` outcomes.
- Thumb opposition calibrates index, middle, ring and little targets separately. Supported targets are four or eight finger attempts, so a set does not end at an unexplained uneven finger.
- Added a camera-frame watchdog and independent recording duration check. Camera/model resources are released on terminal paths and unmount.

### Measurement integrity

- Added explicit valid-segment and opposition-target IDs to samples. Speed never crosses an invalid tracking segment, pause or target transition.
- Opposition amplitude is computed within each available target and then averaged, avoiding false movement from different fingertip locations.
- Added per-finger estimated PIP movement summaries for fist capture.
- Replaced the displayed instantaneous-speed consistency meaning with `cycle_repeatability`, based on variability of completed cycle amplitudes. It is experimental and omitted until at least two cycles exist.
- New measurements use algorithm `prototype-3`, protocol `guided-1`, explicit units and local model identifier. Historical `prototype-2` records retain their old definitions.
- Capture labels are now `SUFFICIENT_CAPTURE`, `LIMITED_CAPTURE`, and `RETRY_RECOMMENDED`. User copy explicitly separates capture sufficiency from accuracy and clinical validity.

### Backend, history and privacy

- Added capture sufficiency checks requiring observation count and accepted duration; a one-observation payload cannot qualify.
- Added client assessment IDs and idempotent save behavior to prevent duplicate retry submissions.
- Added measurement provenance, repetition target, calibration evidence, per-finger summaries, accepted duration and server receipt timestamp fields to the validated JSON payload.
- Added SQL offset/limit pagination for assessment lists and a summary endpoint with total count and timezone-aware latest sufficiently captured assessment.
- Trend analysis compares only the latest compatible algorithm version and removes the inappropriate one-unit floor. Results remain descriptive and experimental.
- Symptom insight evidence now comes from symptom records; movement insight evidence carries its unit. The deterministic provider is versioned `deterministic-v2`.
- Deleting an assessment redacts it from retained report drafts and records the source deletion. Added report deletion endpoint.
- Reports now include measurement units, algorithm versions, morning stiffness, swelling and daily-difficulty fields.
- Storage consent can be withdrawn/restored in Settings. Existing records remain exportable/deletable; real-mode writes are consistently blocked while withdrawn.
- Added a 20-second frontend request timeout with recovery wording that does not imply unsaved state was discarded.

### Broader UX and documentation

- Added onboarding Back navigation and readability choice before consent.
- Renamed “AI Companion” navigation to “Record Insights” to describe the deterministic feature accurately.
- Dashboard latest selection uses parsed timestamps and the new summary API; the assessment count remains correct beyond the first page.
- Added responsive assessment styling, a 320 px reflow override, large guided panels and reduced-motion-compatible task animations.
- Updated README and verification documentation. Added a practical manual usability, accessibility and measurement study protocol.

## Files modified

- `frontend/src/pages/Assessment.tsx`: guided assessment controller and UI.
- `frontend/src/vision/calibration.ts`: new movement-phase calibration engine.
- `frontend/src/vision/engine.ts`, `geometry.ts`: segmentation, target-specific metrics, cycle repeatability, provenance and per-finger output.
- `frontend/src/vision/engine.test.ts`: measurement/calibration regressions.
- `frontend/src/App.tsx`, `pages/Onboarding.tsx`, `pages/Care.tsx`, `components/Trends.tsx`, `api.ts`, `index.css`: dashboard, onboarding, insights, history compatibility, timeout and UI work.
- `frontend/e2e/journey.spec.ts`, `playwright.config.ts`, `vite.config.ts`: updated browser journey and isolated test-port configuration.
- `backend/app.py`: contracts, sufficiency, idempotency, pagination/summary, consent and deletion behavior.
- `backend/services/analytics.py`, `reports.py`: compatible trends, evidence and richer reports.
- `backend/tests/test_api.py`: integration regressions.
- `README.md`, `docs/VERIFICATION.md`, `docs/MANUAL_VERIFICATION_PROTOCOL.md`: updated operation and limitations.

## Architecture and compatibility

The React/TypeScript/MediaPipe/FastAPI/SQLAlchemy architecture remains intact. Frames still remain in the browser. No cloud inference, LLM or third-party service was added. No new package dependency was added.

No relational schema migration was necessary: versioned measurement additions use the existing validated JSON record envelope. The existing Alembic migration remains applicable. Historical data is neither rewritten nor assigned invented metadata. Analytics groups new data by algorithm version, so `prototype-2` and `prototype-3` values are not silently combined. Existing legacy quality statuses remain readable.

## Measurement definition changes

| Field | Historical `prototype-2` | New `prototype-3` |
|---|---|---|
| Fist/spread amplitude | Session P95−P5 scalar span | Same unit/summary, with segment-aware temporal processing and provenance |
| Opposition amplitude | Pooled P95−P5 across changing targets | Mean of target-specific P95−P5 spans, palm widths |
| Speed | Adjacent accepted values, potentially across invalid gaps/targets | Adjacent values only inside the same valid segment and target |
| `movement_consistency` | Instantaneous speed variability score | Compatibility field carrying cycle repeatability or zero; authoritative new field is nullable `cycle_repeatability` |
| Quality | `VALID`/`UNCERTAIN`/`RETRY_REQUIRED` | Capture sufficiency labels with observation and accepted-time minima |

Because `movement_consistency` changed meaning for new records, every new record carries `algorithm_version`. UI labels the new measure “experimental cycle repeatability.” Consumers should prefer `cycle_repeatability` for `prototype-3`.

## Remaining limitations and unresolved issues

- Physical hand/camera accuracy and anatomical left/right inversion are unverified. The current handedness transform remains unchanged and is explicitly a manual blocking check before trusted bilateral or hand-specific claims.
- Calibration uses estimated scalar features. It has automated phase evidence and target separation, but no clinical validation or known measurement-error bounds.
- The browser E2E suite verifies onboarding, persistence, reports, privacy, camera denial and actual model loading/blank-frame rejection. It does not yet drive a deterministic mocked landmark sequence through the complete visible assessment journey.
- No formal screen-reader, contrast, 400% zoom or representative older-adult/limited-dexterity study was performed.
- Report deletion exists at the API level; a dedicated saved-report management list is still absent from the UI.
- Routine log uniqueness remains application-level rather than a database constraint because logs are stored in the shared JSON record model.
- Production identity recovery, server-side session expiry/revocation, rate limiting, encrypted storage configuration, backup/restore automation, CSP and deployment penetration testing remain unresolved. The product should not be exposed as a public health-data service until addressed.
- Trend thresholds remain experimental descriptive rules. Removing the shared unit floor fixes a confirmed defect but does not establish clinical significance.
- Worker-based inference was not introduced without device profiling; inference remains throttled on the main thread.

No databases were deleted or migrated destructively. Browser tests used and then removed an isolated temporary SQLite database. No commit, deployment or production infrastructure change was made.
