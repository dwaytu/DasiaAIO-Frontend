import DOMPurify from 'dompurify'

const STRIP_ALL_HTML = { ALLOWED_TAGS: [] as string[], ALLOWED_ATTR: [] as string[] }

export function sanitizeHtml(input: string): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, STRIP_ALL_HTML)
}

export function sanitizeErrorMessage(message: unknown, maxLength = 500): string {
  if (typeof message !== 'string') return 'An unexpected error occurred.'
  return DOMPurify.sanitize(message, STRIP_ALL_HTML).trim().slice(0, maxLength)
}
