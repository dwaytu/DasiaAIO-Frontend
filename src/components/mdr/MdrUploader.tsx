import { ChangeEvent, DragEvent, FC, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { MdrParseResult, parseMdrWorkbook } from './MdrParseEngine'

interface MdrUploaderProps {
  onUploadSuccess: (batchId: string) => void
}

interface MdrImportResponse {
  batchId: string
  totalRows: number
  preview: {
    matched: number
    new: number
    ambiguous: number
    errors: number
  }
}

interface PreviewCounts {
  guards: number
  clients: number
  firearms: number
  pullOut: number
  returned: number
}

const ACCEPTED_TYPES = ['.xlsx', '.xls']

function hasAcceptedExtension(filename: string): boolean {
  const normalized = filename.toLowerCase()
  return ACCEPTED_TYPES.some((extension) => normalized.endsWith(extension))
}

function computePreviewCounts(parsed: MdrParseResult): PreviewCounts {
  const allRows = [
    ...parsed.sheets.mainRoster,
    ...parsed.sheets.supplementary,
    ...parsed.sheets.pullOut,
    ...parsed.sheets.returnedFirearms,
  ]

  const guardKeys = new Set<string>()
  const clientKeys = new Set<string>()
  const firearmKeys = new Set<string>()

  for (const row of allRows) {
    if (row.guardNumber !== undefined) {
      guardKeys.add(`g#${row.guardNumber}`)
    } else if (row.guardName) {
      guardKeys.add(`gn:${row.guardName.toLowerCase()}`)
    }

    if (row.clientNumber !== undefined) {
      clientKeys.add(`c#${row.clientNumber}`)
    } else if (row.clientName) {
      clientKeys.add(`cn:${row.clientName.toLowerCase()}`)
    }

    if (row.serialNumber) {
      firearmKeys.add(row.serialNumber.toLowerCase())
    }
  }

  return {
    guards: guardKeys.size,
    clients: clientKeys.size,
    firearms: firearmKeys.size,
    pullOut: parsed.sheets.pullOut.length,
    returned: parsed.sheets.returnedFirearms.length,
  }
}

const MdrUploader: FC<MdrUploaderProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedResult, setParsedResult] = useState<MdrParseResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  const previewCounts = useMemo(
    () => (parsedResult ? computePreviewCounts(parsedResult) : null),
    [parsedResult],
  )

  const resetMessages = () => {
    setParseError('')
    setUploadError('')
    setUploadSuccess('')
  }

  const handleWorkbookSelection = async (file: File): Promise<void> => {
    resetMessages()

    if (!hasAcceptedExtension(file.name)) {
      setSelectedFile(file)
      setParsedResult(null)
      setParseError('Only .xlsx and .xls files are supported for MDR import.')
      return
    }

    setSelectedFile(file)
    setIsParsing(true)

    try {
      const parsed = await parseMdrWorkbook(file)
      setParsedResult(parsed)
    } catch (error) {
      setParsedResult(null)
      setParseError(error instanceof Error ? error.message : 'Failed to parse workbook.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    void handleWorkbookSelection(file)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    void handleWorkbookSelection(file)
  }

  const handleUpload = async () => {
    if (!parsedResult) return

    setIsUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const response = await fetchJsonOrThrow<MdrImportResponse>(
        `${API_BASE_URL}/api/mdr/import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            filename: parsedResult.filename,
            reportMonth: parsedResult.reportMonth,
            branch: parsedResult.branch,
            sheets: parsedResult.sheets,
          }),
        },
        'Unable to upload MDR workbook.',
      )

      setUploadSuccess(`Batch ${response.batchId} uploaded successfully. Redirecting to review...`)
      onUploadSuccess(response.batchId)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="space-y-4 rounded border border-border bg-surface-elevated p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">Upload MDR Workbook</h2>
        <p className="text-sm text-text-secondary">
          Select the monthly workbook to parse, validate, and upload for staged review.
        </p>
      </header>

      <label
        htmlFor="mdr-file-input"
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragActive(true)
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`block cursor-pointer rounded border border-dashed p-6 text-center transition-colors ${
          isDragActive ? 'border-accent bg-accent/10' : 'border-border bg-surface'
        }`}
      >
        <input
          id="mdr-file-input"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          onChange={handleFileInputChange}
        />
        <div className="flex flex-col items-center justify-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-text-secondary" aria-hidden="true" />
          <p className="text-sm text-text-primary">
            Drag and drop a workbook here, or click to choose a file.
          </p>
          <span className="text-xs text-text-secondary">Accepted formats: .xlsx, .xls</span>
        </div>
      </label>

      {selectedFile ? (
        <div className="rounded border border-border bg-surface p-3 text-sm text-text-primary">
          <span className="font-medium">Selected file:</span> {selectedFile.name}
        </div>
      ) : null}

      {isParsing ? (
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm text-text-primary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Parsing workbook and extracting MDR rows...
        </div>
      ) : null}

      {parseError ? (
        <div className="flex items-start gap-2 rounded border border-danger bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span>{parseError}</span>
        </div>
      ) : null}

      {parsedResult && previewCounts ? (
        <div className="space-y-4 rounded border border-success bg-success/10 p-4">
          <div className="flex items-start gap-2 text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Workbook parsed successfully</p>
              <p className="text-xs text-text-secondary">
                Month: {parsedResult.reportMonth} | Branch: {parsedResult.branch}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Guards</dt>
              <dd className="text-lg font-semibold text-text-primary">{previewCounts.guards}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Clients</dt>
              <dd className="text-lg font-semibold text-text-primary">{previewCounts.clients}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Firearms</dt>
              <dd className="text-lg font-semibold text-text-primary">{previewCounts.firearms}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Pull-outs</dt>
              <dd className="text-lg font-semibold text-text-primary">{previewCounts.pullOut}</dd>
            </div>
            <div className="rounded border border-border bg-surface p-3">
              <dt className="text-xs text-text-secondary">Returned</dt>
              <dd className="text-lg font-semibold text-text-primary">{previewCounts.returned}</dd>
            </div>
          </dl>

          {parsedResult.warnings.length > 0 ? (
            <div className="rounded border border-warning bg-warning/10 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Parsing warnings ({parsedResult.warnings.length})
              </p>
              <ul className="space-y-1 text-xs text-text-secondary">
                {parsedResult.warnings.slice(0, 20).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
              {parsedResult.warnings.length > 20 ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Showing first 20 warnings. Remaining warnings will still be included in review context.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {uploadError ? (
        <div className="flex items-start gap-2 rounded border border-danger bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span>{uploadError}</span>
        </div>
      ) : null}

      {uploadSuccess ? (
        <div className="flex items-start gap-2 rounded border border-success bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span>{uploadSuccess}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="soc-btn inline-flex min-h-11 items-center gap-2"
        disabled={!parsedResult || isParsing || isUploading}
        onClick={() => {
          void handleUpload()
        }}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        {isUploading ? 'Uploading...' : 'Upload & Process'}
      </button>
    </section>
  )
}

export default MdrUploader
