'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { importEventAttendees } from '@/actions/events'
import { Button } from '@/components/ui/button'

export function EventCsvImport({ eventId }: { eventId: string }) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  return (
    <form action={importEventAttendees} className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="csvText" value={csvText} />
      <div><p className="text-sm font-semibold">Import attendees</p><p className="text-xs text-slate-500">CSV columns: first name, last name, email, phone, notes. Maximum 1,000 rows.</p></div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium hover:bg-slate-50"><Upload className="h-4 w-4" />{fileName || 'Choose CSV'}<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); setCsvText(await file.text()) }} /></label>
      <Button type="submit" variant="outline" className="w-full" disabled={!csvText}>Import CSV</Button>
    </form>
  )
}
