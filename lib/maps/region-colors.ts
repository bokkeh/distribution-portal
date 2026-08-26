export const REGION_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#A855F7', // purple
  '#84CC16', // lime
  '#F43F5E', // rose
]

export function getRegionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length]
}

export function buildRegionColorMap(regionNames: string[]): Record<string, string> {
  const sortedNames = [...new Set(regionNames)].sort((a, b) => a.localeCompare(b))
  const map: Record<string, string> = {}
  sortedNames.forEach((name, index) => {
    map[name] = getRegionColor(index)
  })
  return map
}
