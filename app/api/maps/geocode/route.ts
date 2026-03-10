import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { geocodeAddress } from '@/lib/maps/geocode'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 })

  const coords = await geocodeAddress(address)
  if (!coords) return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 })

  return NextResponse.json(coords)
}
