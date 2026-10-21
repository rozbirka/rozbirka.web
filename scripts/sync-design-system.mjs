#!/usr/bin/env node
/**
 * Copies the design system's v2 tokens and kit into the app stylesheet tree.
 *
 * `docs/design-system/v2` is the source of truth; `src/styles/rz-*.css` are
 * generated from it so the app can never drift from the package. The only
 * change is dropping `@font-face` blocks: the app already declares the same
 * self-hosted fonts in `src/index.css` with root-relative URLs.
 *
 *   node scripts/sync-design-system.mjs          write the copies
 *   node scripts/sync-design-system.mjs --check  fail if they are stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'docs/design-system/v2')
const target = join(root, 'src/styles')

const files = [
  ['tokens.css', 'rz-tokens.css'],
  ['kit.css', 'rz-kit.css'],
]

const header = (name) =>
  `/* GENERATED from docs/design-system/v2/${name} by scripts/sync-design-system.mjs — do not edit. */\n`

export function render(name, css) {
  const withoutFonts = css.replace(/@font-face\s*\{[^}]*\}\s*/g, '')
  return header(name) + withoutFonts
}

const check = process.argv.includes('--check')
let stale = 0
for (const [from, to] of files) {
  const expected = render(from, readFileSync(join(source, from), 'utf8'))
  const path = join(target, to)
  if (check) {
    let actual = ''
    try {
      actual = readFileSync(path, 'utf8')
    } catch {
      // missing counts as stale
    }
    if (actual !== expected) {
      stale += 1
      console.error(`${to} is out of date with docs/design-system/v2/${from}`)
    }
  } else {
    writeFileSync(path, expected)
    console.log(`wrote src/styles/${to}`)
  }
}
if (stale > 0) {
  console.error('Run: node scripts/sync-design-system.mjs')
  process.exit(1)
}
