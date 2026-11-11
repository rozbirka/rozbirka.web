import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  appendFile,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const workflowPath = '.github/workflows/deploy-rozbirka-web.yml'
const requiredJobs = [
  ...['static', 'unit 1/2', 'unit 2/2', 'contracts'].map(
    (gate) => `Quality Rozbirka Web (${gate})`,
  ),
  ...['chromium', 'firefox', 'webkit', 'android', 'ios'].map(
    (project) => `Browser E2E Rozbirka Web (${project})`,
  ),
  'Seal verified Web release',
]
const hash = (value) => createHash('sha256').update(value).digest('hex')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

function validateContext(context) {
  assert(/^[\w.-]+\/[\w.-]+$/.test(context.repository), 'Invalid repository')
  assert(/^[a-f0-9]{40}$/.test(context.sha), 'Invalid source SHA')
  assert(['qa', 'prod'].includes(context.environment), 'Invalid environment')
  assert(
    context.branch &&
      (context.environment !== 'prod' || context.branch === 'main'),
    'Production requires main',
  )
  assert(
    Number.isSafeInteger(context.runId) &&
      context.runId > 0 &&
      Number.isSafeInteger(context.attempt) &&
      context.attempt > 0,
    'Invalid release run/attempt',
  )
}

export function validateProvenance(
  run,
  artifact,
  jobs,
  context,
  currentRun = false,
) {
  validateContext(context)
  assert(
    run.id === context.runId && run.run_attempt >= context.attempt,
    'Source run mismatch',
  )
  assert(
    run.repository.full_name === context.repository &&
      run.head_repository?.full_name === context.repository &&
      run.repository.id === run.head_repository.id,
    'Foreign source repository',
  )
  assert(
    run.path === workflowPath &&
      ['push', 'workflow_dispatch'].includes(run.event),
    'Untrusted source workflow/event',
  )
  assert(
    run.head_sha === context.sha && run.head_branch === context.branch,
    'Source SHA/branch mismatch',
  )
  assert(
    run.status === 'completed' || (currentRun && run.status === 'in_progress'),
    'Source run is unfinished',
  )
  assert(
    artifact.name === `web-release-${context.runId}-${context.attempt}` &&
      !artifact.expired &&
      /^sha256:[a-f0-9]{64}$/.test(artifact.digest),
    'Expired or unsealed artifact',
  )
  const binding = artifact.workflow_run
  assert(
    binding?.id === run.id &&
      binding.repository_id === run.repository.id &&
      binding.head_repository_id === run.repository.id &&
      binding.head_sha === run.head_sha &&
      binding.head_branch === run.head_branch,
    'Artifact run binding mismatch',
  )
  for (const name of requiredJobs) {
    const eligible = jobs.filter(
      (job) =>
        job.name === `Build & Deploy Rozbirka Web / ${name}` &&
        Number.isSafeInteger(job.run_attempt) &&
        job.run_attempt > 0 &&
        job.run_attempt <= context.attempt,
    )
    const latestAttempt = Math.max(...eligible.map((job) => job.run_attempt))
    const latest = eligible.filter((job) => job.run_attempt === latestAttempt)
    const producer = name === 'Seal verified Web release'
    assert(
      latest.length === 1 &&
        latest[0].conclusion === 'success' &&
        latest[0].head_sha === context.sha &&
        (!producer || latestAttempt === context.attempt),
      `Required producer/gate did not succeed: ${name}`,
    )
  }
  return context
}

async function fileHashes(directory, relative = '') {
  const result = {}
  for (const name of (await readdir(join(directory, relative))).sort()) {
    const path = relative ? `${relative}/${name}` : name
    if (path === 'release.json') continue
    const info = await lstat(join(directory, path))
    assert(!info.isSymbolicLink(), `Symlink in release: ${path}`)
    if (info.isDirectory())
      Object.assign(result, await fileHashes(directory, path))
    else {
      assert(info.isFile(), `Non-file in release: ${path}`)
      result[path] = hash(await readFile(join(directory, path)))
    }
  }
  return result
}

export async function sealPackage(root, context) {
  validateContext(context)
  const { default: ts } = await import('typescript')
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    await readFile(join(root, 'wrangler.jsonc'), 'utf8'),
  )
  assert(!parsed.error, 'Cannot parse Wrangler config')
  const source = parsed.config
  assert(
    !source.build &&
      !source.env?.[context.environment === 'prod' ? 'production' : 'qa']
        ?.build,
    'Release config cannot run a custom build',
  )
  const config = {
    ...source,
    ...source.env?.[context.environment === 'prod' ? 'production' : 'qa'],
    main: 'worker/index.js',
    assets: { ...source.assets, directory: './dist' },
  }
  delete config.env
  delete config.$schema
  const output = join(root, '.web-release')
  await rm(output, { recursive: true, force: true })
  await mkdir(output)
  await cp(join(root, 'dist'), join(output, 'dist'), { recursive: true })
  await cp(join(root, '.release-worker'), join(output, 'worker'), {
    recursive: true,
  })
  await lstat(join(output, 'worker', 'index.js'))
  await writeFile(
    join(output, 'wrangler.json'),
    `${JSON.stringify(config, null, 2)}\n`,
  )
  const files = await fileHashes(output)
  await writeFile(
    join(output, 'release.json'),
    `${JSON.stringify({ version: 1, ...context, fullValidation: true, files }, null, 2)}\n`,
  )
}

