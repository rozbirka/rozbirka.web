// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkContractPin } from './check-contract-pin.mjs'

const commit = '0123456789abcdef0123456789abcdef01234567'
const pinned = 'a'.repeat(64)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function fixture(header: string) {
  const directory = await mkdtemp(join(tmpdir(), 'rozbirka-contract-pin-'))
  temporaryDirectories.push(directory)
  const manifestPath = join(directory, 'openapi-sources.json')
  const generatedPath = join(directory, 'core.ts')
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 1,
      core: {
        uri: `gs://rozbirka-ci-openapi-contracts/core/${commit}/rozbirka-core.json`,
        sha256: pinned,
      },
    }),
  )
  await writeFile(generatedPath, `${header}\nexport interface paths {}\n`)
  return { manifestPath, generatedPath }
}

describe('Core contract pin check', () => {
  it('passes when core.ts was generated from the pinned contract', async () => {
    const paths = await fixture(
      `// Generated from Core OpenAPI input (sha256:${pinned}). Do not edit.`,
    )
    await expect(checkContractPin(paths)).resolves.toBeUndefined()
  })

  it('fails when core.ts was generated from another contract', async () => {
    const other = 'b'.repeat(64)
    const paths = await fixture(
      `// Generated from Core OpenAPI input (sha256:${other}). Do not edit.`,
    )
    await expect(checkContractPin(paths)).rejects.toThrow(
      `core.ts was generated from Core contract sha256:${other}, but contracts/openapi-sources.json pins sha256:${pinned}`,
    )
  })

  it('fails when core.ts has no provenance header', async () => {
    const paths = await fixture('// hand-written')
    await expect(checkContractPin(paths)).rejects.toThrow(
      'core.ts has no Core OpenAPI provenance header',
    )
  })

  it('matches the committed core.ts and manifest', async () => {
    await expect(checkContractPin()).resolves.toBeUndefined()
  })
})
