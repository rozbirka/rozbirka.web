import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Amount } from '@/components/app'
import { formatMoney, LocaleProvider } from '@/i18n'

const plain = (text: string | null) => text?.replace(/\s/g, ' ')

describe('money per currency', () => {
  it('writes the ISO code with the currency precision', () => {
    expect(plain(formatMoney(12480, 'USD', 'uk'))).toBe('12 480,00 USD')
    expect(plain(formatMoney(12480, 'USD', 'en-GB'))).toBe('12,480.00 USD')
    expect(plain(formatMoney(1500, 'JPY', 'uk'))).toBe('1 500 JPY')
    expect(plain(formatMoney(4200, 'UAH', 'pl'))).toBe('4200,00 UAH')
    // CAD and USD would share «$»; the code keeps them apart.
    expect(formatMoney(10, 'CAD', 'en-GB')).toContain('CAD')
  })

  it('lets a screen reader hear the currency name with the amount', () => {
    render(
      <LocaleProvider locale="uk">
        <Amount currency="GBP" currencyDisplay="code" value={180} />
      </LocaleProvider>,
    )
    const amount = screen.getByText(/^180,00\sGBP$/)
    expect(amount).toHaveTextContent('180,00 GBP (Фунт стерлінгів)')
  })
})