export async function verifyPackage(directory, context) {
  validateContext(context)
  const manifest = JSON.parse(
    await readFile(join(directory, 'release.json'), 'utf8'),
  )
  assert(
    manifest.version === 1 && manifest.fullValidation === true,
    'Release is not fully validated',
  )
  for (const [key, value] of Object.entries(context))
    assert(manifest[key] === value, `Release ${key} mismatch`)
  const files = await fileHashes(directory)
  assert(
    JSON.stringify(files) === JSON.stringify(manifest.files),
    'Release contents/checksums mismatch',
  )
  for (const path of ['worker/index.js', 'wrangler.json'])
    assert(files[path], `Missing release file: ${path}`)
  assert(
    Object.keys(files).some((path) => path.startsWith('dist/')),
    'Missing static assets',
  )
  const config = JSON.parse(
    await readFile(join(directory, 'wrangler.json'), 'utf8'),
  )
  assert(
    config.main === 'worker/index.js' &&
      config.assets?.directory === './dist' &&
      !config.build &&
      !config.env,
    'Release config can only deploy sealed files',
  )
  const origin =
    context.environment === 'prod'
      ? 'https://api.rozbirka.pro'
      : 'https://qaapi.rozbirka.pro'
  assert(config.vars?.CORE_ORIGIN === origin, 'Worker environment mismatch')
  return context
}

async function api(path, raw = false) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: raw ? 'manual' : 'follow',
    },
  )
  if (raw && response.status === 302) {
    const download = await fetch(response.headers.get('location'))
    assert(download.ok, `Artifact download failed: ${download.status}`)
    return Buffer.from(await download.arrayBuffer())
  }
  assert(response.ok, `GitHub ${path}: ${response.status}`)
  return raw ? Buffer.from(await response.arrayBuffer()) : response.json()
}

async function pages(path, key) {
  const result = []
  for (let page = 1; ; page++) {
    const response = await api(
      `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    )
    result.push(...response[key])
    if (response[key].length < 100) return result
  }
}

export async function resolveRelease() {
  const runId = Number(process.env.RELEASE_RUN_ID || process.env.GITHUB_RUN_ID)
  assert(
    Number.isSafeInteger(runId) && runId > 0,
    'release_run_id must be a positive run ID',
  )
  const run = await api(`actions/runs/${runId}`)
  const workflow = await api(`actions/workflows/${run.workflow_id}`)
  assert(workflow.path === workflowPath, 'Source workflow identity mismatch')
  const artifacts = (
    await pages(`actions/runs/${runId}/artifacts`, 'artifacts')
  ).filter((item) =>
    new RegExp(`^web-release-${runId}-[1-9][0-9]*$`).test(item.name),
  )
  assert(
    artifacts.length > 0,
    'No sealed Web release in source run; skipped E2E releases cannot deploy',
  )
  artifacts.sort(
    (a, b) =>
      Number(b.name.split('-').at(-1)) - Number(a.name.split('-').at(-1)),
  )
  const artifact = artifacts[0]
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    sha: run.head_sha,
    branch: process.env.RELEASE_BRANCH,
    environment: process.env.RELEASE_ENVIRONMENT,
    runId,
    attempt: Number(artifact.name.split('-').at(-1)),
  }
  const jobs = await pages(`actions/runs/${runId}/jobs?filter=all`, 'jobs')
  validateProvenance(
    run,
    artifact,
    jobs,
    context,
    !process.env.RELEASE_RUN_ID && runId === Number(process.env.GITHUB_RUN_ID),
  )
  if (!process.env.RELEASE_RUN_ID)
    assert(
      context.sha === process.env.GITHUB_SHA,
      'Current source SHA mismatch',
    )
  const directory = join(process.env.RUNNER_TEMP, 'resolved-web-release')
  await fetchPackage(artifact.id, artifact.digest, directory)
  await verifyPackage(directory, context)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `sha=${context.sha}\nrun_id=${runId}\nattempt=${context.attempt}\nartifact_id=${artifact.id}\ndigest=${artifact.digest}\n`,
  )
}

async function fetchPackage(
  artifactId = Number(process.env.RELEASE_ARTIFACT_ID),
  digest = process.env.RELEASE_DIGEST,
  directory = '.web-release',
) {
  assert(
    Number.isSafeInteger(artifactId) && artifactId > 0,
    'Invalid artifact ID',
  )
  const bytes = await api(`actions/artifacts/${artifactId}/zip`, true)
  assert(`sha256:${hash(bytes)}` === digest, 'Artifact archive digest mismatch')
  const archive = join(process.env.RUNNER_TEMP, 'web-release.zip')
  await writeFile(archive, bytes)
  const paths = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
    .trim()
    .split('\n')
  assert(
    paths.every(
      (path) =>
        path &&
        !path.startsWith('/') &&
        !path.includes('\\') &&
        !path.split('/').includes('..'),
    ),
    'Unsafe artifact archive paths',
  )
  // GitHub's artifact service creates ordinary ZIP files from the sealed producer.
  execFileSync('unzip', ['-q', archive, '-d', directory])
}

function environmentContext() {
  return {
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.RELEASE_SHA || process.env.GITHUB_SHA,
    branch: process.env.RELEASE_BRANCH,
    environment: process.env.RELEASE_ENVIRONMENT,
    runId: Number(process.env.RELEASE_RUN_ID || process.env.GITHUB_RUN_ID),
    attempt: Number(
      process.env.RELEASE_ATTEMPT || process.env.GITHUB_RUN_ATTEMPT,
    ),
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const command = process.argv[2]
  if (command === 'seal') await sealPackage(process.cwd(), environmentContext())
  else if (command === 'resolve') await resolveRelease()
  else if (command === 'fetch') await fetchPackage()
  else if (command === 'verify')
    await verifyPackage(resolve('.web-release'), environmentContext())
  else throw new Error('Usage: web-release.mjs <seal|resolve|fetch|verify>')
}
