import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuardSearchSelect from '../GuardSearchSelect'

const guards = [
  { id: 'uuid-guard-1', guardCode: 'G-0001', fullName: 'CABANAG, REYSAN', username: 'reysan.cabanag' },
  { id: 'uuid-guard-2', guardCode: 'G-0047', fullName: 'Juan Dela Cruz', username: 'juan.guard' },
  { id: 'uuid-guard-3', guardCode: 'G-0150', fullName: 'Maria Santos', username: 'maria.santos' },
]

describe('GuardSearchSelect', () => {
  it('opens with all eligible guards, filters by Guard ID, and selects the existing UUID', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <GuardSearchSelect id="schedule-guard" label="Select Guard" guards={guards} value="" onChange={onChange} required />,
    )

    const input = screen.getByRole('combobox', { name: 'Select Guard' })
    await user.click(input)
    expect(screen.getByRole('option', { name: 'G-0001 - CABANAG, REYSAN' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'G-0047 - Juan Dela Cruz' })).toBeInTheDocument()
    await user.type(input, 'g-004')

    expect(screen.getByRole('option', { name: 'G-0047 - Juan Dela Cruz' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /CABANAG/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: 'G-0047 - Juan Dela Cruz' }))
    expect(onChange).toHaveBeenCalledWith('uuid-guard-2')

    rerender(
      <GuardSearchSelect id="schedule-guard" label="Select Guard" guards={guards} value="uuid-guard-2" onChange={onChange} required />,
    )
    expect(input).toHaveValue('G-0047 - Juan Dela Cruz')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('searches names case-insensitively and supports keyboard selection', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()

    render(<GuardSearchSelect id="schedule-guard" label="Select Guard" guards={guards} value="" onChange={onChange} />)

    const input = screen.getByRole('combobox', { name: 'Select Guard' })
    await user.click(input)
    await user.type(input, 'rEySaN')
    expect(screen.getByRole('option', { name: 'G-0001 - CABANAG, REYSAN' })).toBeInTheDocument()

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('uuid-guard-1')
  })

  it('matches partial and whitespace-tolerant Guard ID searches', async () => {
    const user = userEvent.setup()

    render(<GuardSearchSelect id="schedule-guard" label="Select Guard" guards={guards} value="" onChange={jest.fn()} />)

    const input = screen.getByRole('combobox', { name: 'Select Guard' })
    await user.click(input)
    await user.type(input, 'g 0047')

    expect(screen.getByRole('option', { name: 'G-0047 - Juan Dela Cruz' })).toBeInTheDocument()
  })

  it('communicates no search matches and closes results with Escape', async () => {
    const user = userEvent.setup()

    render(<GuardSearchSelect id="schedule-guard" label="Select Guard" guards={guards} value="" onChange={jest.fn()} />)

    const input = screen.getByRole('combobox', { name: 'Select Guard' })
    await user.click(input)
    await user.type(input, 'G-9999')
    expect(screen.getByText('No guards match "G-9999". Try searching by Guard ID or name.')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('distinguishes an empty eligible guard list from a search with no matches', async () => {
    const user = userEvent.setup()

    render(<GuardSearchSelect id="schedule-guard" label="Select Guard" guards={[]} value="" onChange={jest.fn()} />)

    await user.click(screen.getByRole('combobox', { name: 'Select Guard' }))
    expect(screen.getByText('No eligible guards are available for this schedule.')).toBeInTheDocument()
  })
})
