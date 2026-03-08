import { FC, ReactNode } from 'react'

interface OpsTableWidgetProps {
  title: string
  subtitle?: string
  headers: string[]
  rows: Array<Array<ReactNode>>
  emptyMessage: string
}

const OpsTableWidget: FC<OpsTableWidgetProps> = ({ title, subtitle, headers, rows, emptyMessage }) => {
  return (
    <section className="table-glass rounded-xl">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{subtitle}</p>}
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full min-w-[520px]">
          <thead className="thead-glass">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-sm text-text-secondary" colSpan={headers.length}>{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="border-t border-border-subtle hover:bg-surface-hover/60">
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-sm font-medium text-text-primary">{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default OpsTableWidget
