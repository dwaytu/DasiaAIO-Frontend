import * as XLSX from 'xlsx'

type MdrSection = 'clients' | 'tower' | 'armored' | 'backup' | 'vault' | 'equipment' | 'pullout' | 'returned'

export interface MdrRowData {
  sheetName: string
  rowNumber: number
  section: string
  clientNumber?: number
  clientName?: string
  clientAddress?: string
  guardNumber?: number
  guardName?: string
  contactNumber?: string
  licenseNumber?: string
  licenseExpiry?: string
  firearmKind?: string
  firearmMake?: string
  caliber?: string
  serialNumber?: string
  firearmValidity?: string
  actualAmmo?: string
  ammoCount?: string
  licRegName?: string
  pulloutStatus?: string
  faRemarks?: string
}

export interface MdrParseResult {
  filename: string
  reportMonth: string
  branch: string
  sheets: {
    mainRoster: MdrRowData[]
    supplementary: MdrRowData[]
    pullOut: MdrRowData[]
    returnedFirearms: MdrRowData[]
  }
  warnings: string[]
}

interface SheetMapping {
  mainRosterName?: string
  supplementaryName?: string
  pullOutName?: string
  returnedName?: string
}

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

const MONTH_PATTERN = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`, 'i')
const STOP_MARKER_PATTERN = /RECAPITULATION|PREPARED BY|NOTED BY|CERTIFIED CORRECT/i

const SECTION_PATTERNS: Array<{ pattern: RegExp; section: MdrSection }> = [
  { pattern: /CLIENT SITES?/i, section: 'clients' },
  { pattern: /TOWER SITES?/i, section: 'tower' },
  { pattern: /ARMORED\s+CAR/i, section: 'armored' },
  { pattern: /BACKUP/i, section: 'backup' },
  { pattern: /FIREARMS\s+ON\s+VAULT|VAULT\s+FIREARMS?/i, section: 'vault' },
  { pattern: /EQUIPMENT|ISSUED/i, section: 'equipment' },
]

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read workbook as ArrayBuffer.'))
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read workbook.'))
    }

    reader.readAsArrayBuffer(file)
  })
}

function toSheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  }) as unknown[][]
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }

  return String(value).trim()
}

function squashWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function optionalText(value: unknown): string | undefined {
  const normalized = squashWhitespace(cellText(value))
  return normalized.length > 0 ? normalized : undefined
}

function parseInteger(value: unknown): number | undefined {
  const raw = squashWhitespace(cellText(value)).replace(/,/g, '')
  if (!raw) return undefined

  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalizePhone(value: unknown): string | undefined {
  const raw = optionalText(value)
  if (!raw) return undefined

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `0${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return digits
  return raw
}

function formatDate(year: number, month: number, day: number): string {
  const safeMonth = String(month).padStart(2, '0')
  const safeDay = String(day).padStart(2, '0')
  return `${year}-${safeMonth}-${safeDay}`
}

function parseNumericDate(value: number): string | undefined {
  const dateCode = XLSX.SSF.parse_date_code(value)
  if (!dateCode || !dateCode.y || !dateCode.m || !dateCode.d) return undefined
  return formatDate(dateCode.y, dateCode.m, dateCode.d)
}

function pushWarning(
  warnings: string[],
  warningSet: Set<string>,
  message: string,
): void {
  if (warningSet.has(message)) return
  warningSet.add(message)
  warnings.push(message)
}

function normalizeDate(
  value: unknown,
  label: string,
  sheetName: string,
  rowNumber: number,
  warnings: string[],
  warningSet: Set<string>,
): string | undefined {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'number') {
    const normalized = parseNumericDate(value)
    if (normalized) return normalized

    pushWarning(
      warnings,
      warningSet,
      `Could not parse ${label} at ${sheetName} row ${rowNumber}: ${value}`,
    )
    return String(value)
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }

  const raw = optionalText(value)
  if (!raw) return undefined

  const lower = raw.toLowerCase()
  if (['n/a', 'na', 'none', 'nil', '-'].includes(lower)) return undefined

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const slashNormalized = raw.replace(/\./g, '/').replace(/-/g, '/')
  const slashMatch = slashNormalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10)
    const day = Number.parseInt(slashMatch[2], 10)
    const yearToken = Number.parseInt(slashMatch[3], 10)
    const year = yearToken < 100 ? 2000 + yearToken : yearToken

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatDate(year, month, day)
    }
  }

  const parsedTimestamp = Date.parse(raw)
  if (!Number.isNaN(parsedTimestamp)) {
    const parsed = new Date(parsedTimestamp)
    return formatDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate())
  }

  pushWarning(
    warnings,
    warningSet,
    `Could not parse ${label} at ${sheetName} row ${rowNumber}: ${raw}`,
  )

  return raw
}

