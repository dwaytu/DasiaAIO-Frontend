import { ChevronDown } from 'lucide-react'
import { FC, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'

export interface SearchableSelectOption {
  id: string
  value: string
  label: string
  description?: string | null
  searchValues?: Array<string | null | undefined>
}

interface SearchableSelectProps {
  id: string
  label: string
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  helperText: string
  emptyMessage: string
  noResultsMessage: (query: string) => string
  required?: boolean
  disabled?: boolean
}

const matchesOption = (option: SearchableSelectOption, query: string) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true

  const compactQuery = normalizedQuery.replace(/[\s-]+/g, '')
  return [option.label, option.description, ...(option.searchValues || [])].some((value) => {
    const normalizedValue = value?.toLocaleLowerCase() || ''
    return normalizedValue.includes(normalizedQuery)
      || normalizedValue.replace(/[\s-]+/g, '').includes(compactQuery)
  })
}

const SearchableSelect: FC<SearchableSelectProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  helperText,
  emptyMessage,
  noResultsMessage,
  required = false,
  disabled = false,
}) => {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<number, HTMLButtonElement>())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )
  const matchingOptions = useMemo(
    () => options.filter((option) => matchesOption(option, query)),
    [options, query],
  )

  useEffect(() => {
    if (activeIndex >= matchingOptions.length) {
      setActiveIndex(matchingOptions.length - 1)
    }
  }, [activeIndex, matchingOptions.length])

  useEffect(() => {
    if (activeIndex >= 0) {
      optionRefs.current.get(activeIndex)?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [activeIndex])

  const openSearch = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setActiveIndex(-1)
  }

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value)
    setOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setQuery('')
      setActiveIndex(-1)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (matchingOptions.length > 0) {
        setActiveIndex((current) => Math.min(current + 1, matchingOptions.length - 1))
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (matchingOptions.length > 0) {
        setActiveIndex((current) => Math.max(current - 1, 0))
      }
      return
    }

    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      const activeOption = matchingOptions[activeIndex]
      if (activeOption) selectOption(activeOption)
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
          setQuery('')
          setActiveIndex(-1)
        }
      }}
    >
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-text-primary">
        {label}{required ? <span aria-hidden="true" className="text-danger-text"> *</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          required={required}
          disabled={disabled}
          aria-required={required || undefined}
          aria-describedby={`${id}-help`}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          value={open ? query : (selectedOption?.label || '')}
          onFocus={openSearch}
          onChange={(event) => {
            setOpen(true)
            setQuery(event.target.value)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="soc-form-control min-h-11 w-full pr-10"
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </div>
      <p id={`${id}-help`} className="mt-1 text-xs text-text-secondary">{helperText}</p>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${label} results`}
          className="mt-2 max-h-72 w-full overflow-y-auto rounded border border-border bg-surface p-1 shadow-xl"
        >
          {options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-secondary">{emptyMessage}</p>
          ) : matchingOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-secondary">{noResultsMessage(query.trim())}</p>
          ) : (
            matchingOptions.map((option, index) => (
              <button
                key={option.id}
                ref={(element) => {
                  if (element) optionRefs.current.set(index, element)
                  else optionRefs.current.delete(index)
                }}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`block w-full rounded px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--color-focus-ring) ${
                  index === activeIndex ? 'bg-surface-hover text-text-primary' : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span className="block font-semibold">{option.label}</span>
                {option.description ? <span className="mt-0.5 block text-xs text-text-secondary">{option.description}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export default SearchableSelect
