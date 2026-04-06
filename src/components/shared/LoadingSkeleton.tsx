import { type FC } from 'react';

type Variant = 'card' | 'table' | 'kpi' | 'hero';

interface LoadingSkeletonProps {
  variant: Variant;
  count?: number;
}

const pulse = 'animate-pulse motion-reduce:animate-none bg-surface-elevated';

function CardSkeleton() {
  return <div className={`${pulse} h-40 w-full rounded-xl`} />;
}

const rowWidths = ['w-[80%]', 'w-[60%]', 'w-[90%]', 'w-[70%]', 'w-[85%]'];

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className={`${pulse} h-8 w-full rounded`} />
      {rowWidths.map((w, i) => (
        <div key={i} className={`${pulse} h-6 ${w} rounded`} />
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={`${pulse} h-20 rounded-lg`} />
      ))}
    </div>
  );
}

function HeroSkeleton() {
  return <div className={`${pulse} h-48 w-full rounded-xl`} />;
}

const variants: Record<Variant, FC> = {
  card: CardSkeleton,
  table: TableSkeleton,
  kpi: KpiSkeleton,
  hero: HeroSkeleton,
};

const LoadingSkeleton: FC<LoadingSkeletonProps> = ({ variant, count = 1 }) => {
  const VariantComponent = variants[variant];

  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <VariantComponent key={i} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
