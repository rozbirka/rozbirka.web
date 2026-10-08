import { describe, expect, it } from 'vitest'
import {
  countryName,
  customerAddressDraft,
  customerAddressLines,
  customerCountryOptions,
} from './customer-address'

describe('customer address', () => {
  it('names countries in the interface language', () => {
    expect(countryName('PL', 'uk')).toBe('Польща')
    expect(countryName('PL', 'en-GB')).toBe('Poland')
    expect(countryName('DE', 'pl')).toBe('Niemcy')
  })

  it('lists the business countries first, then the rest alphabetically', () => {
    const options = customerCountryOptions('en-GB')
    expect(options.slice(0, 3).map((option) => option.code)).toEqual([
      'UA',
      'GB',
      'PL',
    ])
    const rest = options.slice(3).map((option) => option.name)
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'en-GB')))
    expect(options.some((option) => option.code === 'DE')).toBe(true)
  })

  it('keeps a stored country that is not in the list', () => {
    expect(
      customerCountryOptions('en-GB', 'JP').some(
        (option) => option.code === 'JP',
      ),
    ).toBe(true)
  })

  it('turns an address into reading lines and drafts', () => {
    const address = {
      countryCode: 'GB',
      city: 'London',
      street: 'Baker Street',
      building: '221B',
      postcode: 'NW1 6XE',
    }
    expect(customerAddressLines(address, 'en-GB')).toEqual([
      'Baker Street, 221B',
      'NW1 6XE London',
      'United Kingdom',
    ])
    expect(customerAddressLines({ city: 'Lviv' }, 'uk')).toEqual(['Lviv'])
    expect(customerAddressLines({}, 'uk')).toEqual([])
    expect(customerAddressDraft({ city: 'Lviv', countryCode: null })).toEqual({
      countryCode: '',
      city: 'Lviv',
      street: '',
      building: '',
      postcode: '',
    })
  })
})
