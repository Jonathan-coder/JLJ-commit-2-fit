# Test plan – Commit2Fit

Owner: Test Engineer (Sprint 3/4). Status: Sprint 4 (T073).

## 1. Strategy

| Level | What | Tool | Where |
|---|---|---|---|
| Database / repository | Migrations, constraints, views, diary queries | `node:test` + PostgreSQL test database | `backend/tests/diary.test.js` |
| API integration | Every REST endpoint incl. auth, validation (400/404, never 500), owner isolation | `node:test` + `supertest` | `auth`, `products`, `diary.api` tests |
| Concurrency | Several users at the same time (NF03) | `supertest`, parallel requests | `backend/tests/concurrency.test.js` |
| API contract | `openapi.yaml` is a valid OpenAPI document | `@apidevtools/swagger-parser` | `backend/tests/openapi.test.js` |
| Manual / browser | Frontend flows, responsive layout (NF02), usability (NF01), load times (NF04) | Browser dev tools, test protocol | see US18 |

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
```

GitHub Actions (`.github/workflows/ci.yml`, T056) runs `npm ci` and `npm run test:coverage` with a PostgreSQL service on every pull request and on pushes to `main`. The coverage table is shown on the summary page of each run.

### Coverage (T081)

Coverage is measured with Node's built-in test coverage (`--experimental-test-coverage`) for all files in `backend/src`, so no extra dependency is needed. Only files that the tests load are counted; the tests load `app.js` and therefore every route, middleware and repository. Only `index.js` (server start) is not loaded.

Baseline on 20.11.2026 (38 tests):

| | Lines | Branches | Functions |
|---|---|---|---|
| All files | 96.9 % | 83.3 % | 90.7 % |
| Minimum (CI fails below) | 95 % | 80 % | 90 % |
| Target (feedback 20.11.2026) | – | 100 % | 100 % |

Rules from the feedback of 20.11.2026:

- Every `if` is tested for both outcomes, true and false (branch coverage, T082).
- Every public (exported) function has at least one test (function coverage, T083).
- When coverage goes up, the minimum in `package.json` (`test:coverage`) is raised as well, so it cannot drop again.

Files with missing branches at the baseline: `config.js` (10 %), `db.js` (33 %), `errorHandler.js` (40 %), `routes/auth.js` (80 %), `intake.js` (86 %), `middleware/auth.js` (86 %), `products.js` (88 %), `repositories/diary.js` (98 %). Functions without a test: in `app.js` and `db.js`.

## 3. Traceability: requirement → story → tests

| Req | Story | Automated tests | Status |
|---|---|---|---|
| F01 Select saved product | US02, US03 | `products`: search (case-insensitive, wildcard, pagination), get by barcode | covered (backend) |
| F09 Manual product entry | US05 | `products`: create with kcal/protein/carbs/fat, validation (400) | covered (backend); form is checked manually |
| F03 Save product, no duplicates | US05 | `products`: create, trim barcode, validation, parallel create → one 201 + one 409 | covered |
| F04 Calculate & save intake | US08 | `diary`: addEntry calculates kcal/macros; `diary.api`: POST /intake (calculation, defaults, 400/404) | covered |
| F05 Intake history | US09, US17 | `diary`: totals per range; `diary.api`: GET /diary/totals (range, 400) | covered (backend) |
| F08 User diary | US17 | `diary`: day, totals, meals; `diary.api`: GET /diary, GET /intake, DELETE /intake/:id, Vienna day rule | covered (backend) |
| F11 Account & multi-device | US06 | `auth`: register, login, middleware, two logins → two valid tokens | covered |
| NF03 Simultaneous access | US12 | `concurrency`: 3 users in parallel (register, log, read), no errors, correct totals | covered for 2–3 users |
| C02 REST + documentation | US15 | `openapi`: spec is valid | covered |
| F02 Scan, F10 external DB | US04, US16 | – | **gap:** Open Food Facts client (T055) not implemented yet; tests need a mocked HTTP client |
| F06 Warnings, F07 Fasting | US10, US11 | – | frontend only, manual browser test |
| NF01 Usability, NF02 Responsive | US18 | – | manual test planned (usability test with 3+ users, 3 phone sizes) |
| NF04 Fast load time | US12 | – | measure with browser dev tools, screenshot in the documentation (PO: numbers not fixed) |
| C01 Ad-free | – | – | manual check of dependencies (no ad SDKs) |

Suite size: 38 tests (auth 6, products 6, diary 9, diary.api 13, concurrency 3, openapi 1).

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
