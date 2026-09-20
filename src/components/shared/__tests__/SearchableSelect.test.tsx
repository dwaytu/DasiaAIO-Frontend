import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchableSelect from '../SearchableSelect'

const sites = [
  {
    id: 'site-1',
    value: 'Gaisano Mall Tagum',
    label: 'Gaisano Mall Tagum',
    description: 'Poblacion, Tagum City',
    searchValues: ['Gaisano Mall Tagum', 'Poblacion, Tagum City'],
  },
  {
    id: 'site-2',
    value: 'Davao Field Office',
    label: 'Davao Field Office',
    description: 'Bajada, Davao City',
    searchValues: ['Davao Field Office', 'Bajada, Davao City'],
  },
]

const renderSiteSelect = (value = '', onChange = jest.fn()) => render(
  <SearchableSelect
    id="schedule-client-site"
    label="Select Client Site"
    options={sites}
    value={value}
    onChange={onChange}
    placeholder="Search by site name or address..."
    helperText="Search by site name or address."
    emptyMessage="No client sites are available."
    noResultsMessage={(query) => `No client sites match "${query}". Try searching by site name or address.`}
    required
  />,
)

describe('SearchableSelect client site options', () => {
  it('opens with every site and filters by site name or address', async () => {
    const user = userEvent.setup()
    renderSiteSelect()

    const input = screen.getByRole('combobox', { name: 'Select Client Site' })
    await user.click(input)
    expect(screen.getByRole('option', { name: /Gaisano Mall Tagum.*Poblacion, Tagum City/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Davao Field Office.*Bajada, Davao City/i })).toBeInTheDocument()

    await user.type(input, 'tAgUm')
    expect(screen.getByRole('option', { name: /Gaisano Mall Tagum/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Davao Field Office/i })).not.toBeInTheDocument()
  })

  it('selects the existing schedule value and keeps the selected site visible', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()
    const { rerender } = renderSiteSelect('', onChange)

    const input = screen.getByRole('combobox', { name: 'Select Client Site' })
    await user.click(input)
    await user.click(screen.getByRole('option', { name: /Gaisano Mall Tagum/i }))
    expect(onChange).toHaveBeenCalledWith('Gaisano Mall Tagum')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    rerender(
      <SearchableSelect
        id="schedule-client-site"
        label="Select Client Site"
        options={sites}
        value="Gaisano Mall Tagum"
        onChange={onChange}
        placeholder="Search by site name or address..."
        helperText="Search by site name or address."
        emptyMessage="No client sites are available."
        noResultsMessage={(query) => `No client sites match "${query}". Try searching by site name or address.`}
        required
      />,
    )
    expect(input).toHaveValue('Gaisano Mall Tagum')
  })

  it('supports keyboard selection and distinct no-results and empty states', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()
    const { rerender } = renderSiteSelect('', onChange)

    const input = screen.getByRole('combobox', { name: 'Select Client Site' })
    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('Gaisano Mall Tagum')

    await user.click(input)
    await user.type(input, 'Unknown site')
    expect(screen.getByText('No client sites match "Unknown site". Try searching by site name or address.')).toBeInTheDocument()

    rerender(
      <SearchableSelect
        id="schedule-client-site"
        label="Select Client Site"
        options={[]}
        value=""
        onChange={jest.fn()}
        placeholder="Search by site name or address..."
        helperText="Search by site name or address."
        emptyMessage="No client sites are available."
        noResultsMessage={(query) => `No client sites match "${query}". Try searching by site name or address.`}
      />,
    )
    await user.click(input)
    expect(screen.getByText('No client sites are available.')).toBeInTheDocument()
  })
})
