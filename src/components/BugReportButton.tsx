import React, { useState } from 'react';
import { Bug } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getApiErrorMessage, getAuthHeaders } from '../utils/api';
import { sanitizeErrorMessage } from '../utils/sanitize';

interface BugReportButtonProps {
  userId: string;
}

const BugReportButton: React.FC<BugReportButtonProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'bug',
    priority: 'medium'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          guard_id: userId,
          subject: formData.subject,
          message: formData.message,
          category: formData.category,
          priority: formData.priority
        }),
      });

      if (!response.ok) {
        const errorMessage = await getApiErrorMessage(response, 'Failed to submit bug report');
        throw new Error(errorMessage);
      }

      setSuccessMessage('Bug report submitted successfully! Thank you for your feedback.');
      setFormData({ subject: '', message: '', category: 'bug', priority: 'medium' });
      
      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      setErrorMessage(sanitizeErrorMessage(error instanceof Error ? error.message : 'Failed to submit bug report. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Bug Report Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-4 z-[58] rounded-full bg-red-500 p-3.5 text-white shadow-lg transition-all hover:scale-105 hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        title="Report a Bug"
      >
        <Bug size={24} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="soc-modal-backdrop">
          <div className="soc-modal-panel w-full max-w-md rounded bg-surface shadow-xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bug className="text-red-500" size={24} />
                  <h2 className="text-xl font-bold text-text-primary">Report a Bug</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-3xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                >
                  ×
                </button>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="soc-alert-success mb-4">
                  {successMessage}
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="soc-alert-error mb-4">
                  {errorMessage}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Issue Type
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded border border-border px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger"
                    required
                  >
                    <option value="bug">Bug / Error</option>
                    <option value="feature">Feature Request</option>
                    <option value="question">Question</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full rounded border border-border px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded border border-border px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger"
                    placeholder="Brief description of the issue"
                    required
                    maxLength={255}
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Description
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full resize-none rounded border border-border px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-danger"
                    placeholder="Please describe the issue in detail..."
                    rows={5}
                    required
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="soc-btn-secondary flex-1 rounded px-4 py-2 font-semibold"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded bg-red-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>

              {/* Info Text */}
              <p className="mt-4 text-xs text-text-tertiary text-center">
                Your feedback helps us improve the system. Thank you!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BugReportButton;
