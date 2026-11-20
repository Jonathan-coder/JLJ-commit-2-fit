# Test plan – Commit2Fit

Owner: Test Engineer (Sprint 3/4). Status: Sprint 4 (T073).

## 1. Strategy

| Level | What | Tool | Where |
|---|---|---|---|
| Database / repository | Migrations, constraints, views, diary queries | `node:test` + PostgreSQL test database | `backend/tests/diary.test.js` |
| API integration | Every REST endpoint incl. auth, validation (400/404, never 500), owner isolation | `node:test` + `supertest` | `auth`, `products`, `diary.api` tests |
| Concurrency | Several users at the same time (NF03) | `supertest`, parallel requests | `backend/tests/concurrency.test.js` |
| API contract | `openapi.yaml` is a valid OpenAPI document | `@apidevtools/swagger-parser` | `backend/tests/openapi.test.js` |
| Backend units | App routes, error handler, configuration, test reset | `node:test` | `backend/tests/app.test.js` |
| Frontend units (T083) | Every public function of the frontend scripts (`C2F.*` in util, config, api, data, state, fasting, ui) | `node:test`, browser APIs replaced by fakes (`frontend/tests/helpers.cjs`) | `frontend/tests/*.test.cjs` |
| Manual / browser | Page scripts (`heute.js`, `produkte.js`, `fasten.js`, …: DOM and click handling, no public functions), responsive layout (NF02), usability (NF01), load times (NF04) | Browser dev tools, test protocol | see US18 |

Rules for the automated tests:

- Tests run against the separate database `commit2fit_test`, never against the development data. `resetTables()` empties all tables before each test, so tests do not depend on each other.
- The suite runs sequentially (`--test-concurrency=1`) and tests are never skipped silently.
- Every endpoint gets at least: "requires authentication", the happy path, invalid input (must return 400/404, never 500) and, if data is per user, an owner-isolation test.
- Bugs found by tests are fixed together with a regression test (see section 5).

## 2. How to run

```bash
cd backend
npm run db:up        # PostgreSQL (also creates commit2fit_test)
npm test             # applies migrations to the test DB, then runs all tests
npm run test:coverage  # same, plus a coverage report (line / branch / function % per file)

cd ../frontend
npm test               # frontend unit tests, no npm install needed
npm run test:coverage  # same, plus coverage report
```

GitHub Actions (`.github/workflows/ci.yml`, T056) runs two jobs on every pull request and on pushes to `main`: `backend-tests` (`npm ci` and `npm run test:coverage` with a PostgreSQL service) and `frontend-tests` (`npm run test:coverage` in `frontend`). Both coverage tables are shown on the summary page of each run.

### Coverage (T081)

Coverage is measured with Node's built-in test coverage (`--experimental-test-coverage`), so no extra dependency is needed. Only files that the tests load are counted:

- Backend: all files in `backend/src`. The tests load `app.js` and therefore every route, middleware and repository. Only `index.js` (3 lines, starts the server) is not loaded.
- Frontend: the scripts with public functions (`util`, `config`, `api`, `data`, `state`, `fasting`, `ui`). The page scripts only wire up the DOM and are tested manually in the browser.

| | Tests | Lines | Branches | Functions |
|---|---|---|---|---|
| Backend, baseline 20.11.2026 (T081) | 38 | 96.9 % | 83.3 % | 90.7 % |
| Backend after T082/T083 | 65 | **100 %** | **100 %** | **100 %** |
| Frontend after T083 (before: no tests) | 65 | **100 %** | **100 %** | **100 %** |
| Minimum in CI (both, CI fails below) | | 100 % | 100 % | 100 % |

Rules from the feedback of 20.11.2026:

- Every `if` is tested for both outcomes, true and false (branch coverage, T082). This also covers `? :`, `||` defaults and `&&` conditions.
- Every public function has at least one test (function coverage, T083): exported functions in the backend, functions on `C2F` in the frontend.
- A branch that can never be reached is removed instead of being "tested" (examples: `req.body || {}`, because `express.json()` always sets `req.body`; an empty Bearer token, because Node trims header values).
- New code must keep 100 %: otherwise the CI check fails.