function rowToText(rows: unknown[][], rowIndex: number): string {
  const row = rows[rowIndex] ?? []
  const joined = row
    .slice(0, 16)
    .map((value) => squashWhitespace(cellText(value)))
    .filter(Boolean)
    .join(' ')

  return squashWhitespace(joined)
}

function extractMonthFragment(text: string): string | undefined {
  const upper = text.toUpperCase()
  const month = MONTH_NAMES.find((monthName) => upper.includes(monthName))
  if (!month) return undefined

  const yearMatch = upper.match(/\b(19\d{2}|20\d{2})\b/)
  return yearMatch ? `${month} ${yearMatch[1]}` : month
}

function extractReportMonth(rows: unknown[][], fallbackSheetName: string): string {
  const rowText = rowToText(rows, 3)
  return extractMonthFragment(rowText) ?? extractMonthFragment(fallbackSheetName) ?? 'UNKNOWN'
}

function extractBranch(rows: unknown[][]): string {
  const rowText = rowToText(rows, 5)
  if (!rowText) return 'UNKNOWN'

  const branchMatch = rowText.match(/BRANCH\s*[:\-]?\s*(.+)$/i)
  if (branchMatch?.[1]) return squashWhitespace(branchMatch[1])

  return rowText
}

function parseClientDescriptor(value: string): { clientName?: string; clientAddress?: string } {
  const normalized = value.replace(/\r/g, '').trim()
  if (!normalized) return {}

  const lines = normalized
    .split('\n')
    .map((line) => squashWhitespace(line))
    .filter(Boolean)

  if (lines.length === 0) return {}
  if (lines.length === 1) return { clientName: lines[0] }

  return {
    clientName: lines[0],
    clientAddress: lines.slice(1).join(', '),
  }
}

function detectSectionMarker(value: string): MdrSection | undefined {
  const normalized = squashWhitespace(value)
  if (!normalized) return undefined

  for (const marker of SECTION_PATTERNS) {
    if (marker.pattern.test(normalized)) {
      return marker.section
    }
  }

  return undefined
}

function isSectionHeading(value: string): boolean {
  return SECTION_PATTERNS.some(({ pattern }) => pattern.test(value))
}

