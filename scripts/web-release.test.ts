// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'

const directories: string[] = []
const sha = 'a'.repeat(40)
const context = {
  repository: 'org/web',
  sha,
  branch: 'main',
  environment: 'prod',
  runId: 41,
  attempt: 1,
}
const validRun = {
  id: 41,
  run_attempt: 1,
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'failure',
  path: '.github/workflows/deploy-rozbirka-web.yml',
  repository: { full_name: 'org/web', id: 9 },
  head_repository: { full_name: 'org/web', id: 9 },
}
const validArtifact = {
  id: 81,
  name: 'web-release-41-1',
  expired: false,
  digest: `sha256:${'b'.repeat(64)}`,
  workflow_run: {
    id: 41,
    repository_id: 9,
    head_repository_id: 9,
    head_sha: sha,
    head_branch: 'main',
  },
}
const names = [
  'Quality Rozbirka Web (static)',
  'Quality Rozbirka Web (unit 1/2)',
  'Quality Rozbirka Web (unit 2/2)',
  'Quality Rozbirka Web (contracts)',
  ...['chromium', 'firefox', 'webkit', 'android', 'ios'].map(
    (project) => `Browser E2E Rozbirka Web (${project})`,
  ),
  'Seal verified Web release',
]
const jobs = names.map((name) => ({
  name: `Build & Deploy Rozbirka Web / ${name}`,
  conclusion: 'success',
  run_attempt: 1,
  head_sha: sha,
}))

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('verified Web release provenance', () => {
  it('accepts a successful producer when the later deployment failed', async () => {
    const { validateProvenance } = await import('./web-release.mjs')
    expect(validateProvenance(validRun, validArtifact, jobs, context)).toEqual(
      context,
    )
  })
  it('accepts retained successful gates when a failed sealing job succeeds on retry', async () => {
    const { validateProvenance } = await import('./web-release.mjs')
    const retryContext = { ...context, attempt: 2 }
    const retryJobs = [
      ...jobs.map((job) =>
        job.name.endsWith('/ Seal verified Web release')
          ? { ...job, conclusion: 'failure' }
          : job,
      ),
      { ...jobs[9], run_attempt: 2 },
    ]
    expect(
      validateProvenance(
        { ...validRun, run_attempt: 2 },
        { ...validArtifact, name: 'web-release-41-2' },
        retryJobs,
        retryContext,
      ),
    ).toEqual(retryContext)
    expect(() => {
      validateProvenance(
        { ...validRun, run_attempt: 2 },
        { ...validArtifact, name: 'web-release-41-2' },
        [...retryJobs, { ...jobs[4], run_attempt: 2, conclusion: 'failure' }],
        retryContext,
      )
    }).toThrow()
  })
  it.each([
    ['PR source', { event: 'pull_request' }],
    ['foreign repository', { repository: { full_name: 'evil/web', id: 8 } }],
    ['foreign head', { head_repository: { full_name: 'evil/web', id: 8 } }],
    ['wrong branch', { head_branch: 'develop' }],
    ['wrong SHA', { head_sha: 'c'.repeat(40) }],
    ['wrong workflow', { path: '.github/workflows/other.yml' }],
    ['unfinished run', { status: 'in_progress' }],
  ])('rejects %s', async (_label, patch) => {
    const { validateProvenance } = await import('./web-release.mjs')
    expect(
      () =>
        void validateProvenance(
          { ...validRun, ...patch },
          validArtifact,
          jobs,
          context,
        ),
    ).toThrow()
  })
  it.each(['failure', 'skipped', 'cancelled'])(
    'rejects a %s producer or required browser gate',
    async (conclusion) => {
      const { validateProvenance } = await import('./web-release.mjs')
      for (const name of [names[4], names[9]]) {
        expect(
          () =>
            void validateProvenance(
              validRun,
              validArtifact,
              jobs.map((job) =>
                job.name.endsWith(`/ ${name}`) ? { ...job, conclusion } : job,
              ),
              context,
            ),
        ).toThrow()
      }
    },
  )
  it.each([
    { expired: true },
    { digest: null },
    { workflow_run: { ...validArtifact.workflow_run, id: 42 } },
  ])('rejects unbound or expired artifacts %j', async (patch) => {
    const { validateProvenance } = await import('./web-release.mjs')
    expect(
      () =>
        void validateProvenance(
          validRun,
          { ...validArtifact, ...patch },
          jobs,
          context,
        ),
    ).toThrow()
  })
})

