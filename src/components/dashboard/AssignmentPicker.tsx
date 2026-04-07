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
        className={`w-full rounded border border-border bg-background px-3 py-2 text-text-primary focus:outline-none focus:ring-2 transition-all duration-200 ${toneRing[tone]}`}
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
    </div>
  )
}

export default AssignmentPicker
