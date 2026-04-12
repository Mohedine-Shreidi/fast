# Deployment Guide

## 1) Backend environment

Required environment variables:

- `DATABASE_URL`
- `SECRET_KEY`
- `ENVIRONMENT` (set to `production` in production)
- `CORS_ORIGINS`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `MAX_REQUEST_SIZE_BYTES`
- `LOG_LEVEL`
- `LOG_REQUESTS`

Notes:

- `SECRET_KEY` must be explicitly set in production/staging.
- `CORS_ORIGINS` supports comma-separated values.

## 2) Frontend environment

Required environment variables:

- `VITE_API_URL` (public backend base URL)
- `VITE_API_TIMEOUT_MS` (optional)

## 3) Pre-deploy release gate

Run full gate locally:

```powershell
./verify-all.ps1 -RunE2E
```

This verifies:

- Backend smoke tests
- Frontend build + unit tests
- Frontend E2E tests

## 4) CI gate

GitHub Actions workflow:

- `.github/workflows/ci.yml`

CI enforces:

- Backend `pytest`
- Frontend `npm run verify`
- Frontend `npm run test:e2e`

## 5) Production rollout checklist

- Apply DB migrations:

```bash
python -m alembic upgrade head
```

- Seed initial admin if required:

```bash
python -m app.seed
```

- Verify health endpoint:

```bash
curl -sS http://<backend-host>/health
```

- Validate request tracing:

Check response headers include `X-Request-ID`.

- Validate auth-protected stats:

`/stats/count`, `/stats/average-age`, `/stats/top-cities` should require a valid token.

## 6) Rollback guidance

- Keep previous backend artifact and frontend build available.
- Roll back application deploy.
- If schema changed incompatibly, restore DB from pre-deploy snapshot.
- Re-run smoke checks against rollback target.
