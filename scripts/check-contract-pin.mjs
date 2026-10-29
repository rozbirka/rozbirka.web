import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseManifest } from './fetch-api-contracts.mjs'

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..')
const provenance =
  /^\/\/ Generated from Core OpenAPI input \(sha256:([0-9a-f]{64})\)\. Do not edit\.$/m

/**
 * The drift gate in CI fetches the pinned contract from GCS, which is not
 * reachable locally. Comparing the digest that `contracts:generate` writes into
 * core.ts with the manifest pin catches a regenerated core.ts whose pin was
 * not moved along with it, without network access.
 */
export async function checkContractPin({
  manifestPath = join(repositoryRoot, 'contracts/openapi-sources.json'),
  generatedPath = join(repositoryRoot, 'src/api/generated/core.ts'),
} = {}) {
  const manifest = parseManifest(await readFile(resolve(manifestPath), 'utf8'))
  const generated = await readFile(resolve(generatedPath), 'utf8')
  const match = generated.match(provenance)
  if (!match) {
    throw new Error(
      'core.ts has no Core OpenAPI provenance header; regenerate it with npm run contracts:generate',
    )
  }
  if (match[1] !== manifest.core.sha256) {
    throw new Error(
      `core.ts was generated from Core contract sha256:${match[1]}, but contracts/openapi-sources.json pins sha256:${manifest.core.sha256}. Pin the contract you generated from (commit-addressed URI and digest) or regenerate from the pinned one.`,
    )
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  checkContractPin()
    .then(() => console.log('Core contract pin matches core.ts'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
