function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(escapeCsvCell).join(',')]
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(','))
  return lines.join('\n')
}
