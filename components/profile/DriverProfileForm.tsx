'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDriverProfile, getVehiclePhotoUploadUrl } from '@/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Car, Camera, Loader2, MapPin, Search } from 'lucide-react'
import Image from 'next/image'
import { ProfilePhotoUploadField } from '@/components/profile/ProfilePhotoUploadField'
import { COMMON_TIME_ZONES } from '@/lib/timezones'

interface Props {
  user: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null }
  driver: {
    id: string
    vehicleMake: string | null
    vehicleModel: string | null
    vehicleYear: string | null
    vin: string | null
    licensePlate: string | null
    vehicleImageUrl: string | null
    homeAddress: string | null
    homeCity: string | null
    homeState: string | null
    homeZip: string | null
  } | null
  preferences?: {
    timeZone: string
    notificationPreference: string
    emailNotificationsEnabled: boolean
    smsNotificationsEnabled: boolean
    inAppNotificationsEnabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
  }
}

interface VinResult {
  make: string
  model: string
  year: string
  bodyClass: string
}

async function decodeVin(vin: string): Promise<VinResult | null> {
  if (vin.length < 17) return null
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`)
    const data = await res.json()
    const results: Array<{ Variable: string; Value: string }> = data.Results ?? []
    const get = (variable: string) => results.find(result => result.Variable === variable)?.Value ?? ''
    const make = get('Make')
    const model = get('Model')
    const year = get('Model Year')
    const bodyClass = get('Body Class')
    if (!make || make === 'null') return null
    return { make, model, year, bodyClass }
  } catch {
    return null
  }
}

export function DriverProfileForm({ user, driver, preferences }: Props) {
  const [state, action, pending] = useActionState(updateDriverProfile, null)

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '')
  const [vehicleImageUrl, setVehicleImageUrl] = useState(driver?.vehicleImageUrl ?? '')
  const [make, setMake] = useState(driver?.vehicleMake ?? '')
  const [model, setModel] = useState(driver?.vehicleModel ?? '')
  const [year, setYear] = useState(driver?.vehicleYear ?? '')
  const [vin, setVin] = useState(driver?.vin ?? '')
  const [vinDecoding, setVinDecoding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.error) toast.error('Failed to save', { description: state.error })
    else if (state && !state.error) toast.success('Profile saved')
  }, [state])

  async function handleVinDecode() {
    if (vin.length < 17) {
      toast.error('VIN must be 17 characters')
      return
    }

    setVinDecoding(true)
    const result = await decodeVin(vin)
    setVinDecoding(false)

    if (result) {
      setMake(result.make)
      setModel(result.model)
      setYear(result.year)
      toast.success(`Found: ${result.year} ${result.make} ${result.model}`)
      return
    }

    toast.error('Could not decode VIN. Check the number and try again.')
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.')
      return
    }

    setUploading(true)
    try {
      const { uploadUrl, publicUrl, error } = await getVehiclePhotoUploadUrl(file.type)
      if (error) throw new Error(error)

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!response.ok) throw new Error('Upload failed')

      setVehicleImageUrl(publicUrl)
      toast.success('Photo uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={action} className="max-w-lg space-y-6">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      {driver && <input type="hidden" name="driverId" value={driver.id} />}
      <input type="hidden" name="vehicleImageUrl" value={vehicleImageUrl} />
      <input type="hidden" name="vehicleMake" value={make} />
      <input type="hidden" name="vehicleModel" value={model} />
      <input type="hidden" name="vehicleYear" value={year} />
      <input type="hidden" name="vin" value={vin} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfilePhotoUploadField value={avatarUrl} onChange={setAvatarUrl} disabled={pending || uploading} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={user.email} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input name="phone" type="tel" defaultValue={user.phone ?? ''} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Time Zone</Label>
              <select name="timeZone" defaultValue={preferences?.timeZone ?? 'America/New_York'} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {COMMON_TIME_ZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notification Mode</Label>
              <select name="notificationPreference" defaultValue={preferences?.notificationPreference ?? 'all'} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="all">All notifications</option>
                <option value="important">Important only</option>
                <option value="quiet">Minimal</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="emailNotificationsEnabled" defaultChecked={preferences?.emailNotificationsEnabled ?? true} />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="smsNotificationsEnabled" defaultChecked={preferences?.smsNotificationsEnabled ?? true} />
              SMS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="inAppNotificationsEnabled" defaultChecked={preferences?.inAppNotificationsEnabled ?? true} />
              In-app
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quiet Hours Start</Label>
              <Input name="quietHoursStart" type="time" defaultValue={preferences?.quietHoursStart ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>Quiet Hours End</Label>
              <Input name="quietHoursEnd" type="time" defaultValue={preferences?.quietHoursEnd ?? ''} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Home Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Home Address</Label>
            <Input name="homeAddress" defaultValue={driver?.homeAddress ?? ''} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input name="homeCity" defaultValue={driver?.homeCity ?? ''} placeholder="Houston" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input name="homeState" defaultValue={driver?.homeState ?? ''} placeholder="TX" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input name="homeZip" defaultValue={driver?.homeZip ?? ''} placeholder="77001" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This address is used as the route starting point for the driver map and drive-time estimate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="h-4 w-4 text-muted-foreground" /> Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>VIN (Vehicle Identification Number)</Label>
            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={event => setVin(event.target.value.toUpperCase())}
                placeholder="1HGBH41JXMN109186"
                maxLength={17}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => startTransition(handleVinDecode)}
                disabled={vinDecoding || vin.length < 17}
                className="shrink-0 gap-1.5"
              >
                {vinDecoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Decode
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your 17-character VIN to auto-fill make, model, and year.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input value={year} onChange={event => setYear(event.target.value)} placeholder="2022" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={make} onChange={event => setMake(event.target.value)} placeholder="Ford" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={model} onChange={event => setModel(event.target.value)} placeholder="Transit" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>License Plate</Label>
            <Input name="licensePlate" defaultValue={driver?.licensePlate ?? ''} placeholder="ABC-1234" />
          </div>

          <div className="space-y-2">
            <Label>Vehicle Photo</Label>
            {vehicleImageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-slate-100">
                <Image src={vehicleImageUrl} alt="Vehicle" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setVehicleImageUrl('')}
                  className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className={`flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${uploading ? 'border-slate-300 bg-slate-100' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-500">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera className="mb-2 h-6 w-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">Click to upload vehicle photo</span>
                    <span className="mt-1 text-xs text-slate-400">JPG, PNG or WebP - max 10MB</span>
                  </>
                )}
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending || uploading}>
        {pending ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  )
}
