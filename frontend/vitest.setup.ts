import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({ id: 'FPS-00012' }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'week' ? '2026-11-02' : null),
  }),
}))
