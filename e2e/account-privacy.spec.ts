import { expect, test } from '@playwright/test'

test('legal page has contact-only navigation for every visitor', async ({
  page,
}) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Як ми поводимось з даними',
  )
  const links = await page
    .getByRole('link')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')))
  expect(links.length).toBeGreaterThan(0)
  expect(links.every((href) => href === 'mailto:support@rozbirka.com')).toBe(
    true,
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('privacy.png'),
    fullPage: true,
  })
})

for (const access of ['none', 'inactive', 'blocked']) {
  test(`personal deletion remains available with ${access} company access`, async ({
    page,
  }) => {
    await page.route('**/session/refresh', (route) =>
      route.fulfill({ json: { accessToken: 'fixture-only', expiresIn: 900 } }),
    )
    let deleted = false
    let attempts = 0
    await page.route('**/auth/me', (route) => {
      if (route.request().method() === 'DELETE') {
        attempts += 1
        if (attempts === 1)
          return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
        deleted = true
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({
        json: {
          data: {
            id: 'u1',
            displayName: 'Олена',
            phone: '+380501234567',
            isActive: true,
            role: 'owner',
            lastLoginAt: null,
          },
        },
      })
    })
    await page.route('**/api/v1/tenants', (route) =>
      route.fulfill({
        json: {
          data:
            access === 'none'
              ? []
              : [
                  {
                    id: 't1',
                    slug: 'test',
                    name: 'Компанія',
                    isActive: access !== 'inactive',
                    plan: access === 'blocked' ? 'blocked' : 'active',
                    roleName: 'owner',
                    createdAt: '2026-01-01T00:00:00Z',
                  },
                ],
        },
      }),
    )
    await page.goto('/account/security')
    await expect(
      page.getByRole('heading', { name: 'Особистий акаунт' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Політика конфіденційності' }),
    ).toHaveAttribute('href', '/privacy')
    await page.screenshot({
      path: test.info().outputPath('account.png'),
      fullPage: true,
    })
    await page
      .getByRole('button', { name: 'Видалити акаунт', exact: true })
      .click()
    await page.getByRole('button', { name: 'Так, видалити акаунт' }).click()
    await expect(page.getByRole('alert')).toContainText(
      'Не вдалося видалити акаунт',
    )
    await expect(page).toHaveURL(/account\/security$/)
    expect(deleted).toBe(false)
    await page
      .getByRole('button', { name: 'Видалити акаунт', exact: true })
      .click()
    await page.getByRole('button', { name: 'Так, видалити акаунт' }).click()
    await expect(page).toHaveURL(/login$/)
    expect(deleted).toBe(true)
  })
}