## 3. Traceability: requirement → story → tests

| Req | Story | Automated tests | Status |
|---|---|---|---|
| F01 Select saved product | US02, US03 | `products`: search (case-insensitive, wildcard, pagination), get by barcode | covered (backend) |
| F09 Manual product entry | US05, US21 | `products`: create with kcal/protein/carbs/fat, validation (400), without barcode (missing/null/empty), several products without barcode (T078) | covered (backend); form checked in the browser |
| F03 Save product, no duplicates | US05 | `products`: create, trim barcode, validation, parallel create → one 201 + one 409 | covered |
| F04 Calculate & save intake | US08 | `diary`: addEntry calculates kcal/macros; `diary.api`: POST /intake (calculation, defaults, 400/404) | covered |
| F05 Intake history | US09, US17 | `diary`: totals per range; `diary.api`: GET /diary/totals (range, 400) | covered (backend) |
| F08 User diary | US17 | `diary`: day, totals, meals; `diary.api`: GET /diary, GET /intake, DELETE /intake/:id, Vienna day rule | covered (backend) |
| F11 Account & multi-device | US06 | `auth`: register, login, middleware, two logins → two valid tokens | covered |
| NF03 Simultaneous access | US12 | `concurrency`: 3 users in parallel (register, log, read), no errors, correct totals | covered for 2–3 users |
| C02 REST + documentation | US15 | `openapi`: spec is valid | covered |
| F02 Scan, F10 external DB | US04, US16 | – | **gap:** Open Food Facts client (T055) not implemented yet; tests need a mocked HTTP client |
| F06 Warnings | US10 | frontend `state`: status/checks (too much, too little, fat, protein, 18:00 rule), daily target | covered (frontend) |
| F07 Fasting | US11 | frontend `fasting`: 16:8/18:6/20:4, Ramadan before / during (day X of N) / after, invalid dates and times (T077) | covered (frontend) |
| NF01 Usability, NF02 Responsive | US18 | – | manual test planned (usability test with 3+ users, 3 phone sizes) |
| NF04 Fast load time | US12 | – | measure with browser dev tools, screenshot in the documentation (PO: numbers not fixed) |
| C01 Ad-free | – | – | manual check of dependencies (no ad SDKs) |

Suite size: backend 65 tests (app 15, auth 11, products 12, diary 9, diary.api 14, concurrency 3, openapi 1), frontend 65 tests (api 19, state 15, util 12, fasting 11, ui 8).

## 4. Known gaps and next steps

1. Open Food Facts client (US16, T055): add tests with a mocked HTTP client once it exists (known barcode, unknown barcode, timeout, OFF error).
2. Frontend is not connected to the diary endpoints yet (it keeps the diary in the browser). An end-to-end check is needed once it is.
3. Usability and responsive test (US18) and measurement of load times (NF04) are manual.
4. Load test with many users (PO mentioned up to 800 for the external server) is not covered; NF03 only requires 2–3 users for the app itself.

## 5. Findings (bugs found by tests)

| # | Finding | Cause | Fix |
|---|---|---|---|
| 1 | `GET /diary?date=2026-02-30` and `/diary/totals` answered HTTP 500 | `Date.parse()` accepts impossible dates (rolls over), PostgreSQL rejects them | date is checked with a round trip (`isRealDay`) |
| 2 | `POST /intake` with `consumedAt: 5` or `2026-02-30T10:00:00Z` answered HTTP 500 | same lenient parsing, number accepted | `consumedAt` must be an ISO 8601 string with time zone |
| 3 | `POST /intake` with `productId` ≥ 2^31 answered HTTP 500 | value out of range for PostgreSQL `integer` | `productId` > 2147483647 → 400 |

Regression tests: `diary.api.test.js` ("returns 400 for invalid input…", "…invalid dates", "…invalid periods").
