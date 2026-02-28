/**
 * BentoGrid — Reusable Bento Grid Layout System
 *
 * Provides a responsive 4-column grid (1 → 2 → 4 cols) with bento-card
 * utility class applied to each card. The first card in a layout is
 * conventionally the "main widget" (2-col × 2-row span).
 *
 * Usage:
 *   <BentoGrid>
 *     <BentoCard isMain>…</BentoCard>       // 2×2 hero card
 *     <BentoCard colSpan={2}>…</BentoCard>  // half-width card
 *     <BentoCard>…</BentoCard>              // standard 1×1 card
 *   </BentoGrid>
 */

import { FC, ReactNode } from 'react'

// ─── Grid container ──────────────────────────────────────────────────────────

interface BentoGridProps {
  children: ReactNode
  className?: string
}

const BentoGrid: FC<BentoGridProps> = ({ children, className = '' }) => (
  <div
    className={[
      'grid',
      'grid-cols-1',
      'md:grid-cols-2',
      'lg:grid-cols-4',
      'gap-6',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
)

// ─── Card ──────────────────────────────────────────────────────────────────

export interface BentoCardProps {
  children: ReactNode
  className?: string
  /**
   * How many columns the card spans in the 4-col grid.
   * Responsive: shrinks gracefully on smaller screens.
   */
  colSpan?: 1 | 2 | 3 | 4
  /**
   * How many rows the card spans.
   */
  rowSpan?: 1 | 2 | 3
  /**
   * Shorthand for the main "hero" card: md:col-span-2 + row-span-2.
   * Overrides colSpan/rowSpan when true.
   */
  isMain?: boolean
}

// Maps numeric spans → Tailwind classes (applied from md breakpoint up)
const COL_MAP: Record<number, string> = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-2 lg:col-span-4', // full-width on lg
}

const ROW_MAP: Record<number, string> = {
  1: '',
  2: 'row-span-2',
  3: 'row-span-3',
}

export const BentoCard: FC<BentoCardProps> = ({
  children,
  className = '',
  colSpan = 1,
  rowSpan = 1,
  isMain = false,
}) => {
  const spanClasses = isMain
    ? 'md:col-span-2 row-span-2'
    : [COL_MAP[colSpan] ?? '', ROW_MAP[rowSpan] ?? ''].filter(Boolean).join(' ')

  return (
    <div
      className={['bento-card', spanClasses, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

export default BentoGrid
