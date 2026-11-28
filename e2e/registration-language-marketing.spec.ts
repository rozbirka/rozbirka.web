import { expect, test } from './fixtures'

test.use({ locale: 'en-GB' })

test('Ukrainian landing keeps Ukrainian registration in an English browser, including reload', async ({
  page,
}) => {
  const googleRequests: string[] = []
  page.on('request', (request) => {
    if (
      /google-analytics\.com|googletagmanager\.com|googleadservices\.com/.test(
        request.url(),
      )
    )
      googleRequests.push(request.url())
  })
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('language-fixture-ready')) {
      localStorage.setItem('rozbirka.locale', 'en-GB')
      localStorage.setItem('rozbirka.site-locale', 'en-GB')
      sessionStorage.setItem('language-fixture-ready', 'true')
    }
  })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )
  await page
    .getByRole('navigation', { name: 'Головна навігація' })
    .getByRole('link', { name: 'Спробувати', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Країна номера' }),
  ).toHaveValue('UA')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Країна номера' }),
  ).toHaveValue('UA')
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('rozbirka.site-locale')),
    )
    .toBe('uk')
  expect(googleRequests).toEqual([])
})

test('direct registration on QA never creates a marketing queue or Google requests', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (
      /google-analytics\.com|googletagmanager\.com|googleadservices\.com/.test(
        request.url(),
      )
    )
      requests.push(request.url())
  })
  await page.goto('/login?purpose=registration')
  await expect(page.getByRole('heading')).toBeVisible()
  expect(await page.evaluate(() => 'dataLayer' in window)).toBe(false)
  expect(requests).toEqual([])
})
