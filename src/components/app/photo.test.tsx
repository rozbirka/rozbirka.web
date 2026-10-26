import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Gallery, PhotoGrid, Thumbnail } from './photo'

const photo = {
  id: 'legacy-photo',
  url: 'https://qamedia.rozbirka.com/tenant/parts/photo.heic',
  thumbnailUrl:
    'https://qamedia.rozbirka.com/cdn-cgi/image/width=200,quality=80,format=auto/tenant/parts/photo.heic',
}
const fullSource =
  'https://qamedia.rozbirka.com/cdn-cgi/image/width=1920,height=1920,fit=scale-down,quality=85,format=auto/tenant/parts/photo.heic'

it('keeps the small thumbnail but displays a browser-compatible full-size legacy photo', () => {
  const { rerender } = render(<Thumbnail alt="Деталь" photo={photo} />)
  expect(screen.getByRole('img', { name: 'Деталь' })).toHaveAttribute(
    'src',
    photo.thumbnailUrl,
  )
  rerender(<Thumbnail alt="Деталь" photo={photo} size="full" />)
  expect(screen.getByRole('img', { name: 'Деталь' })).toHaveAttribute(
    'src',
    fullSource,
  )
})

it('opens the same full-size HEIC conversion in the lightbox and closes with Escape', async () => {
  const user = userEvent.setup()
  render(<Gallery label="Деталь" photos={[photo]} />)
  const opener = screen.getByRole('button')
  await user.click(opener)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('img')).toHaveAttribute('src', fullSource)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('recovers from a failed image when changing to another photo', () => {
  const { rerender } = render(
    <Thumbnail alt="Деталь" photo={photo} size="full" />,
  )
  fireEvent.error(screen.getByRole('img', { name: 'Деталь' }))
  expect(screen.queryByRole('img', { name: 'Деталь' })).not.toBeInTheDocument()
  rerender(
    <Thumbnail
      alt="Інша деталь"
      photo={{ url: 'https://qamedia.rozbirka.com/other.webp' }}
      size="full"
    />,
  )
  expect(screen.getByRole('img', { name: 'Інша деталь' })).toHaveAttribute(
    'src',
    'https://qamedia.rozbirka.com/other.webp',
  )
})

// Record tiles must retain the same HEIC handling and keyboard viewer as Gallery.
it('opens a photo tile at its selected index and returns focus after Escape', async () => {
  const user = userEvent.setup()
  render(
    <PhotoGrid
      label="Фото деталі"
      variant="tiles"
      coverLabel="Обкладинка"
      photos={[
        { id: 'cover', url: 'https://qamedia.rozbirka.com/cover.webp' },
        { ...photo, alt: 'Друге фото' },
      ]}
    />,
  )
  expect(screen.getAllByText('Обкладинка')).toHaveLength(1)
  const tile = screen.getByRole('button', { name: 'Друге фото' })
  expect(within(tile).getByRole('img')).toHaveAttribute(
    'src',
    photo.thumbnailUrl,
  )
  await user.click(tile)
  expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
    'src',
    fullSource,
  )
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile).toHaveFocus()
})

it('keeps a failed record tile readable and lets its existing button open the full photo', async () => {
  const user = userEvent.setup()
  render(
    <PhotoGrid
      label="Фото деталі"
      variant="tiles"
      photos={[{ ...photo, alt: 'Обкладинка деталі' }]}
    />,
  )
  const tile = screen.getByRole('button', { name: 'Обкладинка деталі' })
  fireEvent.error(within(tile).getByRole('img'))
  expect(
    within(tile).getByText('Фото недоступне', { exact: true }),
  ).toBeVisible()
  expect(within(tile).queryByRole('img')).not.toBeInTheDocument()
  await user.click(tile)
  expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
    'src',
    fullSource,
  )
})

it('keeps every photo in a horizontal strip and opens the selected one', async () => {
  const user = userEvent.setup()
  const photos = Array.from({ length: 5 }, (_, index) => ({
    id: String(index),
    url: `https://example.test/${index}.webp`,
    alt: `Фото ${index + 1}`,
  }))
  render(
    <PhotoGrid
      label="Фото деталі"
      variant="tiles"
      layout="strip"
      photos={photos}
    />,
  )
  expect(screen.getAllByRole('button')).toHaveLength(5)
  expect(screen.getByRole('list', { name: 'Фото деталі' })).toHaveClass(
    'rz-photo-strip',
  )
  await user.click(screen.getByRole('button', { name: 'Фото 5' }))
  expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
    'src',
    photos[4]!.url,
  )
})