function parseRosterSheet(
  rows: unknown[][],
  sheetName: string,
  warnings: string[],
  warningSet: Set<string>,
): MdrRowData[] {
  const parsedRows: MdrRowData[] = []
  let currentSection: MdrSection = 'clients'
  let currentClientNumber: number | undefined
  let currentClientName: string | undefined
  let currentClientAddress: string | undefined

  for (let rowIndex = 8; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const rowNumber = rowIndex + 1

    const colAText = optionalText(row[0])
    const colBTextRaw = cellText(row[1])
    const colBText = squashWhitespace(colBTextRaw)
    const rowSummary = squashWhitespace(
      [
        colAText,
        colBText,
        optionalText(row[2]),
        optionalText(row[3]),
        optionalText(row[10]),
      ]
        .filter(Boolean)
        .join(' '),
    )

    if (!rowSummary) continue
    if (STOP_MARKER_PATTERN.test(rowSummary)) break

    const detectedSection = detectSectionMarker(colBText)
    if (detectedSection) {
      currentSection = detectedSection
    }

    const clientNumber = parseInteger(row[0])
    if (clientNumber !== undefined) {
      const descriptor = parseClientDescriptor(colBTextRaw)
      currentClientNumber = clientNumber
      currentClientName = descriptor.clientName ?? currentClientName
      if (descriptor.clientAddress !== undefined) {
        currentClientAddress = descriptor.clientAddress
      }
    }

    const guardNumber = parseInteger(row[2])
    const guardName = optionalText(row[3])
    const contactNumber = normalizePhone(row[4])
    const licenseNumber = optionalText(row[5])
    const licenseExpiry = normalizeDate(
      row[6],
      'license expiry',
      sheetName,
      rowNumber,
      warnings,
      warningSet,
    )
    const firearmKind = optionalText(row[7])
    const firearmMake = optionalText(row[8])
    const caliber = optionalText(row[9])
    const serialNumber = optionalText(row[10])
    const firearmValidity = normalizeDate(
      row[11],
      'firearm validity',
      sheetName,
      rowNumber,
      warnings,
      warningSet,
    )
    const actualAmmo = optionalText(row[12])
    const ammoCount = optionalText(row[13])
    const licRegName = optionalText(row[15])

    const hasMeaningfulData = Boolean(
      guardNumber !== undefined ||
      guardName ||
      serialNumber ||
      firearmKind ||
      firearmMake ||
      actualAmmo ||
      ammoCount ||
      licenseNumber,
    )

    if (!hasMeaningfulData) {
      if (
        clientNumber === undefined &&
        colBText &&
        currentClientName &&
        !isSectionHeading(colBText)
      ) {
        currentClientAddress = currentClientAddress
          ? `${currentClientAddress}, ${colBText}`
          : colBText
      }
      continue
    }

    const normalizedClientDescriptor = clientNumber !== undefined
      ? parseClientDescriptor(colBTextRaw)
      : {}

    const rowData: MdrRowData = {
      sheetName,
      rowNumber,
      section: currentSection,
    }

    if (currentClientNumber !== undefined) rowData.clientNumber = currentClientNumber
    if (normalizedClientDescriptor.clientName) {
      rowData.clientName = normalizedClientDescriptor.clientName
    } else if (currentClientName) {
      rowData.clientName = currentClientName
    }

    if (normalizedClientDescriptor.clientAddress) {
      rowData.clientAddress = normalizedClientDescriptor.clientAddress
    } else if (currentClientAddress) {
      rowData.clientAddress = currentClientAddress
    }

    if (guardNumber !== undefined) rowData.guardNumber = guardNumber
    if (guardName) rowData.guardName = guardName
    if (contactNumber) rowData.contactNumber = contactNumber
    if (licenseNumber) rowData.licenseNumber = licenseNumber
    if (licenseExpiry) rowData.licenseExpiry = licenseExpiry
    if (firearmKind) rowData.firearmKind = firearmKind
    if (firearmMake) rowData.firearmMake = firearmMake
    if (caliber) rowData.caliber = caliber
    if (serialNumber) rowData.serialNumber = serialNumber
    if (firearmValidity) rowData.firearmValidity = firearmValidity
    if (actualAmmo) rowData.actualAmmo = actualAmmo
    if (ammoCount) rowData.ammoCount = ammoCount
    if (licRegName) rowData.licRegName = licRegName

    if (rowData.guardName && rowData.guardNumber === undefined) {
      pushWarning(
        warnings,
        warningSet,
        `Missing guard number at ${sheetName} row ${rowNumber}.`,
      )
    }

    if ((rowData.firearmKind || rowData.firearmMake || rowData.caliber) && !rowData.serialNumber) {
      pushWarning(
        warnings,
        warningSet,
        `Missing serial number for firearm details at ${sheetName} row ${rowNumber}.`,
      )
    }

    parsedRows.push(rowData)
  }

  return parsedRows
}

function isPullOutHistoricalSection(value: string): boolean {
  const normalized = value.toUpperCase()
  return (
    MONTH_PATTERN.test(normalized) &&
    (normalized.includes('RE-ROSTER') ||
      normalized.includes('REROSTER') ||
      normalized.includes('HISTORICAL') ||
      normalized.includes('SNAPSHOT'))
  )
}

