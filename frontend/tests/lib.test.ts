import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatNumber,
  formatPercent,
  formatKg,
  formatScore,
  formatDate,
  formatWeek,
} from '../lib/format'
import {
  getMeta,
  getSummary,
  getRankedShops,
  getShopDetail,
  triggerRun,
  submitFeedback,
} from '../lib/api'

describe('Format utilities', () => {
  it('formats large numbers in en-IN style', () => {
    expect(formatNumber(17000)).toBe('17,000')
    expect(formatNumber(1000000)).toBe('10,00,000')
  })

  it('formats percentages with one decimal', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
  })

  it('formats kg units', () => {
    expect(formatKg(1500.5)).toBe('1,500.5 kg')
  })

  it('formats score to 1 decimal place', () => {
    expect(formatScore(78.42)).toBe('78.4')
  })

  it('formats dates as Day Month Year', () => {
    expect(formatDate('2026-11-02')).toBe('2 Nov 2026')
  })

  it('formats week label', () => {
    expect(formatWeek('2026-11-02')).toBe('week of 2 Nov 2026')
  })
})

describe('API client wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches meta', async () => {
    const mockMeta = {
      synthetic: true,
      weeks: ['2026-11-02'],
      latest_week: '2026-11-02',
      districts: ['Ahmedabad'],
      talukas: { Ahmedabad: ['Taluka 1'] },
      shops_count: 500,
      has_run: true,
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMeta,
    } as Response)

    const meta = await getMeta()
    expect(meta.synthetic).toBe(true)
    expect(meta.districts).toContain('Ahmedabad')
  })

  it('fetches summary with query param', async () => {
    const mockSummary = {
      week: '2026-11-02',
      shops_monitored: 500,
      flagged_high: 20,
      flagged_medium: 40,
      flagged_low: 440,
      inspection_priority_k: 26,
      confirmed_rate: 0.0,
      evaluation: null,
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSummary,
    } as Response)

    const summary = await getSummary('2026-11-02')
    expect(summary.shops_monitored).toBe(500)
  })

  it('fetches ranked shops with filter params', async () => {
    const mockRanked = {
      week: '2026-11-02',
      total: 10,
      items: [],
    }
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockRanked,
    } as Response)

    const result = await getRankedShops({
      week: '2026-11-02',
      district: 'Ahmedabad',
      band: 'high',
    })
    expect(result.total).toBe(10)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('district=Ahmedabad'),
      expect.any(Object)
    )
  })

  it('submits feedback to shop endpoint', async () => {
    const mockRes = { id: 1, shop_id: 'FPS-00001', outcome: 'confirmed' }
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockRes,
    } as Response)

    const res = await submitFeedback('FPS-00001', {
      week: '2026-11-02',
      outcome: 'confirmed',
      note: 'Verified godown',
    })
    expect(res.id).toBe(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/shops/FPS-00001/feedback'),
      expect.objectContaining({ method: 'POST' })
    )
  })
})
