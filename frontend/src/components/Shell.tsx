import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { stopLive, useLive } from '@/lib/live'
import { Icon, useToast } from './ui'

const NAV = {
  Customer: [{ to: '/book', label: 'Stays', icon: 'bed' }, { to: '/trips', label: 'My trips', icon: 'ticket' }],
  Owner: [
    { to: '/owner', label: 'Dashboard', icon: 'grid', end: true }, { to: '/owner/rooms', label: 'Rooms', icon: 'door' },
    { to: '/owner/bookings', label: 'Bookings', icon: 'list' }, { to: '/owner/requests', label: 'Requests', icon: 'bell' },
    { to: '/owner/analytics', label: 'Analytics', icon: 'chart' },
  ],
}

/** Header + bottom tab bar shared by every signed-in page. Shows the live-sync dot and relays live events as toasts. */
export function Shell({ children, badge }: { children: ReactNode; badge?: number }) {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [live, setLive] = useState(false)
  useLive((e) => { if (e.message && (user?.role === 'Owner' || e.entity === 'request')) toast(e.message) }, setLive)
  if (!user) return null
  const items = NAV[user.role]
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const link = (i: (typeof items)[number], mobile: boolean) => (
    <NavLink key={i.to} to={i.to} end={'end' in i && i.end}
      className={({ isActive }) => mobile
        ? `relative flex-1 flex flex-col items-center gap-0.5 py-1.5 min-h-[52px] rounded-[10px] text-[11px] font-bold no-underline ${isActive ? 'text-ink bg-surface-2' : 'text-ink-3'}`
        : `flex items-center gap-2 px-3 h-[62px] font-bold text-sm border-b-2 no-underline ${isActive ? 'text-ink border-pop' : 'text-ink-2 border-transparent hover:text-ink'}`}>
      <Icon name={i.icon} size={mobile ? 22 : 18} />{i.label}
      {i.to === '/owner/requests' && !!badge && <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-booked text-white text-[11px] font-bold grid place-items-center max-sm:absolute max-sm:top-0.5 max-sm:left-[calc(50%+6px)]">{badge}</span>}
    </NavLink>
  )
  return (
    <>
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex items-center gap-3 sm:gap-5 min-h-[62px]">
          <a href={items[0].to} className="flex items-center gap-2 font-serif text-[1.4rem] text-ink no-underline"><span className="w-[30px] h-[30px] rounded-lg bg-pop text-[#1A1306] grid place-items-center text-[15px] font-bold font-sans">P</span>PayStay</a>
          <nav className="hidden sm:flex gap-1 h-[62px]" aria-label="Main">{items.map((i) => link(i, false))}</nav>
          <div className="ml-auto flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${live ? 'text-avail' : 'text-ink-3'}`} title={live ? 'Live updates connected' : 'Connecting to live updates'}>
              <i className={`w-2 h-2 rounded-full ${live ? 'bg-avail animate-pulse' : 'bg-ink-3'}`} /><span className="hidden sm:inline">{live ? 'Live' : 'Offline'}</span>
            </span>
            <div className="flex items-center gap-2.5">
              <span className="w-[34px] h-[34px] rounded-full bg-surface-2 grid place-items-center font-bold text-[13px]">{initials}</span>
              <span className="hidden sm:flex flex-col leading-tight"><b>{user.name || 'Guest'}</b><small className="text-ink-3 text-xs">{user.role === 'Owner' ? 'Owner' : 'Guest'} · ••••{user.mobileLast4}</small></span>
            </div>
            <button className="btn btn-sm border-transparent bg-transparent" onClick={() => { stopLive(); signOut(); nav('/login') }} aria-label="Sign out" title="Sign out"><Icon name="out" /></button>
          </div>
        </div>
      </header>
      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:pb-16 flex flex-col gap-5">{children}</main>
      <nav className="sm:hidden fixed left-0 right-0 bottom-0 z-30 bg-surface border-t border-line px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] flex" aria-label="Main">{items.map((i) => link(i, true))}</nav>
    </>
  )
}
