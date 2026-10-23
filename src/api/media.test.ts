import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { mediaApi } from './media'

const originalAdapter = apiClient.defaults.adapter!

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function response<T>(
  config: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<{ data: T }> {
  return {
    data: { data },
    status: 201,
    statusText: 'Created',
    headers: new AxiosHeaders(),
    config,
  }
}

describe('mediaApi', () => {
  it('uploads a selected file as authenticated multipart data for its documented entity type', async () => {
    let request!: InternalAxiosRequestConfig
    apiClient.defaults.adapter = (config) => {
      request = config
      return Promise.resolve(
        response(config, {
          storageKey: 'pending/cars/image-1',
          url: 'https://cdn.example/image-1.jpg',
        }),
      )
    }
    const file = new File(['photo'], 'car.jpg', { type: 'image/jpeg' })

    await expect(mediaApi.upload(file, 'cars')).resolves.toEqual({
      storageKey: 'pending/cars/image-1',
      url: 'https://cdn.example/image-1.jpg',
    })

    expect(request.url).toBe('/media/upload')
    expect(request.method).toBe('post')
    expect(request.timeout).toBe(60000)
    expect(request.params).toEqual({ entityType: 'cars' })
    expect(request.data).toBeInstanceOf(FormData)
    expect((request.data as FormData).get('file')).toBe(file)
  })

  it('sends a smaller JPEG for a large photo while keeping its filename and orientation-aware bitmap', async () => {
    let request!: InternalAxiosRequestConfig
    apiClient.defaults.adapter = (config) => {
      request = config
      return Promise.resolve(
        response(config, {
          storageKey: 'pending/cars/large',
          url: 'https://cdn.example/large.jpg',
        }),
      )
    }
    const close = vi.fn()
    const bitmap = { width: 4000, height: 3000, close }
    const createBitmap = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createBitmap)
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback) =>
        callback(new Blob([new Uint8Array(100_000)], { type: 'image/jpeg' })),
    )
    const file = new File([new Uint8Array(3_000_000)], 'large.jpg', {
      type: 'image/jpeg',
    })

    await mediaApi.upload(file, 'cars')

    const sent = (request.data as FormData).get('file') as File
    expect(sent).not.toBe(file)
    expect(sent.name).toBe('large.jpg')
    expect(sent.size).toBe(100_000)
    expect(createBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    })
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2048, 1536)
    expect(close).toHaveBeenCalledOnce()
  })

  it('limits simultaneous uploads across media sections to three', async () => {
    const finish: (() => void)[] = []
    apiClient.defaults.adapter = (config) =>
      new Promise((resolve) => {
        finish.push(() =>
          resolve(
            response(config, {
              storageKey: `pending/cars/${finish.length}`,
              url: 'https://cdn.example/photo.jpg',
            }),
          ),
        )
      })
    const uploads = Array.from({ length: 4 }, (_, index) =>
      mediaApi.upload(
        new File(['photo'], `photo-${index}.jpg`, { type: 'image/jpeg' }),
        'cars',
      ),
    )
    await vi.waitFor(() => expect(finish).toHaveLength(3))
    finish[0]!()
    await vi.waitFor(() => expect(finish).toHaveLength(4))
    finish[1]!()
    finish[2]!()
    finish[3]!()
    await expect(Promise.all(uploads)).resolves.toHaveLength(4)
  })

  it('does not start an upload cancelled while waiting for a slot', async () => {
    const finish: (() => void)[] = []
    apiClient.defaults.adapter = (config) =>
      new Promise((resolve) => {
        finish.push(() =>
          resolve(
            response(config, {
              storageKey: 'pending/cars/photo',
              url: 'https://cdn.example/photo.jpg',
            }),
          ),
        )
      })
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    const active = Array.from({ length: 3 }, () =>
      mediaApi.upload(file, 'cars'),
    )
    const controller = new AbortController()
    const waiting = mediaApi.upload(file, 'cars', {
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(finish).toHaveLength(3))
    controller.abort()
    await expect(waiting).rejects.toBeDefined()
    finish.forEach((resolve) => resolve())
    await Promise.all(active)
    expect(finish).toHaveLength(3)
  })

  it('deletes only a documented pending storage key', async () => {
    let request!: InternalAxiosRequestConfig
    apiClient.defaults.adapter = (config) => {
      request = config
      return Promise.resolve({
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: new AxiosHeaders(),
        config,
      })
    }

    await mediaApi.remove('pending/intakes/image-1')

    expect(request.url).toBe('/media')
    expect(request.method).toBe('delete')
    expect(JSON.parse(request.data as string)).toEqual({
      storageKey: 'pending/intakes/image-1',
    })
  })

  it('rejects an unsupported runtime entity type before making a request', async () => {
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter

    await expect(
      mediaApi.upload(
        new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
        'orders' as never,
      ),
    ).rejects.toThrow('Unsupported media entity type')
    expect(adapter).not.toHaveBeenCalled()
  })

  it('rejects an empty pending storage key before making a delete request', async () => {
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter

    await expect(mediaApi.remove('   ')).rejects.toThrow(
      'Pending media storage key is required',
    )
    expect(adapter).not.toHaveBeenCalled()
  })
})
