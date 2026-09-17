import * as XLSX from 'xlsx'
import { MdrParseResult, parseMdrWorkbook } from '../MdrParseEngine'

function workbookFile(rows: unknown[][], sheetName = 'MARCH'): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

  return new File([bytes], 'UPDATED.MDR MARCH 2026.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function mainRosterRows(): unknown[][] {
  return [
    ['Davao Security and Investigation Agency'],
    ['Address'],
    [''],
    ['Month of MARCH 2026'],
    [''],
    ['TAGUM BRANCH'],
    ['No.', "CLIENT'S", 'No.', 'SECURITY GUARDS', 'Contact Number', 'SECURITY LICENSE'],
    ['', '', '', '', '', 'License No.'],
    [1, 'Client Site', 7, 'GUARD, TEST', '09171234567', 'R11202308000370', 45937, 'Pistol', 'Armscor', '9mm', '1312109', 46972],
  ]
}

describe('MDR workbook parser', () => {
  it('preserves Excel date-only values and extracts guard license fields', async () => {
    const result: MdrParseResult = await parseMdrWorkbook(workbookFile(mainRosterRows()))
    const [guard] = result.sheets.mainRoster

    expect(guard).toMatchObject({
      guardName: 'GUARD, TEST',
      licenseNumber: 'R11202308000370',
      licenseExpiry: '2025-10-07',
    })
  })

  it('does not skip the first data row in a supplementary roster', async () => {
    const supplementary = XLSX.utils.aoa_to_sheet([
      ['No.', "CLIENT'S", 'No.', 'SECURITY GUARDS', 'Contact Number', 'SECURITY LICENSE'],
      ['', '', '', '', '', 'License No.'],
      ['', 'SUPPLEMENTARY SITE', 121, 'GUARD, FIRST', '09171234567', 'R11202308000370', 45937],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(mainRosterRows()), 'MARCH')
    XLSX.utils.book_append_sheet(workbook, supplementary, 'Sheet1')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const result = await parseMdrWorkbook(new File([bytes], 'fixture.xlsx'))

    expect(result.sheets.supplementary[0]).toMatchObject({
      guardName: 'GUARD, FIRST',
      clientName: 'SUPPLEMENTARY SITE',
    })
  })

  it('reads both pull-out column layouts and keeps returned serials separate from row numbers', async () => {
    const main = XLSX.utils.aoa_to_sheet(mainRosterRows())
    const pullOut = XLSX.utils.aoa_to_sheet([
      ['PULL OUT SEPTEMBER 2024'],
      ['No.', "CLIENT'S", 'No.', 'SECURITY GUARDS', 'Contact Number', 'SECURITY LICENSE'],
      ['', '', '', '', '', 'License No.'],
      ['', 'SITE A', '', 'GUARD, A', '09171234567', 'R11202308000370', 45937, 'RESIGN', 'Pistol', 'Armscor', '9mm', '1312109', 46972],
      ['', '', '', 'SITE B', 2, 'GUARD, B', '09181234567', 'R11202308000371', 45937, 'FLOATING', 'Shotgun', 'Akkar', '12ga', '5559379', 46972],
    ])
    const returned = XLSX.utils.aoa_to_sheet([
      ['November 2024'],
      ['', '', 'RETURNED TO GHQ'],
      ['38 Caliber Revolver', 1, 931115, 'ARMSCOR', 'defective'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, main, 'MARCH')
    XLSX.utils.book_append_sheet(workbook, pullOut, 'PULL OUT .')
    XLSX.utils.book_append_sheet(workbook, returned, 'FA-RETURNED TO GHQ')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const result = await parseMdrWorkbook(new File([bytes], 'fixture.xlsx'))

    expect(result.sheets.pullOut).toHaveLength(2)
    expect(result.sheets.pullOut[1]).toMatchObject({
      guardName: 'GUARD, B',
      pulloutStatus: 'FLOATING',
      serialNumber: '5559379',
    })
    expect(result.sheets.returnedFirearms[0]).toMatchObject({
      serialNumber: '931115',
      firearmMake: 'ARMSCOR',
      faRemarks: 'defective',
    })
  })

  it('skips armored vehicle sections and reports that vehicles must be added manually', async () => {
    const result = await parseMdrWorkbook(workbookFile([
      ...mainRosterRows(),
      ['ARMORED CAR INVENTORY'],
      ['A/C-001', 'ARMSCOR', 'PISTOL'],
      ['CLIENT SITES'],
      ['', 'SECOND SITE', 8, 'GUARD, SECOND', '09181234567', 'R11202308000371', 45937],
    ]))

    expect(result.sheets.mainRoster.some((row) => row.section === 'armored')).toBe(false)
    expect(result.warnings).toContain('Armored vehicle rows were skipped. Add vehicles manually in Resource Management.')
  })
})
