import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditScheduleModal from '../EditScheduleModal'

jest.mock('../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))
jest.mock('../../utils/api', () => ({ getAuthHeaders: () => ({}) }))

const shift = {
  id: 'shift-1', guard_id: '', guard_username: '', client_site: 'North Gate',
  start_time: '2026-10-27T08:00:00Z', end_time: '2026-10-27T16:00:00Z', status: 'scheduled',
}

function Host() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Edit schedule</button>{open ? <EditScheduleModal shift={shift} onClose={() => setOpen(false)} onSave={async () => {}} onDelete={async () => {}} /> : null}</>
}

it('returns focus to the invoking schedule button after cancellation', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => ({
    ok: true,
    json: async () => String(input).includes('/api/users') ? { users: [] } : { sites: [] },
  }) as Response)
  const user = userEvent.setup()
  render(<Host />)
  const trigger = screen.getByRole('button', { name: 'Edit schedule' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(trigger).toHaveFocus()
  jest.restoreAllMocks()
})