describe('sealed Web package', () => {
  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'web-release-'))
    directories.push(root)
    await mkdir(join(root, 'dist'))
    await mkdir(join(root, '.release-worker'))
    await writeFile(join(root, 'dist', 'app.js'), 'https://api.rozbirka.pro')
    await writeFile(
      join(root, '.release-worker', 'index.js'),
      'export default { fetch() {} }',
    )
    await writeFile(
      join(root, 'wrangler.jsonc'),
      '{"name":"qa", "main":"worker/index.ts", "assets":{"directory":"./dist"}, "env":{"production":{"name":"prod", "vars":{"CORE_ORIGIN":"https://api.rozbirka.pro"}}}}',
    )
    return root
  }
  it.each(['valid', 'archive tamper', 'manifest environment mismatch'])(
    'resolves a failed deployment through API metadata and the actual ZIP: %s',
    async (scenario) => {
      const { sealPackage, resolveRelease } = await import('./web-release.mjs')
      const root = await fixture()
      await sealPackage(root, context)
      const archivePath = join(root, 'release.zip')
      execFileSync('zip', ['-qr', archivePath, '.'], {
        cwd: join(root, '.web-release'),
      })
      const archive = await readFile(archivePath)
      const digest = `sha256:${createHash('sha256').update(archive).digest('hex')}`
      const output = join(root, 'outputs')
      await writeFile(output, '')
      for (const [key, value] of Object.entries({
        RELEASE_RUN_ID: '41',
        GITHUB_RUN_ID: '99',
        GITHUB_REPOSITORY: 'org/web',
        RELEASE_BRANCH: 'main',
        RELEASE_ENVIRONMENT:
          scenario === 'manifest environment mismatch' ? 'qa' : 'prod',
        RUNNER_TEMP: root,
        GITHUB_OUTPUT: output,
        GH_TOKEN: 'fixture-token',
      }))
        vi.stubEnv(key, value)
      vi.stubGlobal('fetch', (url: string) => {
        const route = url.split('org/web/')[1].split('?')[0]
        if (route === 'actions/artifacts/81/zip')
          return Promise.resolve(new Response(archive))
        const data: Record<string, unknown> = {
          'actions/runs/41': { ...validRun, workflow_id: 7 },
          'actions/workflows/7': {
            path: '.github/workflows/deploy-rozbirka-web.yml',
          },
          'actions/runs/41/artifacts': {
            artifacts: [
              {
                ...validArtifact,
                digest:
                  scenario === 'archive tamper'
                    ? `sha256:${'0'.repeat(64)}`
                    : digest,
              },
            ],
          },
          'actions/runs/41/jobs': { jobs },
        }
        if (!data[route]) throw new Error(`Unexpected API route: ${route}`)
        return Promise.resolve(Response.json(data[route]))
      })
      if (scenario === 'valid') {
        await resolveRelease()
        expect(await readFile(output, 'utf8')).toContain(
          `sha=${sha}\nrun_id=41\nattempt=1`,
        )
      } else {
        await expect(resolveRelease()).rejects.toThrow(
          scenario === 'archive tamper'
            ? 'digest mismatch'
            : 'environment mismatch',
        )
        expect(await readFile(output, 'utf8')).toBe('')
      }
    },
  )
  it('seals and verifies exact static assets, compiled Worker and environment config', async () => {
    const { sealPackage, verifyPackage } = await import('./web-release.mjs')
    const root = await fixture()
    await sealPackage(root, context)
    await expect(
      verifyPackage(join(root, '.web-release'), context),
    ).resolves.toEqual(context)
    const config = JSON.parse(
      await readFile(join(root, '.web-release', 'wrangler.json'), 'utf8'),
    ) as { env?: unknown }
    expect(config).toMatchObject({
      name: 'prod',
      main: 'worker/index.js',
      assets: { directory: './dist' },
      vars: { CORE_ORIGIN: 'https://api.rozbirka.pro' },
    })
    expect(config.env).toBeUndefined()
  })
  it('rejects tampering, extra files, environment and source mismatch', async () => {
    const { sealPackage, verifyPackage } = await import('./web-release.mjs')
    const root = await fixture()
    await sealPackage(root, context)
    const release = join(root, '.web-release')
    await expect(
      verifyPackage(release, { ...context, environment: 'qa' }),
    ).rejects.toThrow()
    await expect(
      verifyPackage(release, { ...context, sha: 'c'.repeat(40) }),
    ).rejects.toThrow()
    await writeFile(join(release, 'dist', 'extra.js'), 'oops')
    await expect(verifyPackage(release, context)).rejects.toThrow()
    await rm(join(release, 'dist', 'extra.js'))
    await writeFile(join(release, 'worker', 'index.js'), 'tampered')
    await expect(verifyPackage(release, context)).rejects.toThrow()
  })
})

