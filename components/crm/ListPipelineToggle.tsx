'use client'

import { useState } from 'react'
import { Kanban, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ListPipelineToggle({ list, pipeline }: { list: React.ReactNode; pipeline: React.ReactNode }) {
  const [view, setView] = useState<'list' | 'pipeline'>('list')

  return (
    <div className="space-y-3">
      <div className="flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <Button type="button" variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')}>
          <LayoutList className="h-4 w-4" />
          List
        </Button>
        <Button type="button" variant={view === 'pipeline' ? 'default' : 'ghost'} size="sm" onClick={() => setView('pipeline')}>
          <Kanban className="h-4 w-4" />
          Pipeline
        </Button>
      </div>
      {view === 'list' ? list : pipeline}
    </div>
  )
}
