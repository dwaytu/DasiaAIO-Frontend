const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return compactNumberFormatter.format(value)
}

export function formatRatioLabel(value: number, total: number, noun: string): string {
  if (!Number.isFinite(total) || total <= 0) {
    return `${formatCompactNumber(value)} ${noun}`
  }

  return `${formatCompactNumber(value)} / ${formatCompactNumber(total)} ${noun}`
}
