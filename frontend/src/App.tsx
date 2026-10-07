import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { api, errorMessage } from '@/api/client'
import type { CatalogDto, Role } from '@/api/types'
import { AuthProvider, useAuth } from '@/lib/auth'
import { useLive } from '@/lib/live'
import { ErrorBox, Spinner, ToastProvider } from '@/components/ui'
import { Shell } from '@/components/Shell'
import Login from '@/pages/Login'
import Book from '@/pages/guest/Book'
import Trips from '@/pages/guest/Trips'
import Dashboard from '@/pages/owner/Dashboard'
import Rooms from '@/pages/owner/Rooms'
import Bookings from '@/pages/owner/Bookings'
import Requests from '@/pages/owner/Requests'
import Analytics from '@/pages/owner/Analytics'

/** Pages for one role. Anyone else is sent to their own home or to login. */
function RoleArea({ role, catalog }: { role: Role; catalog: CatalogDto }) {
  const { user } = useAuth()
  const [badge, setBadge] = useState(0)
  useEffect(() => { if (user?.role === 'Owner') api.owner.requests('open').then((r) => setBadge(r.filter((x) => x.status === 'New').length)).catch(() => {}) }, [user])
  useLive((e) => { if (user?.role === 'Owner' && e.entity === 'request') api.owner.requests('open').then((r) => setBadge(r.filter((x) => x.status === 'New').length)).catch(() => {}) })
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={user.role === 'Owner' ? '/owner' : '/book'} replace />
  if (user.role === 'Customer' && !user.name) return <Navigate to="/login" replace />
  return <Shell badge={badge}><Outlet context={catalog} /></Shell>
}

function Routed() {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState<CatalogDto | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api.catalog().then(setCatalog).catch((e) => setErr(errorMessage(e))) }, [])
  if (err) return <div className="p-8 max-w-md mx-auto"><h1>PayStay can't reach the API</h1><ErrorBox msg={err} /><p className="text-ink-2 mt-3 text-sm">Start the backend (see README) and reload this page.</p></div>
  if (!catalog) return <Spinner label="Getting the hotel ready…" full />
  const home = user ? (user.role === 'Owner' ? '/owner' : '/book') : '/login'
  return (
    <Routes>
      <Route path="/login" element={user && user.name ? <Navigate to={home} replace /> : <Login />} />
      <Route element={<RoleArea role="Customer" catalog={catalog} />}>
        <Route path="/book" element={<Book catalog={catalog} />} />
        <Route path="/trips" element={<Trips catalog={catalog} />} />
      </Route>
      <Route element={<RoleArea role="Owner" catalog={catalog} />}>
        <Route path="/owner" element={<Dashboard />} />
        <Route path="/owner/rooms" element={<Rooms catalog={catalog} />} />
        <Route path="/owner/bookings" element={<Bookings />} />
        <Route path="/owner/requests" element={<Requests />} />
        <Route path="/owner/analytics" element={<Analytics catalog={catalog} />} />
      </Route>
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><ToastProvider><Routed /></ToastProvider></AuthProvider></BrowserRouter>
}
