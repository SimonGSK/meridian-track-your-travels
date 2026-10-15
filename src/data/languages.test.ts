import { describe, expect, it } from 'vitest'
import { findCountryByName } from '../countries'
import { languagesOf } from './languages'

const of = (name: string) => languagesOf(findCountryByName(name)!)

describe('languages', () => {
  it('names the official languages first, then those official in a part, each by how many speak it', () => {
    expect(of('Japan')).toEqual(['Japanese'])
    expect(of('Spain').slice(0, 4)).toEqual(['Spanish', 'Catalan', 'Galician', 'Basque'])
    expect(of('Belgium')).toEqual(['Dutch', 'French', 'German'])
    expect(of('India').slice(0, 2)).toEqual(['Hindi', 'English'])
    expect(of('Kosovo')).toEqual(['Albanian', 'Serbian'])
  })

  it('has every place people live in, but none for a place nobody does', () => {
    expect(of('Greenland')).toEqual(['Kalaallisut'])
    expect(of('Antarctica')).toEqual([])
  })

  it('leaves out languages without an English name, rather than showing their codes', () => {
    for (const name of of('Philippines')) expect(name).not.toMatch(/^[a-z]{2,3}$/)
  })
})
