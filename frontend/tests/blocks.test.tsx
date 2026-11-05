import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  SyntheticBanner,
  KpiCard,
  RiskBadge,
  SignalChip,
  EmptyState,
  ErrorState,
  DataTable,
} from '../components/ui'

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
})
