import { describe, expect, it } from 'vitest'
import {
  parseRankingRow,
  buildRankingEntries,
  resolveRange,
  type ConsignacionesRankingRow,
} from './useConsignacionesRanking'

describe('parseRankingRow', () => {
  it('aplica defaults seguros cuando faltan campos', () => {
    expect(parseRankingRow({})).toEqual({
      seller_key: '',
      seller_id: null,
      seller_name: 'Sin nombre',
      branch_id: null,
      branch_name: null,
      consignaciones_count: 0,
      publicadas_count: 0,
      vendidas_count: 0,
    })
  })

  it('parsea una fila válida del RPC', () => {
    const raw = {
      seller_key: 'uid:abc',
      seller_id: 'abc',
      seller_name: 'Natalia',
      branch_id: 'b1',
      branch_name: 'Sucursal Centro',
      consignaciones_count: '7',
      publicadas_count: 4,
      vendidas_count: 1,
    }
    expect(parseRankingRow(raw)).toEqual({
      seller_key: 'uid:abc',
      seller_id: 'abc',
      seller_name: 'Natalia',
      branch_id: 'b1',
      branch_name: 'Sucursal Centro',
      consignaciones_count: 7,
      publicadas_count: 4,
      vendidas_count: 1,
    })
  })

  it('coerce numbers desde strings (Postgres bigint)', () => {
    const row = parseRankingRow({ consignaciones_count: '99' })
    expect(row.consignaciones_count).toBe(99)
    expect(typeof row.consignaciones_count).toBe('number')
  })

  it('tolera input null sin tirar', () => {
    expect(() => parseRankingRow(null)).not.toThrow()
  })
})

describe('buildRankingEntries', () => {
  const make = (key: string, count: number, sellerId: string | null = null): ConsignacionesRankingRow => ({
    seller_key: key,
    seller_id: sellerId,
    seller_name: key,
    branch_id: null,
    branch_name: null,
    consignaciones_count: count,
    publicadas_count: 0,
    vendidas_count: 0,
  })

  it('asigna position incremental por orden recibido', () => {
    const rows = buildRankingEntries(
      [make('a', 5), make('b', 3), make('c', 1)],
      [],
    )
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3])
  })

  it('calcula delta_count contra el período previo por seller_key', () => {
    const rows = buildRankingEntries(
      [make('a', 10), make('b', 4)],
      [make('a', 7), make('b', 8)],
    )
    expect(rows.find((r) => r.seller_key === 'a')?.delta_count).toBe(3)
    expect(rows.find((r) => r.seller_key === 'b')?.delta_count).toBe(-4)
  })

  it('considera 0 cuando el vendedor no estuvo en el período previo', () => {
    const rows = buildRankingEntries([make('nuevo', 2)], [])
    expect(rows[0].delta_count).toBe(2)
    expect(rows[0].prev_consignaciones_count).toBe(0)
  })
})

describe('resolveRange (re-export)', () => {
  it('expone fromStr/toStr/label coherentes para mes', () => {
    const r = resolveRange('month', new Date(2026, 4, 9))
    expect(r.fromStr).toBe('2026-05-01')
    expect(r.toStr).toBe('2026-05-31')
    expect(r.label).toBe('Mayo 2026')
  })

  it('previo de mes apunta al mes anterior completo', () => {
    const r = resolveRange('month', new Date(2026, 4, 9))
    expect(r.prevFromStr).toBe('2026-04-01')
    expect(r.prevToStr).toBe('2026-04-30')
  })

  it('semana arranca lunes ISO', () => {
    // 2026-05-09 es sábado → lunes ISO = 2026-05-04
    const r = resolveRange('week', new Date(2026, 4, 9))
    expect(r.fromStr).toBe('2026-05-04')
    expect(r.toStr).toBe('2026-05-10')
  })

  it('trimestre cubre los 3 meses calendario', () => {
    const r = resolveRange('quarter', new Date(2026, 4, 9))
    expect(r.fromStr).toBe('2026-04-01')
    expect(r.toStr).toBe('2026-06-30')
    expect(r.label).toBe('Q2 2026')
  })
})
