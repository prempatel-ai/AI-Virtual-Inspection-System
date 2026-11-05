import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import DashboardPage from '../app/flags/page'
import ShopDetailPage from '../app/shops/[id]/page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'FPS-00012' }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'week' ? '2026-11-02' : null),
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}))

describe('Screens', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders dashboard with KPIs and table', async () => {
    const mockMeta = {
      synthetic: true,
      weeks: ['2026-11-02'],
      latest_week: '2026-11-02',
      districts: ['Ahmedabad', 'Surat'],
      talukas: { Ahmedabad: ['Taluka 1'] },
      shops_count: 500,
      has_run: true,
    }
    const mockSummary = {
      week: '2026-11-02',
      shops_monitored: 500,
      flagged: 60,
      high: 20,
      medium: 40,
      inspection_priority_k: 26,
      visits_recorded: 5,
      confirmed_rate: 0.8,
      evaluation: {
        on_synthetic_data: true,
        precision_at_k: 0.81,
        recall_at_2k: 0.96,
        outage_false_alarm_rate: 0.0,
        k: 26,
      },
    }
    const mockRanked = {
      week: '2026-11-02',
      total: 1,
      items: [
        {
          rank: 1,
          shop_id: 'FPS-00012',
          name: 'Shop FPS-00012',
          district: 'Ahmedabad',
          taluka: 'Taluka 1',
          risk_score: 84.5,
          band: 'high',
          top_signals: [{ key: 'stock_gap_pct', label: 'Stock gap', points: 25.0 }],
          trend: [10, 20, 84.5],
        },
      ],
    }

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/meta')) {
        return { ok: true, json: async () => mockMeta } as Response
      }
      if (u.includes('/summary')) {
        return { ok: true, json: async () => mockSummary } as Response
      }
      if (u.includes('/shops/ranked')) {
        return { ok: true, json: async () => mockRanked } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    render(<DashboardPage />)

    expect(screen.getByText('Inspection priorities')).toBeDefined()
    expect(screen.getByText('PDS Virtual Inspection System')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Shop FPS-00012')).toBeDefined()
      expect(screen.getByText('84.5')).toBeDefined()
      expect(screen.getByText('Stock gap')).toBeDefined()
      expect(screen.getByText('80.0%')).toBeDefined()
    })
  })

  it('renders shop detail page with reconciliation, explanation and checklist', async () => {
    const mockDetail = {
      shop: {
        shop_id: 'FPS-00012',
        name: 'Shop FPS-00012',
        district: 'Ahmedabad',
        taluka: 'Taluka 1',
        cards_count: 450,
        vulnerability_index: 0.85,
      },
      week: '2026-11-02',
      risk_score: 84.5,
      band: 'high',
      rank: 1,
      breakdown: [
        { key: 'stock_gap_pct', label: 'Stock gap', points: 25.0, value: 10.5, unit: '%' },
      ],
      history: {
        weeks: ['2026-11-02'],
        series: {
          stock_gap_pct: { shop: [10.5], peer_median: [2.1] },
        },
      },
      stock_reconciliation: {
        opening_kg: 1000.0,
        received_kg: 500.0,
        sold_kg: 400.0,
        closing_kg: 950.0,
        gap_kg: 150.0,
        gap_pct: 10.5,
      },
      board_check: {
        board_kg: 400.0,
        sold_kg: 400.0,
        mismatch_pct: 0.0,
      },
      complaints: [],
      explanation: {
        source: 'groq',
        reason: 'Shop flagged due to elevated stock gap.',
        evidence: [
          { fact_id: 'val_stock_gap_pct', statement: 'Recorded 10.5% gap.' },
        ],
        checklist: [
          { action: 'Audit godown physical stock', why: 'Gap detected', fact_id: 'val_stock_gap_pct' },
        ],
      },
      feedback: [],
    }

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/shops/FPS-00012')) {
        return { ok: true, json: async () => mockDetail } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    render(<ShopDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Shop FPS-00012 (FPS-00012)')).toBeDefined()
      expect(screen.getByText('Score breakdown')).toBeDefined()
      expect(screen.getByText('Stock reconciliation')).toBeDefined()
      expect(screen.getByText('Why this shop was flagged')).toBeDefined()
      expect(screen.getByText('What to check')).toBeDefined()
      expect(screen.getByText('Record visit outcome')).toBeDefined()
    })
  })

  it('submits visit outcome feedback and updates visit records', async () => {
    let feedbackSubmitted = false
    const mockDetail = {
      shop: {
        shop_id: 'FPS-00012',
        name: 'Shop FPS-00012',
        district: 'Ahmedabad',
        taluka: 'Taluka 1',
        cards_count: 450,
        vulnerability_index: 0.85,
      },
      week: '2026-11-02',
      risk_score: 84.5,
      band: 'high',
      rank: 1,
      breakdown: [],
      history: { weeks: [], series: {} },
      stock_reconciliation: {
        opening_kg: 0, received_kg: 0, sold_kg: 0, closing_kg: 0, gap_kg: 0, gap_pct: 0,
      },
      board_check: { board_kg: 0, sold_kg: 0, mismatch_pct: 0 },
      complaints: [],
      explanation: { source: 'template', reason: '', evidence: [], checklist: [] },
      feedback: feedbackSubmitted
        ? [{ outcome: 'confirmed', note: 'Godown verified', created_at: '2026-11-05' }]
        : [],
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
      const u = String(url)
      if (u.includes('/shops/FPS-00012/feedback') && opts?.method === 'POST') {
        feedbackSubmitted = true
        return { ok: true, json: async () => ({ id: 1, shop_id: 'FPS-00012', outcome: 'confirmed' }) } as Response
      }
      if (u.includes('/shops/FPS-00012')) {
        return { ok: true, json: async () => mockDetail } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    const { getByRole } = render(<ShopDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Record visit outcome')).toBeDefined()
    })

    const saveButton = getByRole('button', { name: /Save outcome/i })
    saveButton.click()

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/shops/FPS-00012/feedback'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('renders dashboard error state on API failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused to API server'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/Connection refused to API server/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined()
    })
  })

  it('renders dashboard empty state when no shops match filters', async () => {
    const mockMeta = {
      synthetic: true,
      weeks: ['2026-11-02'],
      latest_week: '2026-11-02',
      districts: ['Ahmedabad'],
      talukas: { Ahmedabad: ['Taluka 1'] },
      shops_count: 500,
      has_run: true,
    }
    const mockSummary = {
      week: '2026-11-02',
      shops_monitored: 500,
      flagged: 0,
      high: 0,
      medium: 0,
      inspection_priority_k: 26,
      visits_recorded: 0,
      confirmed_rate: 0.0,
      evaluation: null,
    }
    const mockRanked = {
      week: '2026-11-02',
      total: 0,
      items: [],
    }

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/meta')) return { ok: true, json: async () => mockMeta } as Response
      if (u.includes('/summary')) return { ok: true, json: async () => mockSummary } as Response
      if (u.includes('/shops/ranked')) return { ok: true, json: async () => mockRanked } as Response
      return { ok: false, status: 404 } as Response
    })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('No shops match these filters.')).toBeDefined()
      expect(screen.getByRole('button', { name: /Clear filters/i })).toBeDefined()
    })
  })

  it('renders shop detail error state on 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Shop FPS-00012 not found' }),
    } as Response)

    render(<ShopDetailPage />)

    await waitFor(() => {
      expect(screen.getByText(/Shop FPS-00012 not found/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined()
    })
  })
})
