'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDriverProfile, getVehiclePhotoUploadUrl } from '@/actions/profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Car, Camera, Loader2, Search } from 'lucide-react'
import Image from 'next/image'

interface Props {
  user: { id: string; name: string; email: string; phone: string | null }
  driver: {
    id: string
    vehicleMake: string | null
    vehicleModel: string | null
    vehicleYear: string | null
    vin: string | null
    licensePlate: string | null
    vehicleImageUrl: string | null
  } | null
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
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`
    )
    const data = await res.json()
    const results: Array<{ Variable: string; Value: string }> = data.Results ?? []
    const get = (v: string) => results.find(r => r.Variable === v)?.Value ?? ''
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

export function DriverProfileForm({ user, driver }: Props) {
  const [state, action, pending] = useActionState(updateDriverProfile, null)

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
    } else {
      toast.error('Could not decode VIN — check the number and try again')
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large — maximum 10MB')
      return
    }

    setUploading(true)
    try {
      const { uploadUrl, publicUrl, error } = await getVehiclePhotoUploadUrl(file.type)
      if (error) throw new Error(error)

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!res.ok) throw new Error('Upload failed')

      setVehicleImageUrl(publicUrl)
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={action} className="space-y-6 max-w-lg">
      <input type="hidden" name="userId" value={user.id} />
      {driver && <input type="hidden" name="driverId" value={driver.id} />}
      <input type="hidden" name="vehicleImageUrl" value={vehicleImageUrl} />
      {/* Controlled fields need hidden inputs so the action gets the latest values */}
      <input type="hidden" name="vehicleMake" value={make} />
      <input type="hidden" name="vehicleModel" value={model} />
      <input type="hidden" name="vehicleYear" value={year} />
      <input type="hidden" name="vin" value={vin} />

      {/* ── Personal ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-muted-foreground" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      {/* ── Vehicle ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Car className="w-4 h-4 text-muted-foreground" /> Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* VIN decoder */}
          <div className="space-y-1.5">
            <Label>VIN (Vehicle Identification Number)</Label>
            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={e => setVin(e.target.value.toUpperCase())}
                placeholder="1HGBH41JXMN109186"
                maxLength={17}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVinDecode}
                disabled={vinDecoding || vin.length < 17}
                className="shrink-0 gap-1.5"
              >
                {vinDecoding
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5" />}
                Decode
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your 17-character VIN to auto-fill make, model, and year.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2022" maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Make</Label>
              <Input value={make} onChange={e => setMake(e.target.value)} placeholder="Ford" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Transit" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>License Plate</Label>
            <Input name="licensePlate" defaultValue={driver?.licensePlate ?? ''} placeholder="ABC-1234" />
          </div>

          {/* Vehicle photo */}
          <div className="space-y-2">
            <Label>Vehicle Photo</Label>
            {vehicleImageUrl ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-slate-100">
                <Image src={vehicleImageUrl} alt="Vehicle" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setVehicleImageUrl('')}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs rounded-md px-2 py-1 hover:bg-black/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-slate-100 border-slate-300' : 'hover:bg-slate-50 border-slate-300 hover:border-blue-400'}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <><Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" /><span className="text-sm text-slate-500">Uploading…</span></>
                ) : (
                  <><Camera className="w-6 h-6 text-slate-400 mb-2" /><span className="text-sm font-medium text-slate-600">Click to upload vehicle photo</span><span className="text-xs text-slate-400 mt-1">JPG, PNG or WebP · max 10MB</span></>
                )}
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending || uploading}>
        {pending ? 'Saving…' : 'Save Profile'}
      </Button>
    </form>
  )
}
