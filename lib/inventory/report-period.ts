export function previousMonthWindow(now = new Date()) {
  const startThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const start = new Date(Date.UTC(startThisMonth.getUTCFullYear(), startThisMonth.getUTCMonth() - 1, 1))
  return { start, end: startThisMonth, reportMonth: start.toISOString().slice(0, 7) }
}
