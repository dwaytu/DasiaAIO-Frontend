import { Dispatch, FC, FormEvent, SetStateAction } from 'react'
import GuardShiftSwapPanel from './GuardShiftSwapPanel'
import DashboardCard from './ui/DashboardCard'

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
  return (
    <div className="space-y-4">
      <DashboardCard title="Field Instructions">
        <p className="text-sm text-text-secondary">Open your current protocol list, escalation chain, and radio discipline reminders.</p>
        <button
          type="button"
          onClick={onInstructionsOpen}
          className="mt-3 min-h-11 rounded-md border border-info-border bg-info-bg px-4 py-2 text-sm font-semibold text-info-text"
        >
          Open Instructions
        </button>
      </DashboardCard>

      <DashboardCard title="Schedule Change Requests">
        <p className="text-sm text-text-secondary">Submit schedule corrections or upcoming reassignment requests.</p>
        <form className="mt-3 grid grid-cols-1 gap-3" onSubmit={onScheduleSubmit}>
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
            className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
          >
            {scheduleSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
          {scheduleStatus ? <p className="text-sm text-text-secondary">{scheduleStatus}</p> : null}
        </form>
      </DashboardCard>

      <DashboardCard title="Support Tickets">
        <p className="text-sm text-text-secondary">Create a help request and track your existing support tickets.</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
            <p className="text-sm font-semibold text-text-primary">Operations Desk</p>
            <p className="text-xs text-text-secondary">+63 912 345 6789 · ops@sentinel-security.com</p>
          </article>
          <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
            <p className="text-sm font-semibold text-text-primary">Site Supervisor</p>
            <p className="text-xs text-text-secondary">+63 901 234 5678 · supervisor@sentinel-security.com</p>
          </article>
          <article className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
            <p className="text-sm font-semibold text-text-primary">HR and Compliance</p>
            <p className="text-xs text-text-secondary">+63 955 321 4567 · hr@sentinel-security.com</p>
          </article>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onTicketSubmit}>
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
            className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary"
            value={ticketForm.message}
            onChange={(event) => setTicketForm((previous) => ({ ...previous, message: event.target.value }))}
            placeholder="Describe your issue"
          />

          <button
            type="submit"
            disabled={ticketSubmitting}
            className="min-h-11 rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-primary"
          >
            {ticketSubmitting ? 'Submitting...' : 'Create Ticket'}
          </button>
          {ticketStatus ? <p className="text-sm text-text-secondary">{ticketStatus}</p> : null}
        </form>

        <div className="mt-4">
          <h3 className="text-base font-semibold text-text-primary">My Tickets</h3>
          {ticketItems.length === 0 ? (
            <p className="mt-2 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-sm text-text-secondary">No tickets filed yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
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
        </div>
      </DashboardCard>

      <GuardShiftSwapPanel
        currentUserId={userId}
        currentUserRole={userRole}
        shiftOptions={shiftSwapOptions}
      />
    </div>
  )
}

export default GuardSupportTab
