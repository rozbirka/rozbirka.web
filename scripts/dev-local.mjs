import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))

// Never silently move to another port: cookies and BFF origin checks depend on it.
try {
  for (const port of [8787, 5173]) {
    await new Promise((resolve, reject) => {
      const probe = createServer()
      probe.once('error', () =>
        reject(
          new Error(
            `Port ${port} is already in use. Stop the existing local server first.`,
          ),
        ),
      )
      probe.listen(port, '127.0.0.1', () => probe.close(resolve))
    })
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const env = { ...process.env, VITE_API_URL: 'http://localhost:8088' }
const commands = [
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '8787',
    '--var',
    'CORE_ORIGIN:http://localhost:8088',
  ],
  ['node_modules/vite/bin/vite.js', '--mode', 'development'],
]
const children = []
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill('SIGTERM')
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
for (const args of commands) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' })
  children.push(child)
  child.once('error', (error) => {
    console.error(error.message)
    stop(1)
  })
  child.once('exit', (code) => stop(code ?? 1))
}
console.log(
  'Local UI: http://localhost:5173 (hot reload); BFF: localhost:8787; API: localhost:8088',
)
