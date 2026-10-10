import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FieldHub } from '../../components/field/FieldHub'

function App() {
  const [data, setData] = useState(null)
  useEffect(() => {
    window.operatorRefresh = async () => setData(await fetch('/field-state').then(response => response.json()))
    window.operatorRefresh()
  }, [])
  return data ? <FieldHub bootstrap={data.bootstrap} availability={data.availability} /> : <p>Loading field tools…</p>
}
createRoot(document.getElementById('root')).render(<App />)
