// Every Playwright worker gets its own app server and stub upstream, because
// the stub keeps global state (counters, tokens, delays) that tests reset and
// assert on. Worker 0 keeps the historical 4173/4174 pair.
export function e2ePorts(parallelIndex: number) {
  return { app: 4173 + 2 * parallelIndex, upstream: 4174 + 2 * parallelIndex }
}
