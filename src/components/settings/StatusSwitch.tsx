import { FC } from 'react'

type StatusSwitchProps = {
  checked: boolean
  disabled?: boolean
  label: string
  onToggle: () => void
}

const StatusSwitch: FC<StatusSwitchProps> = ({ checked, disabled = false, label, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className={`relative inline-flex !min-h-6 h-6 w-11 shrink-0 items-center !rounded-full border p-[3px] transition-[background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring) disabled:cursor-not-allowed disabled:opacity-50 ${
      checked
        ? 'border-(--color-primary) bg-(--color-primary)'
        : 'border-(--color-border-strong) bg-(--color-surface-elevated)'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow transition-transform duration-150 ease-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
      aria-hidden="true"
    />
  </button>
)

export default StatusSwitch