function parsePullOutSheet(
  rows: unknown[][],
  sheetName: string,
  warnings: string[],
  warningSet: Set<string>,
): MdrRowData[] {
  const parsedRows: MdrRowData[] = []
  let currentClientNumber: number | undefined
  let currentClientName: string | undefined
  let currentClientAddress: string | undefined

  for (let rowIndex = 4; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const rowNumber = rowIndex + 1

    const rowSummary = squashWhitespace(
      row
        .slice(0, 16)
        .map((value) => optionalText(value))
        .filter(Boolean)
        .join(' '),
    )

    if (!rowSummary) continue
    if (STOP_MARKER_PATTERN.test(rowSummary)) break
    if (isPullOutHistoricalSection(rowSummary)) break

    const clientNumber = parseInteger(row[0])
    const clientDescriptor = parseClientDescriptor(cellText(row[1]))

    if (clientNumber !== undefined) {
      currentClientNumber = clientNumber
      currentClientName = clientDescriptor.clientName ?? currentClientName
      if (clientDescriptor.clientAddress !== undefined) {
        currentClientAddress = clientDescriptor.clientAddress
      }
    }

    const guardNumber = parseInteger(row[2])
    const guardName = optionalText(row[3])
    const contactNumber = normalizePhone(row[4])
    const licenseNumber = optionalText(row[5])
    const licenseExpiry = normalizeDate(
      row[6],
      'license expiry',
      sheetName,
      rowNumber,
      warnings,
      warningSet,
    )
    const firearmKind = optionalText(row[7])
    const pulloutStatus = optionalText(row[8])
    const firearmMake = optionalText(row[9])
    const serialNumber = optionalText(row[10])
    const firearmValidity = normalizeDate(
      row[11],
      'firearm validity',
      sheetName,
      rowNumber,
      warnings,
      warningSet,
    )
    const actualAmmo = optionalText(row[12])
    const ammoCount = optionalText(row[13])
    const licRegName = optionalText(row[15])

    const hasMeaningfulData = Boolean(
      guardNumber !== undefined ||
      guardName ||
      pulloutStatus ||
      serialNumber ||
      firearmKind ||
      firearmMake,
    )

    if (!hasMeaningfulData) continue

    const rowData: MdrRowData = {
      sheetName,
      rowNumber,
      section: 'pullout',
    }

    if (currentClientNumber !== undefined) rowData.clientNumber = currentClientNumber
    if (clientDescriptor.clientName) {
      rowData.clientName = clientDescriptor.clientName
    } else if (currentClientName) {
      rowData.clientName = currentClientName
    }

    if (clientDescriptor.clientAddress) {
      rowData.clientAddress = clientDescriptor.clientAddress
    } else if (currentClientAddress) {
      rowData.clientAddress = currentClientAddress
    }

    if (guardNumber !== undefined) rowData.guardNumber = guardNumber
    if (guardName) rowData.guardName = guardName
    if (contactNumber) rowData.contactNumber = contactNumber
    if (licenseNumber) rowData.licenseNumber = licenseNumber
    if (licenseExpiry) rowData.licenseExpiry = licenseExpiry
    if (firearmKind) rowData.firearmKind = firearmKind
    if (firearmMake) rowData.firearmMake = firearmMake
    if (serialNumber) rowData.serialNumber = serialNumber
    if (firearmValidity) rowData.firearmValidity = firearmValidity
    if (actualAmmo) rowData.actualAmmo = actualAmmo
    if (ammoCount) rowData.ammoCount = ammoCount
    if (licRegName) rowData.licRegName = licRegName
    if (pulloutStatus) rowData.pulloutStatus = pulloutStatus

    if (!pulloutStatus) {
      pushWarning(
        warnings,
        warningSet,
        `Missing pull-out status at ${sheetName} row ${rowNumber}.`,
      )
    }

    parsedRows.push(rowData)
  }

  return parsedRows
}

function parseReturnedFirearmsSheet(
  rows: unknown[][],
  sheetName: string,
  warnings: string[],
  warningSet: Set<string>,
): MdrRowData[] {
  const parsedRows: MdrRowData[] = []
  let currentFirearmKind: string | undefined

  for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const rowNumber = rowIndex + 1

    const colA = optionalText(row[0])
    const colB = optionalText(row[1])
    const colC = optionalText(row[2])
    const colD = optionalText(row[3])
    const colE = optionalText(row[4])

    const rowSummary = squashWhitespace([colA, colB, colC, colD, colE].filter(Boolean).join(' '))
    if (!rowSummary) continue
    if (STOP_MARKER_PATTERN.test(rowSummary)) break

    if (colA && !colB && !colC && !colD && !colE) {
      currentFirearmKind = colA
      continue
    }

    const serialNumber = colB ?? colC
    const firearmMake = colC ?? colD
    const faRemarks = colD ?? colE
    const firearmKind = colA ?? currentFirearmKind

    if (!serialNumber && !firearmMake && !faRemarks) continue

    const rowData: MdrRowData = {
      sheetName,
      rowNumber,
      section: 'returned',
    }

    if (firearmKind) rowData.firearmKind = firearmKind
    if (serialNumber) rowData.serialNumber = serialNumber
    if (firearmMake) rowData.firearmMake = firearmMake
    if (faRemarks) rowData.faRemarks = faRemarks

    if (!rowData.serialNumber) {
      pushWarning(
        warnings,
        warningSet,
        `Missing serial number in returned firearms at ${sheetName} row ${rowNumber}.`,
      )
    }

    parsedRows.push(rowData)
  }

  return parsedRows
}

