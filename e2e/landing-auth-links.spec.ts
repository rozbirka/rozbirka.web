import { expect, test } from './fixtures'

test('landing buttons open distinct login and registration forms', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )
  const nav = page.getByRole('navigation', { name: 'Головна навігація' })
  await nav.getByRole('link', { name: 'Спробувати', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Відкрити меню' })
  if (await menu.isVisible()) await menu.click()
  await page
    .getByRole('link', { name: 'Увійти', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'Вхід за номером телефону' }),
  ).toBeVisible()
})

test('pricing keeps registration intent and the selected plan after reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )
  await page
    .getByRole('link', { name: 'Почати 14 днів безкоштовно', exact: true })
    .click()
  await expect(page).toHaveURL('/login?purpose=registration&plan=pro_monthly')
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL('/login?purpose=registration&plan=pro_monthly')
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
})

test('header keeps the trial button inside its pill with a long account name', async ({
  page,
}) => {
  await page.route('**/session/refresh', (route) =>
    route.fulfill({
      json: { accessToken: 'landing-layout-fixture', expiresIn: 3600 },
    }),
  )
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        data: {
          id: 'layout-user',
          phone: '+380501112233',
          displayName: 'Тестовий користувач із дуже довгим ім’ям',
          role: 'owner',
          isActive: true,
        },
      },
    }),
  )
  await page.route('**/tenants', (route) =>
    route.fulfill({ json: { data: [] } }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const path of ['/', '/en', '/pl']) {
    await page.goto(path)
    await expect(page.locator('[data-login]').first()).toHaveAttribute(
      'href',
      '/account',
    )
    await page.evaluate(() => document.fonts.ready)
    for (const width of [
      320, 375, 768, 899, 900, 901, 1024, 1025, 1179, 1180, 1280, 1440, 1920,
    ]) {
      await page.setViewportSize({ width, height: 1000 })
      const bounds = await page
        .locator('header nav')
        .first()
        .evaluate((nav) => {
          const pill = nav.getBoundingClientRect()
          const cta = nav.querySelector('.lp-btn-glow')!.getBoundingClientRect()
          return {
            left: cta.left - pill.left,
            right: pill.right - cta.right,
            top: cta.top - pill.top,
            bottom: pill.bottom - cta.bottom,
          }
        })
      for (const gap of Object.values(bounds))
        expect(
          gap,
          `${path} at ${width}px: ${JSON.stringify(bounds)}`,
        ).toBeGreaterThanOrEqual(0)
      if (path === '/' && (width === 1024 || width === 1280)) {
        await test.info().attach(`header-${width}`, {
          body: await page.locator('header').screenshot(),
          contentType: 'image/png',
        })
      }
    }
  }
})
