import { expect, test } from '@playwright/test'
import { telegramSupportHref } from '../src/lib/telegram-support'

for (const [path, label] of [
  ['/', 'Написати в підтримку'],
  ['/en', 'Contact support'],
  ['/pl', 'Napisz do wsparcia'],
]) {
  test(`support links are localized and keyboard accessible at ${path}`, async ({
    page,
  }) => {
    await page.goto(path)
    const links = page.getByRole('link', { name: new RegExp(label) })
    const expectedHref = telegramSupportHref(
      process.env.VITE_TELEGRAM_SUPPORT_BOT,
    )
    if (!expectedHref) {
      await expect(links).toHaveCount(0)
      return
    }
    await expect(links).toHaveCount(2)
    await expect(links.first()).toHaveAttribute('href', expectedHref)
    await links.first().focus()
    await expect(links.first()).toBeFocused()
    const box = await links.first().boundingBox()
    expect(box!.width).toBeGreaterThan(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    const viewport = page.viewportSize()!
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(links.first()).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}
