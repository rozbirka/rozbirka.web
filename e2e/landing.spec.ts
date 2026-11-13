import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'

test('prerendered landing paints before hydration entry downloads', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Matches the Lighthouse browser')
  await page.goto('/', { waitUntil: 'networkidle' })

  const timing = await page.evaluate(() => {
    const paint = performance.getEntriesByName('first-contentful-paint')[0]
    const entry = performance
      .getEntriesByType('resource')
      .find((resource) =>
        /\/assets\/index-[^/]+\.js$/.test(new URL(resource.name).pathname),
      )
    return { paint: paint?.startTime, hydration: entry?.startTime }
  })

  expect(timing.paint).toBeDefined()
  expect(timing.hydration).toBeDefined()
  expect(timing.hydration).toBeGreaterThanOrEqual(timing.paint ?? Infinity)
})

test('the advertised OG cover is publicly served as a PNG by the Worker', async ({
  page,
}) => {
  await page.goto('/')
  const imageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content')
  expect(imageUrl).toBeTruthy()
  const response = await page.request.get(new URL(imageUrl!).pathname, {
    headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' },
  })
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/png')
  expect([...(await response.body()).subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ])
})

test('retired SEO use-case URLs return the branded 404 page', async ({
  page,
}) => {
  for (const path of [
    '/oblik-avtozapchastyn',
    '/oblik-avtozapchastyn/',
    '/oblik-prodazhiv-avtozapchastyn',
    '/oblik-prodazhiv-avtozapchastyn/',
  ]) {
    const response = await page.goto(path)

    expect(response?.status(), path).toBe(404)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Сторінку не знайдено' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'На головну' }),
    ).toHaveAttribute('href', '/')
  }
})

test('landing interactions work without serious accessibility violations', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )
  await expect(
    page.getByRole('heading', {
      name: 'Усе для щоденної роботи авторозбірки',
    }),
  ).toHaveCount(0)
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([])

  const second = page.getByRole('button', {
    name: 'Як швидко я можу почати працювати після реєстрації?',
  })
  await second.click()
  await expect(second).toHaveAttribute('aria-expanded', 'true')
  await expect(
    page.getByRole('link', { name: 'Почати 14 днів безкоштовно' }),
  ).toHaveAttribute('href', '/login?purpose=registration&plan=pro_monthly')
})

test('landing content is immediately visible with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )

  for (const id of ['top', 'reviews', 'features', 'pricing', 'faq']) {
    const section = page.locator(`#${id}`)
    await section.scrollIntoViewIfNeeded()
    await expect(section).toHaveCSS('opacity', '1')
    await expect(section).toHaveCSS('transform', 'none')
  }
  await expect(page.locator('#top [data-count]').first()).toHaveText(
    /^\$3\s200$/,
  )
})

test('blocks below the fold fade in when scrolled into view', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('#root')).toHaveAttribute(
    'data-app-hydrated',
    'true',
  )

  const faq = page.locator('#faq')
  await faq.scrollIntoViewIfNeeded()
  await expect(faq).toHaveCSS('opacity', '1')
})

test('direct SPA deep links mount one matching page without hydration warnings', async ({
  page,
}) => {
  const hydrationWarnings: string[] = []
  page.on('console', (message) => {
    if (/hydrat|No HydrateFallback/i.test(message.text())) {
      hydrationWarnings.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    if (/hydrat/i.test(error.message)) hydrationWarnings.push(error.message)
  })

  await page.goto('/privacy')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Як ми поводимось з даними',
    }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Знаєш, де кожна деталь і де твої гроші/,
    }),
  ).toHaveCount(0)
  expect(hydrationWarnings).toEqual([])
})

test.describe('responsive matrix', () => {
  test('uses the Unbounded and Onest typography of the mock-up', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    const fonts = await page.evaluate(() => ({
      heading: getComputedStyle(document.querySelector('h1 > span:last-child')!)
        .fontFamily,
      body: getComputedStyle(document.querySelector('#top p')!).fontFamily,
    }))
    expect(fonts.heading).toContain('Unbounded')
    expect(fonts.body).toContain('Onest')
  })

  for (const { width, expectedFontSize } of [
    { width: 375, expectedFontSize: '36px' },
    { width: 1600, expectedFontSize: '72px' },
  ]) {
    test(`scales the hero heading at ${width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/')

      await expect(page.locator('h1 > span').last()).toHaveCSS(
        'font-size',
        expectedFontSize,
      )
    })
  }

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'The screenshot matrix is captured once in desktop Chromium',
      )
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/', { waitUntil: 'networkidle' })
      await expect(page.locator('#root')).toHaveAttribute(
        'data-app-hydrated',
        'true',
      )
      // Settle font metrics before Playwright measures the full-page height.
      await page.evaluate(() => document.fonts.ready)
      await page
        .locator('img')
        .evaluateAll(async (images: HTMLImageElement[]) => {
          await Promise.all(
            images.map(async (image) => {
              image.loading = 'eager'
              await image.decode().catch(() => undefined)
            }),
          )
        })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth === window.innerWidth,
        ),
      ).toBe(true)
      // A full-page capture stretches the viewport itself and its height then
      // drifts by a few pixels between captures (the page is 14 523.2px tall,
      // the image 14 523 or 14 526). Size the viewport to the content instead.
      // The capture sizes the viewport to the whole page. Sizes set in vh
      // (the modules story steps and window) would then grow with it, so pin
      // them to their pixel values at the normal viewport first.
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>(
          '[class*="vh"]',
        )) {
          const style = getComputedStyle(element)
          element.style.minHeight = style.minHeight
          element.style.height = style.height
          element.style.top = style.top
        }
      })
      // scrollHeight, not the root's box: `html` is 100% of the viewport.
      const pageHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      )
      await page.setViewportSize({ width, height: pageHeight })
      await page.evaluate(() => window.scrollTo(0, 0))
      // Let observers and scroll-driven state react to the resize.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
      await page.waitForTimeout(500)
      const platformSuffix = process.platform === 'linux' ? '-linux' : ''
      await expect(page).toHaveScreenshot(
        `landing-${width}${platformSuffix}.png`,
        {
          animations: 'disabled',
          timeout: 15_000,
          // Glass cards (backdrop-filter) are composited on their own layers,
          // so their text can land a sub-pixel apart between runs: a few
          // hundred pixels of millions. Layout changes move far more.
          maxDiffPixels: 2000,
        },
      )
    })
  }
})
