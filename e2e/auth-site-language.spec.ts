import { expect, test } from '@playwright/test'

for (const entry of [
  {
    name: 'English (UK)',
    locale: 'en-GB',
    login: 'Log in',
    title: 'Sign in with your phone number',
    register: 'No account yet? Sign up',
    registrationTitle: 'Create an account',
  },
  {
    name: 'Polski',
    locale: 'pl',
    login: 'Zaloguj się',
    title: 'Logowanie numerem telefonu',
    register: 'Nie masz konta? Zarejestruj się',
    registrationTitle: 'Utwórz konto',
  },
]) {
  test(`landing language ${entry.locale} follows login and registration`, async ({
    page,
  }) => {
    await page.goto('/')
    const mobile = (page.viewportSize()?.width ?? 1280) < 1024
    if (mobile) {
      await page.getByRole('button', { name: 'Відкрити меню' }).click()
      await page.getByRole('link', { name: entry.name, exact: true }).click()
      await page
        .getByRole('button', {
          name: entry.locale === 'pl' ? 'Otwórz menu' : 'Open menu',
        })
        .click()
    } else {
      await page.getByRole('button', { name: 'Мова сайту: українська' }).click()
      await page.getByRole('menuitemradio', { name: entry.name }).click()
    }
    await page
      .getByRole('link', { name: entry.login, exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', entry.locale)
    await page.reload()
    await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
    await page.getByRole('button', { name: entry.register }).click()
    await expect(
      page.getByRole('heading', { name: entry.registrationTitle }),
    ).toBeVisible()
  })
}
