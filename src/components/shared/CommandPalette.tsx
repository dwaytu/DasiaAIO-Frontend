import { Command, Search } from 'lucide-react'
import { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { SidebarItem } from '../Sidebar'

type PaletteCommand = {
  id: string
  label: string
  group: 'Navigation' | 'Quick Actions'
  view: string
}

interface CommandPaletteProps {
  navItems: SidebarItem[]
  onNavigate: (view: string) => void
  onClose: () => void
}

const navigationCommands: PaletteCommand[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Navigation', view: 'dashboard' },
  { id: 'approvals', label: 'Approvals', group: 'Navigation', view: 'approvals' },
  { id: 'schedule', label: 'Schedule', group: 'Navigation', view: 'schedule' },
  { id: 'fleet', label: 'Fleet', group: 'Navigation', view: 'armored-cars' },
  { id: 'firearms', label: 'Firearms', group: 'Navigation', view: 'firearms' },
  { id: 'incidents', label: 'Incidents', group: 'Navigation', view: 'operations-map' },
  { id: 'maps', label: 'Maps', group: 'Navigation', view: 'operations-map' },
]

const quickActions: PaletteCommand[] = [
  { id: 'dispatch-guard', label: 'Dispatch Guard', group: 'Quick Actions', view: 'schedule' },
  { id: 'firearm-return', label: 'Log Firearm Return', group: 'Quick Actions', view: 'allocation' },
  { id: 'patrol-check-in', label: 'Trigger Patrol Check-in', group: 'Quick Actions', view: 'mission' },
]

const CommandPalette: FC<CommandPaletteProps> = ({ navItems, onNavigate, onClose }) => {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const commands = useMemo(() => {
    const availableViews = new Set(navItems.map((item) => item.view))
    const nav = navigationCommands.filter((command) => availableViews.has(command.view) || command.view === 'dashboard')
    const all = [...nav, ...quickActions]
    const normalized = query.trim().toLowerCase()
    return normalized ? all.filter((command) => command.label.toLowerCase().includes(normalized)) : all
  }, [navItems, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(commands.length - 1, 0)))
  }, [commands.length])

  const runCommand = (command: PaletteCommand | undefined) => {
    if (!command) return
    onNavigate(command.view)
    onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, commands.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(commands[activeIndex])
    }
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) flex items-start justify-center bg-(--color-overlay) p-4 pt-[12dvh] backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border-elevated bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <label className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            placeholder="Type a command, guard name, or page... (Esc to close)"
            aria-label="Type a command, guard name, or page"
          />
          <kbd className="hidden rounded border border-border-subtle bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary sm:block">Esc</kbd>
        </label>
        <div className="max-h-[min(56dvh,28rem)] overflow-y-auto p-2">
          {(['Navigation', 'Quick Actions'] as const).map((group) => {
            const groupCommands = commands.filter((command) => command.group === group)
            if (groupCommands.length === 0) return null
            return (
              <div key={group} className="mb-3 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{group}</p>
                {groupCommands.map((command) => {
                  const commandIndex = commands.indexOf(command)
                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(commandIndex)}
                      onClick={() => runCommand(command)}
                      className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring) ${
                        activeIndex === commandIndex ? 'bg-info-bg text-info-text' : 'text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {command.label}
                      <Command className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            )
          })}
          {commands.length === 0 ? <p className="px-3 py-6 text-center text-sm text-text-secondary">No matching commands.</p> : null}
        </div>
      </section>
    </div>
  )
}

export default CommandPalette