function identifySheets(sheetNames: string[]): SheetMapping {
  const claimed = new Set<string>()

  const claim = (name: string | undefined): string | undefined => {
    if (!name) return undefined
    claimed.add(name)
    return name
  }

  const pick = (predicate: (name: string) => boolean): string | undefined => {
    const match = sheetNames.find((name) => !claimed.has(name) && predicate(name))
    return claim(match)
  }

  const mainRosterName =
    pick((name) => MONTH_PATTERN.test(name)) ??
    pick((name) => /MAIN|ROSTER/i.test(name)) ??
    claim(sheetNames[0])

  const supplementaryName = pick((name) => /^SHEET\s*1$/i.test(name) || /SUPPLEMENT/i.test(name))
  const pullOutName = pick((name) => /PULL\s*[- ]?\s*OUT|PULLOUT/i.test(name))
  const returnedName = pick((name) => /FA\s*[- ]?\s*RETURNED|RETURNED\s*TO\s*GHQ|RETURNED/i.test(name))

  return {
    mainRosterName,
    supplementaryName,
    pullOutName,
    returnedName,
  }
}

export async function parseMdrWorkbook(file: File): Promise<MdrParseResult> {
  const warnings: string[] = []
  const warningSet = new Set<string>()

  const arrayBuffer = await readFileAsArrayBuffer(file)
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })

  if (workbook.SheetNames.length === 0) {
    throw new Error('Workbook does not contain any sheets.')
  }

  const mapping = identifySheets(workbook.SheetNames)
  const mainSheetName = mapping.mainRosterName

  if (!mainSheetName) {
    throw new Error('Unable to identify the main MDR roster sheet.')
  }

  const mainSheet = workbook.Sheets[mainSheetName]
  if (!mainSheet) {
    throw new Error(`Main roster sheet ${mainSheetName} is not accessible.`)
  }

  const mainRows = toSheetRows(mainSheet)
  const reportMonth = extractReportMonth(mainRows, mainSheetName)
  const branch = extractBranch(mainRows)

  const result: MdrParseResult = {
    filename: file.name,
    reportMonth,
    branch,
    sheets: {
      mainRoster: parseRosterSheet(mainRows, mainSheetName, warnings, warningSet),
      supplementary: [],
      pullOut: [],
      returnedFirearms: [],
    },
    warnings,
  }

  if (mapping.supplementaryName) {
    const supplementarySheet = workbook.Sheets[mapping.supplementaryName]
    if (supplementarySheet) {
      const supplementaryRows = toSheetRows(supplementarySheet)
      result.sheets.supplementary = parseRosterSheet(
        supplementaryRows,
        mapping.supplementaryName,
        warnings,
        warningSet,
      )
    } else {
      pushWarning(
        warnings,
        warningSet,
        `Supplementary sheet ${mapping.supplementaryName} could not be read.`,
      )
    }
  } else {
    pushWarning(warnings, warningSet, 'Supplementary roster sheet not detected.')
  }

  if (mapping.pullOutName) {
    const pullOutSheet = workbook.Sheets[mapping.pullOutName]
    if (pullOutSheet) {
      const pullOutRows = toSheetRows(pullOutSheet)
      result.sheets.pullOut = parsePullOutSheet(pullOutRows, mapping.pullOutName, warnings, warningSet)
    } else {
      pushWarning(
        warnings,
        warningSet,
        `Pull-out sheet ${mapping.pullOutName} could not be read.`,
      )
    }
  } else {
    pushWarning(warnings, warningSet, 'Pull-out sheet not detected.')
  }

  if (mapping.returnedName) {
    const returnedSheet = workbook.Sheets[mapping.returnedName]
    if (returnedSheet) {
      const returnedRows = toSheetRows(returnedSheet)
      result.sheets.returnedFirearms = parseReturnedFirearmsSheet(
        returnedRows,
        mapping.returnedName,
        warnings,
        warningSet,
      )
    } else {
      pushWarning(
        warnings,
        warningSet,
        `Returned firearms sheet ${mapping.returnedName} could not be read.`,
      )
    }
  } else {
    pushWarning(warnings, warningSet, 'Returned firearms sheet not detected.')
  }

  return result
}
