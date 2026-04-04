import { Dispatch, FC, FormEvent, SetStateAction, useState } from 'react'
import GuardShiftSwapPanel from './GuardShiftSwapPanel'
import DashboardCard from './ui/DashboardCard'
import SectionHeader from './ui/SectionHeader'

type ScheduleFormState = {
  clientSite: string
  date: string
  startTime: string
  endTime: string
}

type TicketFormState = {
  subject: string
  message: string
}

type TicketItem = {
  id: string
  subject: string
  message: string
  status: string
  created_at: string
}

type ShiftSwapOption = {
  id: string
  label: string
}

interface GuardSupportTabProps {
  userId: string
  userRole: string
  onInstructionsOpen: () => void
  scheduleForm: ScheduleFormState
  setScheduleForm: Dispatch<SetStateAction<ScheduleFormState>>
  scheduleSubmitting: boolean
  scheduleStatus: string
  onScheduleSubmit: (event: FormEvent) => void
  ticketForm: TicketFormState
  setTicketForm: Dispatch<SetStateAction<TicketFormState>>
  ticketSubmitting: boolean
  ticketStatus: string
  onTicketSubmit: (event: FormEvent) => void
  ticketItems: TicketItem[]
  shiftSwapOptions: ShiftSwapOption[]
}

const GuardSupportTab: FC<GuardSupportTabProps> = ({
  userId,
  userRole,
  onInstructionsOpen,
  scheduleForm,
  setScheduleForm,
  scheduleSubmitting,
  scheduleStatus,
  onScheduleSubmit,
  ticketForm,
  setTicketForm,
  ticketSubmitting,
  ticketStatus,
  onTicketSubmit,
  ticketItems,
  shiftSwapOptions,
}) => {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)

  return (
    <section className="guard-section-frame" aria-label="Guard support workspace">
      <SectionHeader title="Support & Comms" subtitle="Emergency contacts, schedule requests, and support tickets" />

      {/* Emergency contacts are now always visible in the bottom bar */}
      <DashboardCard title="Emergency Contacts">
        <p className="text-sm text-text-secondary">
          Emergency contacts are always available at the bottom of your screen.
        </p>
      </DashboardCard>

      {/* Field Instructions — one-tap access */}
      <div className="flex items-center gap-3 rounded-xl border border-info-border bg-info-bg px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-info-text">Field Instructions</p>
          <p className="text-xs text-info-text opacity-70">Protocol list, escalation chain, radio discipline</p>
        </div>
        <button
          type="button"
          onClick={onInstructionsOpen}
          className="min-h-10 shrink-0 rounded-md border border-info-border bg-info-bg px-3 py-2 text-sm font-semibold text-info-text"
        >
          Open
        </button>
      </div>

      {/* Schedule Change Request — collapsible */}
      <DashboardCard
        title="Schedule Change Request"
        actions={
          <button
            type="button"
            onClick={() => setScheduleOpen((p) => !p)}
            aria-expanded={scheduleOpen}
            className="min-h-10 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-primary"
          >
            {scheduleOpen ? 'Close' : 'New Request'}
          </button>
        }
      >
        {scheduleOpen ? (
          <form className="mt-2 grid grid-cols-1 gap-3" onSubmit={onScheduleSubmit}>
            <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-client-site">Client Site</label>
            <input
              id="schedule-client-site"
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
              value={scheduleForm.clientSite}
              onChange={(event) => setScheduleForm((previous) => ({ ...previous, clientSite: event.target.value }))}
              placeholder="Enter post or client site"
            />

            <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-date">Date</label>
            <input
              id="schedule-date"
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
              value={scheduleForm.date}
              onChange={(event) => setScheduleForm((previous) => ({ ...previous, date: event.target.value }))}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-start-time">Start Time</label>
                <input
                  id="schedule-start-time"
                  type="time"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                  value={scheduleForm.startTime}
                  onChange={(event) => setScheduleForm((previous) => ({ ...previous, startTime: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-secondary" htmlFor="schedule-end-time">End Time</label>
                <input
                  id="schedule-end-time"
                  type="time"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
                  value={scheduleForm.endTime}
                  onChange={(event) => setScheduleForm((previous) => ({ ...previous, endTime: event.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={scheduleSubmitting}
              className="min-h-10 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
            >
              {scheduleSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
            {scheduleStatus ? <p className="text-sm text-text-secondary">{scheduleStatus}</p> : null}
          </form>
        ) : (
          <p className="text-sm text-text-tertiary">Tap "New Request" to submit a schedule correction or reassignment.</p>
        )}
      </DashboardCard>

      {/* Support Tickets — collapsible form, always show existing tickets */}
      <DashboardCard
        title="Support Tickets"
        actions={
          <button
            type="button"
            onClick={() => setTicketOpen((p) => !p)}
            aria-expanded={ticketOpen}
            className="min-h-10 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-primary"
          >
            {ticketOpen ? 'Close' : 'New Ticket'}
          </button>
        }
      >
        {ticketOpen ? (
          <form className="mb-4 space-y-3" onSubmit={onTicketSubmit}>
            <label className="text-sm font-semibold text-text-secondary" htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              type="text"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
              value={ticketForm.subject}
              onChange={(event) => setTicketForm((previous) => ({ ...previous, subject: event.target.value }))}
              placeholder="Enter ticket subject"
            />

            <label className="text-sm font-semibold text-text-secondary" htmlFor="support-message">Message</label>
            <textarea
              id="support-message"
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
              value={ticketForm.message}
              onChange={(event) => setTicketForm((previous) => ({ ...previous, message: event.target.value }))}
              placeholder="Describe your issue"
            />

            <button
              type="submit"
              disabled={ticketSubmitting}
              className="min-h-10 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
            >
              {ticketSubmitting ? 'Submitting...' : 'Create Ticket'}
            </button>
            {ticketStatus ? <p className="text-sm text-text-secondary">{ticketStatus}</p> : null}
          </form>
        ) : null}

        {ticketItems.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-tertiary">No support tickets yet. Tap "New Ticket" above to report an issue or request assistance.</p>
        ) : (
          <ul className="space-y-2">
            {ticketItems.map((ticket) => (
              <li key={ticket.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{ticket.subject}</p>
                  <span className="rounded-full border border-border-subtle bg-background px-2 py-1 text-xs font-semibold text-text-secondary">
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{ticket.message}</p>
                <p className="mt-1 text-xs text-text-tertiary">{new Date(ticket.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <GuardShiftSwapPanel
        currentUserId={userId}
        currentUserRole={userRole}
        shiftOptions={shiftSwapOptions}
      />
    </section>
  )
}

export default GuardSupportTab
