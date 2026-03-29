import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, deliveries, deliveryStops, drivers } from '@/db/schema'

export type DeliveryStopRow = {
  id: string
  sequenceNumber: number
  address: string
  status: 'pending' | 'delivered' | 'failed'
  customerStatus: 'not_started' | 'out_for_delivery' | 'arriving_soon' | 'arrived' | 'delivered' | 'failed'
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
  proofOfDeliveryUrl: string | null
  shelfPhotoUrl: string | null
  additionalPhotoUrl: string | null
  additionalPhotoUrl2: string | null
  additionalPhotoUrl3: string | null
  additionalPhotoUrl4: string | null
  additionalPhotoUrl5: string | null
  trackingEnabled: boolean
  trackingToken: string | null
  etaMinutes: number | null
  lastLocationAt: Date | null
  recipientSignatureUrl: string | null
  recipientSignedName: string | null
  lat: string | null
  lng: string | null
  companyName: string | null
}

export type DriverDeliveryCard = {
  id: string
  weekStartDate: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  originAddress: string | null
  stops: DeliveryStopRow[]
  deliveredCount: number
  failedCount: number
  pendingCount: number
  mappedCount: number
  capturedProofCount: number
  nextStop: DeliveryStopRow | null
  progress: number
}

export type PreviousDriverDeliveryCard = {
  id: string
  weekStartDate: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  originAddress: string | null
  stopCount: number
  deliveredCount: number
  failedCount: number
  capturedProofCount: number
}

export type DriverWorkspaceData = {
  driver: typeof drivers.$inferSelect
  deliveryCards: DriverDeliveryCard[]
  previousDeliveryCards: PreviousDriverDeliveryCard[]
  totalStops: number
  deliveredStops: number
  failedStops: number
  mappedStops: number
  proofCaptured: number
  activeDelivery: DriverDeliveryCard | null
  homeBaseAddress: string
  prepChecklist: Array<{ label: string; hint: string; ready: boolean }>
}

export function hasPhoto(stop: DeliveryStopRow) {
  return Boolean(
    stop.proofOfDeliveryUrl ||
    stop.shelfPhotoUrl ||
    stop.additionalPhotoUrl ||
    stop.additionalPhotoUrl2 ||
    stop.additionalPhotoUrl3 ||
    stop.additionalPhotoUrl4 ||
    stop.additionalPhotoUrl5,
  )
}

