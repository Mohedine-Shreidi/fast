import { test, expect } from '@playwright/test';

test('guest sees sign-in fallback on home stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /performance memory/i })).toBeVisible();
    await expect(page.getByText(/sign in to view live customer stats/i)).toBeVisible();
});
