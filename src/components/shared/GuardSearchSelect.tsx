import { FC, useMemo } from 'react'
import SearchableSelect from './SearchableSelect'

export interface GuardSearchOption {
  id: string
  fullName?: string
  username?: string
  guardCode?: string | null
}

interface GuardSearchSelectProps {
  id: string
  label: string
  guards: GuardSearchOption[]
  value: string
  onChange: (guardId: string) => void
  required?: boolean
  disabled?: boolean
}

const GuardSearchSelect: FC<GuardSearchSelectProps> = ({
  id,
  label,
  guards,
  value,
  onChange,
  required = false,
  disabled = false,
}) => {
  const options = useMemo(() => guards.map((guard) => {
    const name = guard.fullName?.trim() || guard.username?.trim() || 'Unnamed guard'
    const guardLabel = guard.guardCode ? `${guard.guardCode} - ${name}` : name
    return {
      id: guard.id,
      value: guard.id,
      label: guardLabel,
      searchValues: [guard.guardCode, guard.fullName, guard.username],
    }
  }), [guards])

  return (
    <SearchableSelect
      id={id}
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Search by Guard ID or name..."
      helperText="Search by Guard ID or name."
      emptyMessage="No eligible guards are available for this schedule."
      noResultsMessage={(query) => `No guards match "${query}". Try searching by Guard ID or name.`}
      required={required}
      disabled={disabled}
    />
  )
}

export default GuardSearchSelect
