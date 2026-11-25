// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkContractPin } from './check-contract-pin.mjs'

const commit = '0123456789abcdef0123456789abcdef01234567'
const pinned = 'a'.repeat(64)
const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
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
    await expect(
      checkContractPin({
        localCorePath: process.env.ROZBIRKA_LOCAL_CORE_OPENAPI,
      }),
    ).resolves.toBeUndefined()
  })

  it('validates generated provenance against an explicitly selected local contract', async () => {
    vi.stubEnv('CI', '')
    const contract = JSON.stringify({ openapi: '3.0.1', paths: {} })
    const digest = createHash('sha256').update(contract).digest('hex')
    const paths = await fixture(
      `// Generated from Core OpenAPI input (sha256:${digest}). Do not edit.`,
    )
    const localCorePath = join(temporaryDirectories.at(-1)!, 'core.json')
    await writeFile(localCorePath, contract)

    await expect(
      checkContractPin({ ...paths, localCorePath }),
    ).resolves.toBeUndefined()
    await writeFile(localCorePath, contract + '\n')
    await expect(checkContractPin({ ...paths, localCorePath })).rejects.toThrow(
      'local Core OpenAPI file has sha256:',
    )
  })

  it('requires the published pin in CI', async () => {
    vi.stubEnv('CI', 'true')
    await expect(
      checkContractPin({ localCorePath: 'core.json' }),
    ).rejects.toThrow(
      'ROZBIRKA_LOCAL_CORE_OPENAPI is only supported for local checks',
    )
  })
})
