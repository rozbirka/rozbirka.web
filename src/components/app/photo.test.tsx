import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Gallery, Thumbnail } from './photo'

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
