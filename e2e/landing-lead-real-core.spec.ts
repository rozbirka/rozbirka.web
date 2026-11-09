import { expect, test } from '@playwright/test'

const core = 'http://127.0.0.1:54831'
const assets = 'http://127.0.0.1:54832'
const fixtureName = 'Lead E2E Synthetic'
const fixtureContact = '@lead_e2e_fixture'

// These virtual production origins are always intercepted before navigation.
// Only loopback requests leave Playwright; Google scripts and collectors abort.
for (const scenario of [
  {
    name: 'accepted delivery',
    messageOk: true,
    honeypot: false,
    status: 202,
    events: 1,
    sends: 1,
  },
  {
    name: 'Telegram rejection',
    messageOk: false,
    honeypot: false,
    status: 503,
    events: 0,
    sends: 1,
  },
  {
    name: 'honeypot',
    messageOk: true,
    honeypot: true,
    status: 202,
    events: 0,
    sends: 0,
  },
]) {
  test(`${scenario.name}: real Core result controls lead conversion`, async ({
    context,
    page,
    request,
  }) => {
    await request.post(`${core}/_test/reset`, {
      data: { messageOk: scenario.messageOk },
    })
    await context.addInitScript(() => {
      Object.defineProperty(window, 'dataLayer', { value: [], writable: true })
    })
    const statuses: number[] = []
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (
        url.hostname === 'api.rozbirka.pro' &&
        url.pathname === '/api/v1/support/leads'
      ) {
        const response = await route.fetch({
          url: `${core}${url.pathname}`,
          maxRedirects: 0,
        })
        if (route.request().method() === 'POST')
          statuses.push(response.status())
        await route.fulfill({ response })
      } else if (
        url.origin === 'https://rozbirka.pro' &&
        route.request().method() === 'GET'
      ) {
        const response = await route.fetch({
          url: `${assets}${url.pathname}${url.search}`,
          maxRedirects: 0,
        })
        await route.fulfill({ response })
      } else {
        await route.abort('blockedbyclient')
      }
    })
    await page.goto('https://rozbirka.pro/')
    await page.getByLabel("Ім'я", { exact: true }).fill(fixtureName)
    await page
      .getByLabel('Телефон або Telegram', { exact: true })
      .fill(fixtureContact)
    if (scenario.honeypot) {
      await page.locator('input[name="website"]').evaluate((element) => {
        ;(element as HTMLInputElement).value = 'https://bot.invalid'
      })
    }
    await page
      .getByRole('button', {
        name: 'Отримати 14 днів безкоштовно',
        exact: true,
      })
      .click()
    await expect.poll(() => statuses).toEqual([scenario.status])
    if (scenario.status === 202) {
      await expect(page.getByRole('status')).toContainText('Дякуємо!')
    } else {
      await expect(page.getByRole('alert')).toContainText(
        'Не вдалося надіслати заявку',
      )
    }
    const events = await page.evaluate(() => {
      const queue =
        (window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ??
        []
      return queue
        .map((entry) => Array.from(entry))
        .filter((entry) => entry[0] === 'event' && entry[1] === 'generate_lead')
    })
    expect(events).toHaveLength(scenario.events)
    if (scenario.events)
      expect(events).toEqual([
        ['event', 'generate_lead', { lead_source: 'landing_form' }],
      ])
    expect(JSON.stringify(events)).not.toContain(fixtureName)
    expect(JSON.stringify(events)).not.toContain(fixtureContact)
    const stats = (await (await request.get(`${core}/_test/stats`)).json()) as {
      methods: string[]
    }
    expect(stats.methods).toEqual(
      scenario.sends ? ['createForumTopic', 'sendMessage'] : [],
    )
  })
}
