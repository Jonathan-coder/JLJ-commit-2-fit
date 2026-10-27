# Commit2Fit Backend

## Quickstart

```bash
npm install
npm run db:up
npm run migrate
npm run seed
npm start
```

The server starts on `http://localhost:3000` by default.

## Environment variables

Copy `.env.example` to `.env` and adjust values as needed:

- `DATABASE_URL` — primary PostgreSQL connection string
- `TEST_DATABASE_URL` — PostgreSQL used by the test suite
- `JWT_SECRET` — secret used to sign JWTs
- `JWT_EXPIRES_IN` — JWT lifetime, e.g. `7d`
- `PORT` — server port

## Useful scripts

- `npm run db:up` — start PostgreSQL with Docker Compose
- `npm run db:down` — stop and remove the PostgreSQL volume
- `npm run migrate` — apply pending database migrations
- `npm run migrate:down` — roll back the latest migration
- `npm run db:reset` — rebuild the database from scratch
- `npm run seed` — insert demo users and products
- `npm test` — run the integration test suite

## Swagger UI

Open `http://localhost:3000/api-docs` to view the API documentation.
