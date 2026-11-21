export interface PersonNameParts {
  firstName: string
  middleInitial: string
  lastName: string
}

export function normalizeNameParts({ firstName, middleInitial, lastName }: PersonNameParts): PersonNameParts {
  return {
    firstName: firstName.trim().replace(/\s+/g, ' '),
    middleInitial: middleInitial.trim().replace(/\.$/, '').toUpperCase(),
    lastName: lastName.trim().replace(/\s+/g, ' '),
  }
}

export function formatSurnameFirstName(parts: PersonNameParts): string {
  const { firstName, middleInitial, lastName } = normalizeNameParts(parts)
  return `${lastName}, ${firstName}${middleInitial ? ` ${middleInitial}.` : ''}`
}

export function isValidMiddleInitial(value: string): boolean {
  const initial = value.trim()
  return initial === '' || /^\p{L}\.?$/u.test(initial)
}

export function parseSurnameFirstName(fullName?: string): PersonNameParts | null {
  const [surname, given, ...rest] = (fullName ?? '').split(',').map((part) => part.trim())
  if (!surname || !given || rest.length) return null

  const splitInitial = /^(.+?)\s+(\p{L})\.$/u.exec(given)
  return {
    lastName: surname,
    firstName: splitInitial?.[1] ?? given,
    middleInitial: splitInitial?.[2] ?? '',
  }
}
