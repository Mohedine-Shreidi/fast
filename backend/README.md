# FastAPI Auth Backend

## Setup

1. Create a virtual environment.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Start MySQL and create a database named `ram_store`.
4. Copy `.env.example` to `.env` and update values.
5. Seed default admin:
   `python -m app.seed`
6. Start the API:
   `uvicorn app.main:app --reload`

## MySQL quick check

- Ensure the connection string in `.env` points to a reachable server.
- Default value:
   `DATABASE_URL=mysql+pymysql://root@127.0.0.1:3306/ram_store`

## Default seeded admin

- Email: `admin@ramstore.com`
- Password: `Admin@12345`

## Required Endpoints

- `POST /register`
- `POST /login`
- `GET /users` (admin only)
- `PUT /users/{id}` (admin only)
- `DELETE /users/{id}` (admin only)
- `GET /stats/count` (authenticated)
- `GET /stats/average-age` (authenticated)
- `GET /stats/top-cities` (authenticated)

## RAM Store Endpoints

- `GET /products` (public)
- `GET /products/{id}` (public)
- `POST /products` (admin only)
- `PUT /products/{id}` (admin only)
- `DELETE /products/{id}` (admin only)
- `POST /orders` (authenticated)
- `POST /orders/quote` (authenticated)
- `GET /orders/me` (authenticated)
- `GET /orders` (admin only)
- `GET /orders/{id}/summary` (owner or admin)
- `PUT /orders/{id}/status` (admin only)

## Optional Query on GET /users

- Pagination: `page`, `limit`
- Filters: `age`, `city`, `type`, `name`

## Postman verification

1. Import `postman/ram-auth.postman_collection.json`.
2. Import `postman/ram-auth.postman_environment.json`.
3. Run requests in this order:
   - Register Client
   - Login Admin
   - Login Client
   - Get Users (Admin)
   - Get Users (Client - Expect 403)
   - Update User (Admin)
   - Delete User (Admin)
   - Stats Count / Average Age / Top Cities

## Scripted verification (PowerShell)

After MySQL is running and the API is started, you can run:

`./scripts/verify-api.ps1`

The script validates auth, RBAC, users management, stats routes, product listing, order creation, and admin order status updates.
It also validates money consistency for quote, created orders, and order summary payloads.

Optional parameters:

`./scripts/verify-api.ps1 -BaseUrl "http://127.0.0.1:8000" -AdminEmail "admin@ramstore.com" -AdminPassword "Admin@12345"`

## Automated backend tests

Run the API unit/integration tests with:

`python -m pytest -q`

The tests cover register/login, duplicate email handling, RBAC checks, stats routes, product CRUD access control, order creation, and order status updates.

## CI-style checks

Backend quick check command:

`./scripts/ci-check.ps1`

This runs syntax compile and pytest in sequence.

## Live smoke verification (auto port)

If port `8000` is busy, use this one-command flow:

`./scripts/smoke-live.ps1`

What it does:

- Finds a free port starting at `8000`
- Applies `alembic upgrade head`
- Starts uvicorn on that port
- Waits for `/health` to be ready
- Runs `./scripts/verify-api.ps1` against the detected base URL
- Stops the API process automatically

Optional arguments:

`./scripts/smoke-live.ps1 -BasePort 8010 -MaxPortScan 20`

## Database migrations (Alembic)

Create a new migration after model changes:

`python -m alembic revision --autogenerate -m "describe_change"`

Apply migrations:

`python -m alembic upgrade head`

Current baseline migration file is in `migrations/versions/`.

## Error response contract

Errors use a unified response envelope:

`{"error": {"code": "...", "message": "...", "timestamp": "...", "details": ...}}`

Examples:

- Validation errors: `code = validation_error`
- HTTP errors: `code = http_<status>`
- Body too large: `code = entity_too_large`

## Observability

The API now includes request-level observability middleware:

- `X-Request-ID` response header for request correlation
- Request logs with method, path, status, duration, and request ID
- Unified error payloads include `request_id` when available

Configurable environment variables:

- `LOG_LEVEL` (default `INFO`)
- `LOG_REQUESTS` (default `true`)

## Order totals contract

Order payloads now include an explicit money breakdown:

- `subtotal_amount`
- `tax_amount`
- `shipping_amount`
- `total_amount`

Invariant enforced in tests and verification scripts:

`subtotal + tax + shipping == total` (rounded to 2 decimals)
