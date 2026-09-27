// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { resolveConfig } from 'vite'
import { createServer } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

describe('local development routing', () => {
  it('refuses to start over an occupied BFF port', async () => {
    const blocker = createServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', (error: NodeJS.ErrnoException) => {
        // A running local BFF already supplies the occupied-port condition.
        if (error.code === 'EADDRINUSE') resolve()
        else reject(error)
      })
      blocker.listen(8787, '127.0.0.1', resolve)
    })
    try {
      await expect(
        promisify(execFile)(process.execPath, ['scripts/dev-local.mjs']),
      ).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringContaining('8787 is already in use') as unknown,
      })
    } finally {
      blocker.close()
    }
  })
  it('keeps the browser on a fixed loopback port with React refresh', async () => {
    const config = await resolveConfig({}, 'serve', 'development')
    expect(config.server.host).toBe('127.0.0.1')
    expect(config.server.port).toBe(5173)
    expect(config.server.strictPort).toBe(true)
    expect(config.plugins.some((plugin) => plugin.name.includes('react'))).toBe(
      true,
    )
  })

  it('proxies sessions to the local BFF without rewriting the origin or path', async () => {
    const config = await resolveConfig({}, 'serve', 'development')
    expect(config.server.proxy?.['/session']).toEqual({
      target: 'http://127.0.0.1:8787',
      changeOrigin: false,
    })
  })
})
