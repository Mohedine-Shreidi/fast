import { expect, test } from '@playwright/test'

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createToken(role: 'admin' | 'client'): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(
    JSON.stringify({
      sub: `${role}@test.dev`,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
  return `${header}.${payload}.signature`
}

test('unauthenticated user is redirected to login for protected routes', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: /login/i })).toBeVisible()
})

test('client login can access dashboard and is blocked from admin routes', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: createToken('client'),
        token_type: 'bearer',
      }),
    })
  })

  await page.goto('/login')

  await page.locator('input[type="email"]').fill('client@test.dev')
  await page.locator('input[type="password"]').fill('Password@123')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: /account dashboard/i })).toBeVisible()
  await expect(page.getByText(/role:\s*client/i)).toBeVisible()

  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/forbidden$/)
  await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible()
})

test('admin login can access admin users route', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: createToken('admin'),
        token_type: 'bearer',
      }),
    })
  })

  await page.route('http://127.0.0.1:8000/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      }),
    })
  })

  await page.goto('/login')

  await page.locator('input[type="email"]').fill('admin@test.dev')
  await page.locator('input[type="password"]').fill('Admin@12345')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: /admin user management/i })).toBeVisible()
})
