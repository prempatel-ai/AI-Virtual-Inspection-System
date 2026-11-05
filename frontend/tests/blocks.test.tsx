import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  SyntheticBanner,
  KpiCard,
  RiskBadge,
  SignalChip,
  EmptyState,
  ErrorState,
  DataTable,
  ScoreBreakdown,
  ReconcileTable,
  EvidenceList,
  ChecklistPanel,
  FeedbackForm,
} from '../components/ui'
import BlocksGalleryPage from '../app/_blocks/page'

describe('UI Blocks', () => {
  it('renders SyntheticBanner with required notice', () => {
    render(<SyntheticBanner />)
    expect(screen.getByText(/Synthetic demo data/i)).toBeDefined()
  })

  it('renders KpiCard with label, value, and context', () => {
    render(
      <KpiCard
        label="Shops monitored"
        value={17000}
        unit="shops"
        context="Active this week"
      />
    )
    expect(screen.getByText('Shops monitored')).toBeDefined()
    expect(screen.getByText('17000')).toBeDefined()
    expect(screen.getByText('shops')).toBeDefined()
  })

  it('renders RiskBadge with correct text and color', () => {
    render(<RiskBadge level="high" />)
    expect(screen.getByText('High')).toBeDefined()
  })

  it('renders SignalChip with points', () => {
    render(<SignalChip label="Stock gap" points={25.0} />)
    expect(screen.getByText('Stock gap')).toBeDefined()
    expect(screen.getByText('(25.0 pts)')).toBeDefined()
  })

  it('renders EmptyState with action button', () => {
    render(
      <EmptyState
        title="No shops match these filters."
        onAction={() => {}}
      />
    )
    expect(screen.getByText('No shops match these filters.')).toBeDefined()
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeDefined()
  })

  it('renders ErrorState with retry button', () => {
    render(<ErrorState message="Could not load shops." onRetry={() => {}} />)
    expect(screen.getByText('Could not load shops.')).toBeDefined()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined()
  })

  it('renders DataTable with columns and rows', () => {
    interface Item {
      id: string
      name: string
      score: number
    }
    const data: Item[] = [{ id: '1', name: 'Shop 1', score: 78 }]
    const columns = [
      {
        key: 'name',
        header: 'Shop',
        render: (item: Item) => item.name,
      },
      {
        key: 'score',
        header: 'Score',
        align: 'right' as const,
        render: (item: Item) => item.score,
      },
    ]

    render(
      <DataTable
        columns={columns}
        data={data}
        keyField="id"
      />
    )
    expect(screen.getByText('Shop')).toBeDefined()
    expect(screen.getByText('Shop 1')).toBeDefined()
    expect(screen.getByText('78')).toBeDefined()
  })

  it('renders ScoreBreakdown with signals summing to score', () => {
    const breakdown = [
      { key: 'stock_gap_pct', label: 'Stock gap', points: 25.0, value: 10.5, unit: '%' },
      { key: 'board_mismatch_pct', label: 'Notice board mismatch', points: 15.0, value: 8.0, unit: '%' },
    ]
    render(<ScoreBreakdown score={40.0} breakdown={breakdown} />)
    expect(screen.getByText('Score breakdown')).toBeDefined()
    expect(screen.getByText('40.0 / 100')).toBeDefined()
    expect(screen.getByText('Stock gap')).toBeDefined()
    expect(screen.getByText('+25.0 pts')).toBeDefined()
  })

  it('renders ReconcileTable with opening, sales, and gap', () => {
    const reconData = {
      opening_kg: 1000.0,
      received_kg: 500.0,
      sold_kg: 400.0,
      closing_kg: 950.0,
      gap_kg: 150.0,
      gap_pct: 10.5,
      direction: 'shortfall',
    }
    render(<ReconcileTable data={reconData} />)
    expect(screen.getByText('Stock reconciliation')).toBeDefined()
    expect(screen.getByText('Opening balance')).toBeDefined()
    expect(screen.getByText('+150.0 kg (10.5%)')).toBeDefined()
  })

  it('renders EvidenceList with traceable evidence fact_ids', () => {
    const evidence = [
      { fact_id: 'val_stock_gap_pct', statement: 'Recorded stock gap of 10.5%.' },
    ]
    render(
      <EvidenceList
        reason="Shop prioritized due to stock gap."
        evidence={evidence}
        source="groq"
      />
    )
    expect(screen.getByText('Why this shop was flagged')).toBeDefined()
    expect(screen.getByText('AI-written')).toBeDefined()
    expect(screen.getByText('Recorded stock gap of 10.5%.')).toBeDefined()
    expect(screen.getByText('[val_stock_gap_pct]')).toBeDefined()
  })

  it('renders ChecklistPanel and toggles verification items', () => {
    const items = [
      { action: 'Audit godown stock', why: 'Gap detected', fact_id: 'val_stock_gap_pct' },
    ]
    render(<ChecklistPanel items={items} />)
    expect(screen.getByText('What to check')).toBeDefined()
    expect(screen.getByText('Audit godown stock')).toBeDefined()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDefined()
    fireEvent.click(checkbox)
    expect(screen.getByText('1 / 1 verified')).toBeDefined()
  })

  it('renders FeedbackForm and submits outcome', async () => {
    const onSubmit = vi.fn()
    render(<FeedbackForm shopId="FPS-00001" onSubmit={onSubmit} />)
    expect(screen.getByText('Record visit outcome')).toBeDefined()
    const button = screen.getByRole('button', { name: /Save outcome/i })
    await fireEvent.click(button)
    expect(onSubmit).toHaveBeenCalledWith('confirmed', '')
  })

  it('renders BlocksGalleryPage component without crashing', () => {
    render(<BlocksGalleryPage />)
    expect(screen.getByText('UI Component Gallery')).toBeDefined()
    expect(screen.getByText('Score breakdown')).toBeDefined()
    expect(screen.getByText('Stock reconciliation')).toBeDefined()
  })
})
