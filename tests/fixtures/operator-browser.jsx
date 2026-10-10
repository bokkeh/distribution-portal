import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QuickScheduleTasting } from '../../components/tastings/QuickScheduleTasting'
import { UpcomingTastingsList } from '../../components/tastings/TastingsPlanner'
import { AddressAutocomplete } from '../../components/shared/AddressAutocomplete'

function App() {
  const [data, setData] = useState(null)
  useEffect(() => {
    window.operatorRefresh = async () => setData(await fetch('/state').then(response => response.json()))
    window.operatorRefresh()
  }, [])
  if (!data) return <p>Loading test venue…</p>
  return <main className="mx-auto max-w-6xl space-y-6 p-4">
    <div className="mx-auto max-w-xl rounded-xl border bg-white p-4"><QuickScheduleTasting accounts={data.accounts} members={data.members} date="2030-11-06" /></div>
    <UpcomingTastingsList mode="admin" tastings={data.tastings} tasters={data.members} />
    <form aria-label="Address regression" className="max-w-xl space-y-3">
      <label htmlFor="address">Street address</label><AddressAutocomplete id="address" name="address" className="h-11 w-full border px-3 text-base" />
      <label htmlFor="city">City</label><input id="city" name="city" className="h-11 w-full border px-3" />
      <label htmlFor="state">State</label><input id="state" name="state" className="h-11 w-full border px-3" />
      <label htmlFor="zip">ZIP</label><input id="zip" name="zip" className="h-11 w-full border px-3" />
      <button type="button">Next field</button>
    </form>
  </main>
}
createRoot(document.getElementById('root')).render(<App />)
