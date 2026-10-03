type ReportWorkflowTasting = {
  scheduledAt: Date | string
  status: string
  reportSubmittedAt?: Date | string | null
}

function canReport(tasting: ReportWorkflowTasting) {
  return ['scheduled', 'confirmed', 'completed'].includes(tasting.status)
}

export function needsTastingReport(tasting: ReportWorkflowTasting, now = new Date()) {
  return canReport(tasting) && !tasting.reportSubmittedAt
    && (tasting.status === 'completed' || new Date(tasting.scheduledAt) <= now)
}

// Keep unfinished assignments reachable throughout the event and after it ends.
export function isActiveTasterTasting(tasting: ReportWorkflowTasting, now = new Date()) {
  return canReport(tasting) && !tasting.reportSubmittedAt
    && (new Date(tasting.scheduledAt) > now || needsTastingReport(tasting, now))
}
