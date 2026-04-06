import { FC } from 'react'

interface SkeletonBlockProps {
  className?: string
}

export const SkeletonBlock: FC<SkeletonBlockProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-surface-elevated ${className}`.trim()} aria-hidden="true" />
)

interface DashboardLoadingStateProps {
  title: string
  subtitle: string
  heroCards?: number
  lowerSections?: number
}

export const DashboardLoadingState: FC<DashboardLoadingStateProps> = ({
  title,
  subtitle,
  heroCards = 4,
  lowerSections = 2,
}) => {
  const heroGridClass = heroCards >= 4 ? 'xl:grid-cols-4' : heroCards === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'

  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <section className="soc-surface p-5">
        <div className="flex flex-col gap-2 border-b border-border-subtle pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">{title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-8 w-28 rounded-full" />
            <SkeletonBlock className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 ${heroGridClass}`}>
          {Array.from({ length: heroCards }).map((_, index) => (
            <div key={`hero-skeleton-${index}`} className="soc-dashboard-card">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-3 h-8 w-24" />
              <SkeletonBlock className="mt-4 h-2 w-full" />
              <SkeletonBlock className="mt-2 h-2 w-3/4" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="soc-dashboard-card xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`metric-skeleton-${index}`} className="rounded-xl border border-border-subtle bg-surface p-4">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="mt-3 h-7 w-20" />
                <SkeletonBlock className="mt-4 h-1.5 w-full" />
                <SkeletonBlock className="mt-2 h-2 w-2/3" />
              </div>
            ))}
          </div>
        </section>

        <section className="soc-dashboard-card">
          <div className="mb-3 border-b border-border-subtle pb-2">
            <SkeletonBlock className="h-4 w-32" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`rail-skeleton-${index}`} className="rounded-lg border border-border-subtle bg-surface p-3">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="mt-3 h-2 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>

      {Array.from({ length: lowerSections }).map((_, index) => (
        <section key={`lower-skeleton-${index}`} className="soc-dashboard-card">
          <div className="mb-3 border-b border-border-subtle pb-2">
            <SkeletonBlock className="h-4 w-44" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div key={`lower-skeleton-${index}-${rowIndex}`} className="rounded-lg border border-border-subtle bg-surface p-3">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="mt-3 h-2 w-full" />
                <SkeletonBlock className="mt-2 h-2 w-5/6" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface TableLoadingStateProps {
  title: string
  subtitle?: string
  rows?: number
  columns?: number
}

export const TableLoadingState: FC<TableLoadingStateProps> = ({
  title,
  subtitle,
  rows = 5,
  columns = 5,
}) => {
  return (
    <section className="w-full table-glass rounded-2xl p-6 md:p-8" aria-live="polite" aria-busy="true">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <div className={`grid gap-0 border-b border-border-subtle bg-surface px-4 py-3`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBlock key={`table-head-${index}`} className="h-3 w-16" />
          ))}
        </div>
        <div className="divide-y divide-border-subtle bg-background">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={`table-row-${rowIndex}`}
              className={`grid gap-3 px-4 py-4`}
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <SkeletonBlock
                  key={`table-cell-${rowIndex}-${columnIndex}`}
                  className={`h-3 ${columnIndex === 0 ? 'w-4/5' : columnIndex === columns - 1 ? 'w-3/5' : 'w-2/3'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
