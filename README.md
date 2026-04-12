# RAM Store - Run On Another Device

This repo has 2 apps:

- `backend` - FastAPI + MySQL
- `frontend` - React + TypeScript + Vite

If you follow the steps below in order, you can run the full project locally on a new machine.

## 1) Prerequisites

Install these first:

- Python 3.11+ (3.12 recommended)
- Node.js 20+ (22 recommended)
- MySQL 8+
- Git

Confirm versions:

```powershell
python --version
node --version
npm --version
```

## 2) Clone and enter the repo

```powershell
git clone <your-repo-url>
cd "fast api"
```

## 3) Create the MySQL database

Create a database named `ram_store`.

Example in MySQL shell:

```sql
CREATE DATABASE ram_store;
```

## 4) Backend setup

### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and verify values (defaults are usually fine for local):

```env
DATABASE_URL=mysql+pymysql://root@127.0.0.1:3306/ram_store
SECRET_KEY=change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173
```

Apply migrations and seed initial data:

```powershell
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m app.seed
```

Start backend:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- Swagger docs: `http://127.0.0.1:8000/docs`

## 5) Frontend setup

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

`frontend/.env` should contain:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start frontend:

```powershell
npm run dev
```

Frontend URL:

- App: `http://localhost:5173`

## 6) Default test account

After seeding:

- Email: `admin@ramstore.com`
- Password: `Admin@12345`

## 7) Quick verification commands

From repo root:

```powershell
./verify-all.ps1
```

Full gate (includes E2E):

```powershell
./verify-all.ps1 -RunE2E
```

## 8) Common issues

- `Table ... already exists` during migration:
	- local DB already has schema; run with a fresh DB or stamp/reconcile migrations.
- Backend does not start:
	- ensure MySQL is running and `DATABASE_URL` is correct.
- Frontend cannot call API:
	- confirm `frontend/.env` points to backend URL.
- Playwright E2E browser missing:

```powershell
cd frontend
npx playwright install chromium
```

## 9) Helpful docs

- Backend details: `backend/README.md`
- Frontend details: `frontend/README.md`
- Deployment checklist: `DEPLOYMENT.md`

