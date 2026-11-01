import { test as base } from '@playwright/test'
import { e2ePorts } from './ports'

export { expect } from '@playwright/test'
export type { APIRequestContext, Page, Route } from '@playwright/test'

function ports() {
  return e2ePorts(test.info().parallelIndex)
}

export function appOrigin() {
  return `http://127.0.0.1:${ports().app}`
}

export function upstreamOrigin() {
  return `http://127.0.0.1:${ports().upstream}`
}

export const test = base.extend({
  // Playwright requires the destructured first argument even when unused.
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, provide, testInfo) => {
    await provide(`http://127.0.0.1:${e2ePorts(testInfo.parallelIndex).app}`)
  },
})
