type Point = { lat: number; lng: number }

function cross(O: Point, A: Point, B: Point) {
  return (A.lat - O.lat) * (B.lng - O.lng) - (A.lng - O.lng) * (B.lat - O.lat)
}

/** Andrew's monotone chain — returns the convex hull in counter-clockwise order. */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points]

  const sorted = [...points].sort((a, b) =>
    a.lat !== b.lat ? a.lat - b.lat : a.lng - b.lng,
  )

  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()

  return [...lower, ...upper]
}

/**
 * Expands a convex hull polygon outward from its centroid by `padDeg` degrees.
 * This creates a visible buffer around the outermost markers so the region
 * boundary doesn't sit right on top of them.
 */
export function expandHull(hull: Point[], padDeg = 0.012): Point[] {
  if (hull.length === 0) return hull

  const centLat = hull.reduce((s, p) => s + p.lat, 0) / hull.length
  const centLng = hull.reduce((s, p) => s + p.lng, 0) / hull.length

  return hull.map(p => {
    const dLat = p.lat - centLat
    const dLng = p.lng - centLng
    const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 0.0001
    return {
      lat: p.lat + (dLat / dist) * padDeg,
      lng: p.lng + (dLng / dist) * padDeg,
    }
  })
}

/**
 * Returns a circle polygon (n-gon approximation) centred on a point.
 * `radiusDeg` is the radius in degrees (~0.009 ≈ 1 km).
 */
export function circlePolygon(centre: Point, radiusDeg = 0.015, steps = 36): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (2 * Math.PI * i) / steps
    return {
      lat: centre.lat + radiusDeg * Math.cos(angle),
      lng: centre.lng + radiusDeg * Math.sin(angle),
    }
  })
}
