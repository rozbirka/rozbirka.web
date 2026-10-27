/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { NpAccessRecoverySheet } from './NpAccessRecoverySheet'

vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: { recover: vi.fn() },
}))

const connection = {
  id: 'conn-old',
  version: 'cv1',
  isCurrent: false,
  hasVerifiedAccess: false,
  waybillCount: 14,
  createdAt: '2026-08-01T10:00:00Z',
}

const renderSheet = (canRecover = true) => {
  const onRecovered = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <NpAccessRecoverySheet
      canRecover={canRecover}
      connection={connection}
      integrationId="np-1"
      onOpenChange={onOpenChange}
      onRecovered={onRecovered}
      open
      waybills={[
        { number: '20 4500 1187 2209', caption: '#342 · Відправлено' },
      ]}
    />,
  )
  return { onRecovered, onOpenChange }
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('shows success only after Core confirmed the key', async () => {
  vi.mocked(novaPoshtaSetupApi.recover).mockResolvedValue({
    connectionId: 'conn-old',
    version: 'cv2',
    credentialVersionId: 'cred-2',
  })
  const user = userEvent.setup()
  const { onRecovered, onOpenChange } = renderSheet()

  expect(screen.getByText('Накладні без доступу · 14')).toBeVisible()
  expect(screen.getByText('І ще 13 накладних.')).toBeVisible()
  const check = screen.getByRole('button', { name: 'Перевірити доступ' })
  expect(check).toBeDisabled()

  await user.type(
    screen.getByLabelText('Ключ попереднього кабінету'),
    'old-key',
  )
  await user.click(check)

  expect(novaPoshtaSetupApi.recover).toHaveBeenCalledWith(
    'np-1',
    'conn-old',
    'cv1',
    'old-key',
  )
  expect(await screen.findByText('Доступ підтверджено')).toBeVisible()
  expect(screen.getByText('14 з 14')).toBeVisible()
  expect(onRecovered).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Застосувати' }))
  expect(onRecovered).toHaveBeenCalledWith(
    expect.objectContaining({ credentialVersionId: 'cred-2' }),
    14,
  )
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('never passes an unconfirmed scope for success', async () => {
  vi.mocked(novaPoshtaSetupApi.recover).mockRejectedValue({
    kind: 'conflict',
    code: 'np_historical_scope_unverified',
    message: 'unverified',
  })
  const user = userEvent.setup()
  const { onRecovered } = renderSheet()

  await user.type(
    screen.getByLabelText('Ключ попереднього кабінету'),
    'other-key',
  )
  await user.click(screen.getByRole('button', { name: 'Перевірити доступ' }))

  expect(
    await screen.findByText(
      'Ключ дійсний, але жодна з 14 накладних не належить цьому кабінету. Доступ не відновлено.',
    ),
  ).toBeVisible()
  expect(screen.getByText('0 з 14')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Перевірити доступ' }),
  ).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Застосувати' })).toBeNull()
  expect(onRecovered).not.toHaveBeenCalled()
})

it('says the carrier did not answer when Nova Poshta fails', async () => {
  vi.mocked(novaPoshtaSetupApi.recover).mockRejectedValue({
    kind: 'server',
    code: 'nova_poshta_unavailable',
    message: 'down',
  })
  const user = userEvent.setup()
  renderSheet()

  await user.type(screen.getByLabelText('Ключ попереднього кабінету'), 'k')
  await user.click(screen.getByRole('button', { name: 'Перевірити доступ' }))

  expect(
    await screen.findByText(
      'Нова пошта не відповіла. Ключ не перевірено — спробуйте ще раз за кілька хвилин.',
    ),
  ).toBeVisible()
})

it('explains the missing right instead of the form', () => {
  renderSheet(false)

  expect(
    screen.getByText(/Відновити доступ може власник або користувач/),
  ).toBeVisible()
  expect(screen.queryByLabelText('Ключ попереднього кабінету')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Перевірити доступ' })).toBeNull()
})
