import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import DashboardPage from '../app/page'

describe('Dashboard Page Screen', () => {
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
    expect(screen.getByText(/Synthetic demo data/i)).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Shop FPS-00012')).toBeDefined()
      expect(screen.getByText('84.5')).toBeDefined()
      expect(screen.getByText('Stock gap')).toBeDefined()
      expect(screen.getByText('80.0%')).toBeDefined()
    })
  })
})
