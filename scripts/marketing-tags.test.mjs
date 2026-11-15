import assert from 'node:assert/strict'
import { test } from 'node:test'
import vm from 'node:vm'
import { marketingTags } from './marketing-tags.mjs'

function load(hostname, protocol = 'https:') {
  const scripts = []
  const window = {
    location: { hostname, protocol, href: `${protocol}//${hostname}/` },
  }
  const document = {
    createElement: () => ({}),
    head: { appendChild: (script) => scripts.push(script) },
  }
  const html = marketingTags(true)
  vm.runInNewContext(html.replace(/^<script>\n|\n<\/script>$/g, ''), {
    window,
    document,
    Date,
    URL,
  })
  return { scripts, window }
}

test('only canonical HTTPS production loads marketing tags', () => {
  const { scripts, window } = load('rozbirka.pro')
  assert.deepEqual(
    scripts.map(({ src }) => src),
    [
      'https://www.googletagmanager.com/gtm.js?id=GTM-MV5L2BBG',
      'https://www.googletagmanager.com/gtag/js?id=G-D35DJ28PLE',
    ],
  )
  assert.equal(window.dataLayer[0].event, 'gtm.js')
  assert.ok(window.dataLayer[0]['gtm.start'] > 0)
  assert.equal(window.dataLayer[2][0], 'config')
  assert.equal(window.dataLayer[2][1], 'G-D35DJ28PLE')
})

for (const host of [
  'localhost',
  '127.0.0.1',
  'qa.rozbirka.pro',
  'preview.workers.dev',
  'rozbirka.pro.example.com',
]) {
  test(`no Google requests or queue on ${host}`, () => {
    const { scripts, window } = load(host)
    assert.equal(scripts.length, 0)
    assert.equal(window.dataLayer, undefined)
  })
}

test('plain HTTP production is excluded', () => {
  assert.equal(load('rozbirka.pro', 'http:').scripts.length, 0)
})

test('QA and non-production builds contain no tags even on production host', () => {
  assert.equal(marketingTags(false), '')
  assert.equal(marketingTags(), '')
})