it('deploy-only dispatch skips every quality/build gate and deploys the verified no-bundle package', async () => {
  const caller = parse(
    await readFile('.github/workflows/deploy-rozbirka-web.yml', 'utf8'),
  ) as { on: { workflow_dispatch: { inputs: Record<string, unknown> } } }
  const workflow = parse(
    await readFile('.github/workflows/deploy-node-static-template.yml', 'utf8'),
  ) as { jobs: Record<string, { if: string; needs: string[] }> }
  expect(caller.on.workflow_dispatch.inputs.release_run_id).toBeDefined()
  expect(caller.on.workflow_dispatch.inputs.enable_deployment).toMatchObject({
    default: false,
  })
  expect(JSON.stringify(workflow.jobs.request)).toContain('RELEASE_RUN_ID')
  for (const job of ['quality', 'e2e', 'release'])
    expect(workflow.jobs[job].needs).toContain('request')
  for (const job of ['quality', 'e2e', 'build']) {
    expect(workflow.jobs[job].if).toContain('!inputs.release_run_id')
  }
  expect(workflow.jobs.build.if).toContain("needs.e2e.result == 'success'")
  expect(workflow.jobs.build.if).not.toContain("needs.e2e.result == 'skipped'")
  expect(workflow.jobs.deploy.needs).toEqual(['release'])
  const deployment = JSON.stringify(workflow.jobs.deploy)
  expect(deployment).toContain('needs.release.outputs.sha')
  expect(deployment).toContain('--no-bundle')
  expect(deployment).toContain('web-release.mjs verify')
  expect(deployment).not.toMatch(/npm run (?:build|test|verify:release)/)
  expect(deployment).not.toContain('inputs.branch')
})

it.each([
  [true, '', 'qa', 'develop', 1],
  [false, '', 'qa', 'develop', 0],
  [true, '41', 'prod', 'main', 0],
  [true, '41', 'prod', 'develop', 1],
  [true, 'not-a-run', 'qa', 'develop', 1],
])(
  'validates manual deployment input before any build: enabled=%s run=%s environment=%s branch=%s',
  async (enabled, runId, environment, branch, status) => {
    const workflow = parse(
      await readFile(
        '.github/workflows/deploy-node-static-template.yml',
        'utf8',
      ),
    ) as { jobs: { request: { steps: { run: string }[] } } }
    const result = spawnSync(
      'bash',
      ['-c', workflow.jobs.request.steps[0].run],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          EVENT_NAME: 'workflow_dispatch',
          ENABLE_DEPLOYMENT: String(enabled),
          RELEASE_RUN_ID: runId,
          TARGET_ENVIRONMENT: environment,
          SOURCE_BRANCH: branch,
        },
      },
    )
    expect(result.status, result.stdout + result.stderr).toBe(status)
  },
)

it('retains release quality, browser and performance gates', async () => {
  const workflow = await readFile(
    '.github/workflows/deploy-node-static-template.yml',
    'utf8',
  )
  for (const gate of [
    'check:static',
    'test:unit',
    'test:contracts',
    'contracts:check',
    'test:integration',
    'test:e2e',
    'test:smoke',
    'verify:release:prod',
    'verify:release:qa',
  ])
    expect(workflow).toContain(`npm run ${gate}`)
  for (const project of ['chromium', 'firefox', 'webkit', 'android', 'ios'])
    expect(workflow).toContain(`project: ${project}`)
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>
  }
  for (const [environment, artifact] of [
    ['qa', 'qa'],
    ['prod', 'prod'],
  ]) {
    expect(manifest.scripts[`verify:release:${environment}`]).toContain(
      `npm run check:artifact:${artifact}`,
    )
    expect(manifest.scripts[`verify:release:${environment}`]).toContain(
      'npm run budget:assets',
    )
    expect(manifest.scripts[`verify:release:${environment}`]).toContain(
      '--outdir .release-worker',
    )
  }
  expect(manifest.scripts['verify:release:prod']).toContain(
    'npm run audit:lhci',
  )
})