export async function getStopsForDelivery(deliveryId: string) {
  try {
    return await db
      .select({
        id: deliveryStops.id,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        status: deliveryStops.status,
        customerStatus: deliveryStops.customerStatus,
        contactName: deliveryStops.contactName,
        contactPhone: deliveryStops.contactPhone,
        contactEmail: deliveryStops.contactEmail,
        notes: deliveryStops.notes,
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
        additionalPhotoUrl: deliveryStops.additionalPhotoUrl,
        additionalPhotoUrl2: deliveryStops.additionalPhotoUrl2,
        additionalPhotoUrl3: deliveryStops.additionalPhotoUrl3,
        additionalPhotoUrl4: deliveryStops.additionalPhotoUrl4,
        additionalPhotoUrl5: deliveryStops.additionalPhotoUrl5,
        trackingEnabled: deliveryStops.trackingEnabled,
        trackingToken: deliveryStops.trackingToken,
        etaMinutes: deliveryStops.etaMinutes,
        lastLocationAt: deliveryStops.lastLocationAt,
        recipientSignatureUrl: deliveryStops.recipientSignatureUrl,
        recipientSignedName: deliveryStops.recipientSignedName,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(asc(deliveryStops.sequenceNumber))
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (code !== '42703' && !message.includes('contact_name') && !message.includes('contact_phone') && !message.includes('contact_email')) {
      throw error
    }

    return db
      .select({
        id: deliveryStops.id,
        sequenceNumber: deliveryStops.sequenceNumber,
        address: deliveryStops.address,
        status: deliveryStops.status,
        notes: deliveryStops.notes,
        lat: deliveryStops.lat,
        lng: deliveryStops.lng,
        companyName: customerAccounts.companyName,
      })
      .from(deliveryStops)
      .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(asc(deliveryStops.sequenceNumber))
      .then((rows) => rows.map((row) => ({
        ...row,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        proofOfDeliveryUrl: null,
        shelfPhotoUrl: null,
        additionalPhotoUrl: null,
        additionalPhotoUrl2: null,
        additionalPhotoUrl3: null,
        additionalPhotoUrl4: null,
        additionalPhotoUrl5: null,
        customerStatus: (row.status === 'delivered' ? 'delivered' : row.status === 'failed' ? 'failed' : 'not_started') as DeliveryStopRow['customerStatus'],
        trackingEnabled: false,
        trackingToken: null,
        etaMinutes: null,
        lastLocationAt: null,
        recipientSignatureUrl: null,
        recipientSignedName: null,
      } as DeliveryStopRow)))
  }
}

export async function getDriverWorkspaceData(userId: string): Promise<DriverWorkspaceData | null> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId))
  if (!driver) return null

  const myDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      originAddress: deliveries.originAddress,
    })
    .from(deliveries)
    .where(and(eq(deliveries.driverId, driver.id), inArray(deliveries.status, ['scheduled', 'in_progress'])))
    .orderBy(asc(deliveries.weekStartDate))
    .limit(6)

  const previousDeliveries = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
      status: deliveries.status,
      originAddress: deliveries.originAddress,
    })
    .from(deliveries)
    .where(and(eq(deliveries.driverId, driver.id), eq(deliveries.status, 'completed')))
    .orderBy(desc(deliveries.weekStartDate))
    .limit(8)

  const deliveryCards = await Promise.all(
    myDeliveries.map(async (delivery) => {
      const stops = await getStopsForDelivery(delivery.id)
      const deliveredCount = stops.filter((stop) => stop.status === 'delivered').length
      const failedCount = stops.filter((stop) => stop.status === 'failed').length
      const pendingCount = stops.filter((stop) => stop.status === 'pending').length
      const mappedCount = stops.filter((stop) => stop.lat && stop.lng).length
      const capturedProofCount = stops.filter(hasPhoto).length
      const nextStop = stops.find((stop) => stop.status === 'pending') ?? stops[0] ?? null
      const progress = stops.length > 0 ? Math.round((deliveredCount / stops.length) * 100) : 0

      return {
        ...delivery,
        stops,
        deliveredCount,
        failedCount,
        pendingCount,
        mappedCount,
        capturedProofCount,
        nextStop,
        progress,
      } satisfies DriverDeliveryCard
    }),
  )
  deliveryCards.sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1
    return a.weekStartDate.localeCompare(b.weekStartDate)
  })

  const previousDeliveryCards = await Promise.all(
    previousDeliveries.map(async (delivery) => {
      const stops = await getStopsForDelivery(delivery.id)
      const deliveredCount = stops.filter((stop) => stop.status === 'delivered').length
      const failedCount = stops.filter((stop) => stop.status === 'failed').length
      const capturedProofCount = stops.filter(hasPhoto).length

      return {
        ...delivery,
        stopCount: stops.length,
        deliveredCount,
        failedCount,
        capturedProofCount,
      } satisfies PreviousDriverDeliveryCard
    }),
  )

  const totalStops = deliveryCards.reduce((sum, delivery) => sum + delivery.stops.length, 0)
  const deliveredStops = deliveryCards.reduce((sum, delivery) => sum + delivery.deliveredCount, 0)
  const failedStops = deliveryCards.reduce((sum, delivery) => sum + delivery.failedCount, 0)
  const mappedStops = deliveryCards.reduce((sum, delivery) => sum + delivery.mappedCount, 0)
  const proofCaptured = deliveryCards.reduce((sum, delivery) => sum + delivery.capturedProofCount, 0)
  const activeDelivery = deliveryCards.find((delivery) => delivery.status === 'in_progress') ?? deliveryCards[0] ?? null
  const homeBaseAddress = [driver.homeAddress, driver.homeCity, driver.homeState, driver.homeZip].filter(Boolean).join(', ')
  const prepChecklist = [
    {
      label: 'Vehicle details on file',
      hint: driver.vehicleMake || driver.vehicleModel || driver.licensePlate ? 'Ready for dispatch reference' : 'Add vehicle info in your profile',
      ready: Boolean(driver.vehicleMake || driver.vehicleModel || driver.licensePlate),
    },
    {
      label: 'Home base configured',
      hint: homeBaseAddress ? homeBaseAddress : 'Add a home base for cleaner route starts',
      ready: Boolean(homeBaseAddress),
    },
    {
      label: 'Stops mapped',
      hint: totalStops > 0 ? `${mappedStops}/${totalStops} stops have coordinates` : 'No stops assigned yet',
      ready: totalStops > 0 && mappedStops === totalStops,
    },
    {
      label: 'Proof capture coverage',
      hint: totalStops > 0 ? `${proofCaptured}/${totalStops} stops already include photos` : 'Capture photos as you complete stops',
      ready: totalStops > 0 && proofCaptured >= deliveredStops,
    },
  ]

  return {
    driver,
    deliveryCards,
    previousDeliveryCards,
    totalStops,
    deliveredStops,
    failedStops,
    mappedStops,
    proofCaptured,
    activeDelivery,
    homeBaseAddress,
    prepChecklist,
  }
}
