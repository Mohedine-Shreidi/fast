# RAM Store Frontend

React + TypeScript frontend for the RAM selling website and admin dashboard.

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`.
3. Set backend URL in `.env`:
   `VITE_API_URL=http://127.0.0.1:8000`
4. Start development server:
   `npm run dev`

## Key pages

- Public store: `/`, `/products`, `/cart`
- Product details: `/products/:id`
- Authentication: `/login`, `/register`
- Client area: `/dashboard`, `/orders/me`, `/orders/me/:orderId`
- Admin area: `/admin/users`, `/admin/products`, `/admin/orders`, `/admin/orders/:orderId`
- Access denied view: `/forbidden`

## Verification

Build and type-check:

`npm run verify`

This runs the frontend production build (TypeScript + Vite) and frontend unit tests.

Run end-to-end tests:

`npm run test:e2e`

E2E tests run with Playwright and automatically start a local preview server.

Current E2E coverage includes:

- Guest fallback on home stats
- Login and protected route redirects
- Admin route access control
