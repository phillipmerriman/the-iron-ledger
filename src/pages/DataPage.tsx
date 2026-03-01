import { useState, useRef } from 'react'
import { Download, Upload, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import Card from '@/components/ui/Card'
import {
  CATEGORIES,
  buildExport,
  getExportFilename,
  downloadJson,
  parseImportFile,
  getImportSummary,
  getAvailableImportCategories,
  importData,
  type CategoryKey,
  type ExportData,
  type ImportSummary,
} from '@/lib/data-export'

export default function DataPage() {
  const { user } = useAuth()

  // Export state
  const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(
    CATEGORIES.map((c) => c.key),
  )

  // Import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = useState<ExportData | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importCategories, setImportCategories] = useState<CategoryKey[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

  function toggleCategory(key: CategoryKey) {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function toggleAll() {
    if (selectedCategories.length === CATEGORIES.length) {
      setSelectedCategories([])
    } else {
      setSelectedCategories(CATEGORIES.map((c) => c.key))
    }
  }

  function handleExport() {
    if (!user || selectedCategories.length === 0) return
    const data = buildExport(user.id, selectedCategories)
    const filename = getExportFilename(selectedCategories)
    downloadJson(data, filename)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportResult(null)
    try {
      const data = await parseImportFile(file)
      setImportFile(data)
      setImportFileName(file.name)
      setImportCategories(getAvailableImportCategories(data))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse file')
      setImportFile(null)
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function toggleImportCategory(key: CategoryKey) {
    setImportCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function handleImport() {
    if (!user || !importFile || importCategories.length === 0) return
    const result = importData(user.id, importFile, importCategories)
    setImportResult(result)
    setImportFile(null)
  }

  function handleCancelImport() {
    setImportFile(null)
    setImportFileName('')
    setImportError(null)
    setImportResult(null)
  }

  const importSummary = importFile ? getImportSummary(importFile) : null
  const availableImportCategories = importFile ? getAvailableImportCategories(importFile) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data</h1>
        <p className="mt-1 text-sm text-surface-500">
          Export and import your fitness data as JSON.
        </p>
      </div>

      {/* Export */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">Export</h2>
          </div>
          <p className="text-sm text-surface-500">
            Select which data categories to include in the export.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCategories.length === CATEGORIES.length}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="font-medium text-surface-700">Select All</span>
            </label>
            <div className="ml-4 space-y-1.5">
              {CATEGORIES.map((cat) => (
                <label key={cat.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.key)}
                    onChange={() => toggleCategory(cat.key)}
                    className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-surface-700">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={selectedCategories.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </Card>

      {/* Import */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">Import</h2>
          </div>
          <p className="text-sm text-surface-500">
            Upload a previously exported JSON file to import data. Existing records are updated, new records are added.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!importFile && !importResult && (
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
            >
              <Upload className="h-4 w-4" />
              Choose File
            </button>
          )}

          {importError && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          {/* Import preview */}
          {importFile && importSummary && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-surface-700">
                File: <span className="font-normal text-surface-500">{importFileName}</span>
              </p>
              {availableImportCategories.length === 0 ? (
                <p className="text-xs text-surface-400">No data found in file</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
                    Select categories to import
                  </p>
                  <div className="space-y-1.5">
                    {CATEGORIES.filter((cat) => availableImportCategories.includes(cat.key)).map((cat) => {
                      const count = importSummary[cat.key as keyof ImportSummary] ?? 0
                      return (
                        <label key={cat.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={importCategories.includes(cat.key)}
                            onChange={() => toggleImportCategory(cat.key)}
                            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-surface-700">{cat.label}</span>
                          <span className="text-xs text-surface-400">({count})</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={importCategories.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
                <button
                  onClick={handleCancelImport}
                  className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                <Check className="h-4 w-4 shrink-0" />
                Import complete
              </div>
              <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-500">
                  Imported
                </p>
                <div className="space-y-1">
                  {importResult.exercises > 0 && (
                    <SummaryRow label="Exercises" count={importResult.exercises} />
                  )}
                  {importResult.workout_templates > 0 && (
                    <SummaryRow label="Workout Templates" count={importResult.workout_templates} />
                  )}
                  {importResult.workout_template_exercises > 0 && (
                    <SummaryRow label="Template Exercises" count={importResult.workout_template_exercises} />
                  )}
                  {importResult.workout_sessions > 0 && (
                    <SummaryRow label="Workout Sessions" count={importResult.workout_sessions} />
                  )}
                  {importResult.workout_sets > 0 && (
                    <SummaryRow label="Workout Sets" count={importResult.workout_sets} />
                  )}
                  {importResult.programs > 0 && (
                    <SummaryRow label="Programs" count={importResult.programs} />
                  )}
                  {importResult.program_days > 0 && (
                    <SummaryRow label="Program Days" count={importResult.program_days} />
                  )}
                  {importResult.program_day_exercises > 0 && (
                    <SummaryRow label="Program Day Exercises" count={importResult.program_day_exercises} />
                  )}
                  {importResult.weekly_plans > 0 && (
                    <SummaryRow label="Weekly Plan Entries" count={importResult.weekly_plans} />
                  )}
                  {importResult.personal_records > 0 && (
                    <SummaryRow label="Personal Records" count={importResult.personal_records} />
                  )}
                  {importResult.body_measurements > 0 && (
                    <SummaryRow label="Body Measurements" count={importResult.body_measurements} />
                  )}
                  {Object.values(importResult).every((v) => v === 0) && (
                    <p className="text-xs text-surface-400">No new data imported (all records already exist)</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleCancelImport}
                className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function SummaryRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-surface-600">{label}</span>
      <span className="font-medium text-surface-800">{count}</span>
    </div>
  )
}
