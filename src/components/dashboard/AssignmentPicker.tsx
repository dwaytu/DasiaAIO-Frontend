import { FC } from 'react'

interface AssignmentOption {
  value: string
  label: string
}

interface AssignmentPickerProps {
  id: string
  label: string
  value: string
  options: AssignmentOption[]
  placeholder: string
  emptyMessage?: string
  required?: boolean
  onChange: (value: string) => void
  tone?: 'teal' | 'indigo' | 'amber'
}

const toneRing: Record<NonNullable<AssignmentPickerProps['tone']>, string> = {
  teal: 'focus:ring-info-border focus:border-info-border',
  indigo: 'focus:ring-info-border focus:border-info-border',
  amber: 'focus:ring-warning-border focus:border-warning-border',
}

const AssignmentPicker: FC<AssignmentPickerProps> = ({
  id,
  label,
  value,
  options,
  placeholder,
  emptyMessage,
  required = false,
  onChange,
  tone = 'indigo',
}) => {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-text-primary">
        {label}
      </label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`soc-form-control w-full ${toneRing[tone]}`}
      >
        <option value="">{placeholder}</option>
        {options.length > 0 ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          <option disabled>No options available</option>
        )}
      </select>
      {options.length === 0 ? (
        <p className="mt-1 text-xs text-warning-text">{emptyMessage || `No ${label.toLowerCase()} available for this assignment.`}</p>
      ) : null}
    </div>
  )
}

export default AssignmentPicker
