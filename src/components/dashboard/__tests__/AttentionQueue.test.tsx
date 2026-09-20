import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertTriangle } from 'lucide-react'
import AttentionQueue, { AttentionItem } from '../AttentionQueue'

describe('AttentionQueue', () => {
  it('explains the priority and routes the user to the next action', async () => {
    const user = userEvent.setup()
    const onAction = jest.fn()
    const item: AttentionItem = {
      id: 'incident-1',
      title: 'Active incident',
      detail: 'Review the incident response status.',
      priority: 'urgent',
      icon: AlertTriangle,
      actionLabel: 'Review incident',
      onAction,
    }

    render(<AttentionQueue items={[item]} />)

    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review incident: Active incident' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('shows a clear all-clear state when no action is required', () => {
    render(<AttentionQueue items={[]} />)

    expect(screen.getByText('No immediate action required')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not show an all-clear when source data is degraded', () => {
    render(<AttentionQueue items={[]} isDegraded />)

    expect(screen.getByText('Operational status cannot be verified')).toBeInTheDocument()
    expect(screen.queryByText('No immediate action required')).not.toBeInTheDocument()
  })

  it('stacks action controls below item content at narrow widths', () => {
    const item: AttentionItem = {
      id: 'incident-1',
      title: 'Active incident',
      detail: 'Review the incident response status.',
      priority: 'urgent',
      icon: AlertTriangle,
      actionLabel: 'Review incident',
      onAction: jest.fn(),
    }

    render(<AttentionQueue items={[item]} />)

    expect(screen.getByText('Active incident').closest('li')).toHaveClass('flex-col', 'sm:flex-row')
    expect(screen.getByRole('button', { name: 'Review incident: Active incident' })).toHaveClass('w-full', 'sm:w-auto')
  })
})
