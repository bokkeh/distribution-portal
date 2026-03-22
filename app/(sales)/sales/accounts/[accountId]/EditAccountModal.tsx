'use client'

import { useActionState, useEffect, useRef } from 'react'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import { updateAccountBySalesRep } from '@/actions/crm'
import { Pencil, X, Loader2, CheckCircle2 } from 'lucide-react'
import type { CustomerAccount } from '@/db/schema/customers'

type Props = { account: CustomerAccount }

export function EditAccountModal({ account }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, action, pending] = useActionState(updateAccountBySalesRep, null)

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => dialogRef.current?.close(), 1000)
    }
  }, [state])

  function open() { dialogRef.current?.showModal() }
  function close() { dialogRef.current?.close() }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40"
        style={{ margin: 'auto' }}
        onClick={e => { if (e.target === dialogRef.current) close() }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Edit Account — {account.companyName}</h2>
          <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form action={action} className="overflow-y-auto max-h-[70vh]">
          <input type="hidden" name="id" value={account.id} />

          <div className="px-6 py-5 space-y-6">
            {/* Business info */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Business Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Company Name *" name="companyName" defaultValue={account.companyName} required />
                <Field label="Contact Name" name="contactName" defaultValue={account.contactName ?? ''} />
                <Field label="Phone" name="phone" defaultValue={account.phone ?? ''} type="tel" />
                <Field label="Email" name="email" defaultValue={account.email ?? ''} type="email" />
                <SelectField label="Business Type" name="businessType" defaultValue={account.businessType ?? ''} options={BUSINESS_TYPES} />
                <Field label="DC ABRA Number" name="dcAbraNumber" defaultValue={account.dcAbraNumber ?? ''} />
              </div>
            </section>

            {/* Address */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Street Address</label>
                    <AddressAutocomplete
                      name="address"
                      defaultValue={account.address ?? ''}
                      placeholder="123 Main St — start typing to search"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>
                <Field label="City" name="city" defaultValue={account.city ?? ''} />
                <Field label="State" name="state" defaultValue={account.state ?? ''} />
                <Field label="ZIP" name="zip" defaultValue={account.zip ?? ''} />
              </div>
            </section>

            {/* Point of Contact */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Point of Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="POC Name" name="pocName" defaultValue={account.pocName ?? ''} />
                <Field label="POC Phone" name="pocPhone" defaultValue={account.pocPhone ?? ''} type="tel" />
                <div className="sm:col-span-2">
                  <Field label="POC Email" name="pocEmail" defaultValue={account.pocEmail ?? ''} type="email" />
                </div>
              </div>
            </section>

            {/* Liquor License */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Liquor License</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="License Number" name="liquorLicenseNumber" defaultValue={account.liquorLicenseNumber ?? ''} />
                <Field label="License State" name="liquorLicenseState" defaultValue={account.liquorLicenseState ?? ''} />
                <div className="sm:col-span-2">
                  <Field label="Expiration Date" name="liquorLicenseExpiration" defaultValue={account.liquorLicenseExpiration ?? ''} placeholder="MM/DD/YYYY" />
                </div>
              </div>
            </section>

            {/* Delivery preferences */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Delivery Preferences</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Hours of Operation" name="hoursOfOperation" defaultValue={account.hoursOfOperation ?? ''} />
                <Field label="Preferred Delivery Days" name="preferredDeliveryDays" defaultValue={account.preferredDeliveryDays ?? ''} />
                <div className="sm:col-span-2">
                  <Field label="Preferred Delivery Times" name="preferredDeliveryTimes" defaultValue={account.preferredDeliveryTimes ?? ''} />
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between border-t px-6 py-4">
            {state?.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
            {state?.success && (
              <p className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </p>
            )}
            {!state?.error && !state?.success && <span />}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  )
}

const BUSINESS_TYPES = [
  'Liquor Store',
  'Restaurant',
  'Restaurant Group',
  'Hotel',
  'Hotel Group',
  'Venue',
  'Bar',
  'Night Club',
  'Grocery Store',
  'Convenience Store',
  'Country Club',
  'Casino',
  'Wholesaler',
  'Other',
]

function Field({
  label, name, defaultValue, type = 'text', required = false, placeholder,
}: {
  label: string; name: string; defaultValue: string; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
      />
    </div>
  )
}

function SelectField({
  label, name, defaultValue, options,
}: {
  label: string; name: string; defaultValue: string; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
      >
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
