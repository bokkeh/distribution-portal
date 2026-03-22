export type DeliveryStopPhotoFields = {
  additionalPhotoUrl?: string | null
  additionalPhotoUrl2?: string | null
  additionalPhotoUrl3?: string | null
  additionalPhotoUrl4?: string | null
  additionalPhotoUrl5?: string | null
}

export function getDeliveryStopAdditionalPhotos(stop: DeliveryStopPhotoFields): string[] {
  return [
    stop.additionalPhotoUrl,
    stop.additionalPhotoUrl2,
    stop.additionalPhotoUrl3,
    stop.additionalPhotoUrl4,
    stop.additionalPhotoUrl5,
  ].filter(Boolean) as string[]
}
