# Verification and remaining scope

Executed on 13 October 2026 in the supplied Windows workspace.

## Executed checks

- Backend: **15 passed** with pytest. Tests cover consent gates, unauthenticated requests, owner/mode isolation, symptom CRUD and validation, quality exclusion, baseline grouping, repeated-change/variable/stable classification, routine status upserts, PDF signature and export confirmation, privacy export, account cascade deletion, mutation Origin checks, bounded medical responses, insufficient data, and unsafe/unavailable provider fallback.
- Geometry/temporal engine: **6 passed** with Vitest. Tests cover 90/180-degree geometry, invalid/degenerate coordinates, complete-cycle counting, threshold noise, interrupted cycles, incomplete recordings and quality classification.
- Browser: **4 passed** with Playwright using installed Microsoft Edge: full desktop and 390px mobile journeys plus real MediaPipe model initialization/empty-frame rejection on both configurations.
- Browser journey verifies onboarding consent, empty-state dashboard, persistent symptom create/edit after reload, routine completion, insufficient-data explanation, dose-change refusal, report review/confirmation and PDF download, camera denial, isolated demo switching, progress state, settings and no horizontal overflow/runtime page errors.
- Frontend TypeScript/production build passed. Vendor chunks split into vision and charts.
- Alembic initial migration applied successfully to a new SQLite database.
- npm installation audit after patched dependency updates: **0 known vulnerabilities**.

One Python test warning comes from Starlette's deprecation of its httpx-based TestClient transport. It does not fail the tests. The installed oxlint package recommends a newer Node version than the host's Node 20.12.2; lint was not requested or executed. Node 22.12+ is recommended for fresh setup.

## Verification limits

- **No human hand or physical webcam assessment was tested.** Loading the actual model and rejecting a blank frame proves the local assets and inference path run; it does not validate landmark accuracy, handedness on a target camera, comfort, real repetition recognition, or clinical meaning.
- Docker, PostgreSQL, reverse-proxy HTTPS and deployment were configured but not executed here.
- No formal WCAG audit, assistive-technology study, clinical validation, security penetration test or regulatory assessment was performed.
- No sponsor product credentials/documentation or separate project proposal were supplied. CodeBuddy/WorkBuddy/Miora usage is not claimed.

## Deliberate MVP scope and incomplete advanced features

- Browser-session identity rather than cross-device account authentication/recovery. Appropriate for an isolated local demonstration, not a public health service.
- Indexed relational owner/record tables with validated structured JSON, rather than the proposed fully normalized domain tables. Baselines are computed, not stored as separately versioned rows. Assessment list supports pagination; other list endpoints currently return the identity's full collection.
- Daily routine schedules only. No multi-time/weekday recurrence or reliable background push notifications. In-app due-item reminders refresh every minute while open.
- Deterministic explanations and a strict provider seam; no active external LLM. No confirmed diagnosis, flare inference, medication changes or exercise prescriptions.
- No clinical "Review Recommended" risk classifier. The prototype offers insufficient/stable/variable/repeated-change descriptions and a bounded clinician-discussion next step.
- Progress charts filter hand/movement/metric/date and show app references and rejected-sample gaps. There is no symptom overlay on the mobility chart or explicit time-gap annotation; symptoms have their own chart and date-filtered journal. The journal has a date picker, not a month-grid calendar.
- Results include calculated range, speed, sample-speed consistency, repetitions, quality and duration. Detailed per-joint saved trajectories, audio cues and previous-session comparisons on the result card are not implemented. Previous-session deltas are available in the analytics API.
- Opposition uses normalized geometric proximity thresholds, not physical contact verification or individualized touch calibration. World coordinates are model estimates; no millimetre-accuracy claim is made.
- Model inference runs throttled on the main thread. Device performance and low-light behavior require real-device testing. Orientation/jump checks are experimental, not validated quality measures.
- PDF contains tables, baselines, routine logs, notes/questions and limitations. Charts and full symptom-note details are not embedded in the PDF. Unicode font support is limited by ReportLab's standard font.
- API database-at-rest encryption, advanced request throttling, audit trail, backup/recovery automation, profile-session revocation UI and production operational monitoring remain out of scope.

## Manual physical-device acceptance checklist

1. Open localhost/HTTPS in a supported browser and grant camera access.
2. Confirm left/right selection matches actual anatomy with the mirrored preview.
3. Confirm all 21 landmarks follow an actual hand for all three routines.
4. Calibrate comfortable motion and complete multiple cycles without painful effort.
5. Remove the hand, show multiple hands, obscure fingers and change orientation; verify quality feedback and interrupted-cycle behavior.
6. Review and save valid/uncertain/rejected results, refresh and inspect stored values.
7. Build a reference from three valid sessions of one hand/type and confirm rejected sessions stay excluded.
8. Compare generated PDF values to the reviewed records and test data deletion.

Do not call the entire original production specification complete until these manual checks and the production follow-ups are addressed.
