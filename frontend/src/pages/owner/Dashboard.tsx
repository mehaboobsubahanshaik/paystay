import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '@/api/client'
import type { BoardRoomDto, DashboardDto, RoomStatus } from '@/api/types'
import { useLive } from '@/lib/live'
import { ago, fD, inr } from '@/lib/format'
import { Empty, ErrorBox, Sheet, Spinner, useToast } from '@/components/ui'
import { Legend, NightsChart, RequestCard, RoomBoard, STATUS_LABEL } from '@/components/owner'

export default function Dashboard() {
  const toast = useToast()
  const [d, setD] = useState<DashboardDto | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const [room, setRoom] = useState<BoardRoomDto | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => api.owner.dashboard().then((x) => { setD(x); setErr(null) }).catch((e) => setErr(errorMessage(e))), [])
  useEffect(() => { void load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])
  useLive((e) => { void load(); if (e.entity === 'booking' && e.action === 'created' && e.room) { setFlash(e.room); setTimeout(() => setFlash(null), 4000) } })

  async function sample(add: boolean) {
    setBusy(true)
    try { if (add) { const r = await api.owner.addSample(); toast(`${r.added} sample bookings added`) } else { await api.owner.removeSample(); toast('Sample data removed') } await load() }
    catch (e) { toast(errorMessage(e)) } finally { setBusy(false) }
  }
  async function setStatus(r: BoardRoomDto, status: RoomStatus) {
    try { const u = await api.owner.setRoomStatus(r.id, status); setRoom(u); toast(`Room ${r.number} marked ${status === 'Available' ? 'ready' : status.toLowerCase()}`); void load() } catch (e) { toast(errorMessage(e)) }
  }

  if (!d) return <>{err ? <ErrorBox msg={err} /> : <Spinner label="Loading the room board…" />}</>
  const tot = d.totalRooms || 1
  const segs: [string, number, string][] = [['booked', d.booked, 'bg-booked'], ['available', d.available, 'bg-avail'], ['cleaning', d.cleaning, 'bg-clean'], ['maintenance', d.maintenance, 'bg-maint']]
  return (
    <>
      <div className="flex justify-between items-end gap-4 flex-wrap"><div><div className="label">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Hotel dashboard</h1></div>
        <button className="btn btn-sm" disabled={busy} onClick={() => sample(!d.hasSampleData)}>{d.hasSampleData ? 'Remove sample data' : 'Load sample bookings'}</button></div>
      {d.feed.length === 0 && <Empty title="No bookings yet"><p className="text-ink-2 max-w-[52ch]">When a guest books, the room turns red on the board below and the booking appears in the live feed. To try it, open the app on another device, sign in as a guest and book a room. Or load a set of sample bookings.</p><button className="btn btn-primary" disabled={busy} onClick={() => sample(true)}>Load sample bookings</button></Empty>}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Rooms today">
        <div className="kpi"><span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2"><i className="w-[9px] h-[9px] rounded-[3px] bg-ink" />Total rooms</span><span className="kpi-v">{d.totalRooms}</span><span className="text-ink-3 text-[13px]">5 floors</span></div>
        <div className="kpi"><span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2"><i className="w-[9px] h-[9px] rounded-[3px] bg-booked" />Booked</span><span className="kpi-v">{d.booked}</span><span className="text-ink-3 text-[13px]">{Math.round((d.booked / tot) * 100)}% occupancy</span></div>
        <div className="kpi"><span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2"><i className="w-[9px] h-[9px] rounded-[3px] bg-avail" />Available</span><span className="kpi-v">{d.available}</span><span className="text-ink-3 text-[13px]">ready to sell tonight</span></div>
        <div className="kpi"><span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2"><i className="w-[9px] h-[9px] rounded-[3px] bg-clean" />Not ready</span><span className="kpi-v">{d.cleaning + d.maintenance}</span><span className="text-ink-3 text-[13px]">{d.cleaning} cleaning · {d.maintenance} maintenance</span></div>
      </section>
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-[18px] items-start">
        <section className="panel"><div className="flex justify-between items-center gap-3 flex-wrap"><div><h2>Room status</h2><p className="text-ink-3 text-[13px]">Tap a room to change its status or see the guest</p></div><Legend /></div><RoomBoard rooms={d.board} onPick={setRoom} flash={flash} /></section>
        <div className="flex flex-col gap-[18px] min-w-0">
          <section className="panel"><div className="flex justify-between items-center gap-3"><h2>Tonight</h2><span className="text-ink-3 text-[13px]">{d.arrivalsToday} arriving · {d.departuresToday} leaving</span></div>
            <div className="flex h-4 rounded-lg overflow-hidden gap-0.5 bg-surface" role="img" aria-label={`Booked ${d.booked}, available ${d.available}, cleaning ${d.cleaning}, maintenance ${d.maintenance}`}>{segs.filter((s) => s[1]).map(([k, v, c]) => <i key={k} className={c} style={{ width: `${(v / tot) * 100}%` }} />)}</div>
            <div className="grid grid-cols-2 gap-2.5">{segs.map(([k, v, c]) => <div key={k} className="flex flex-col"><b className="font-serif font-normal text-xl tabular-nums">{Math.round((v / tot) * 100)}%</b><span className="text-[13px] text-ink-2 flex items-center gap-1.5"><i className={`w-[9px] h-[9px] rounded-[3px] ${c}`} />{STATUS_LABEL[k]} · {v}</span></div>)}</div></section>
          <section className="panel"><div className="flex justify-between items-center gap-3"><h2>Guest requests</h2><span className={`pill ${d.openRequests.length ? 'bg-pop-soft text-pop' : 'bg-surface-2 text-ink-2'}`}>{d.openRequests.length ? `${d.newRequests} new` : 'none open'}</span></div>
            {d.openRequests.length ? <div className="flex flex-col gap-2.5">{d.openRequests.map((r) => <RequestCard key={r.id} r={r} onStatus={async (id, s) => { try { await api.owner.setRequestStatus(id, s); toast(s === 'Accepted' ? 'Guest notified' : 'Marked done'); void load() } catch (e) { toast(errorMessage(e)) } }} />)}</div> : <p className="text-ink-2 text-sm">Food orders, housekeeping and cab requests from rooms appear here.</p>}
            <Link className="btn btn-sm self-start" to="/owner/requests">All requests</Link></section>
          <section className="panel"><div className="flex justify-between items-center gap-3"><h2>Live bookings</h2></div>
            {d.feed.length ? <div className="flex flex-col">{d.feed.map((b) => <div key={b.id} className={`grid grid-cols-[40px_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-t border-line first:border-t-0 ${flash === b.roomNumber ? 'animate-pulse' : ''}`}><span className={`w-10 h-10 rounded-[10px] grid place-items-center font-mono font-semibold text-[13px] ${b.status === 'Cancelled' ? 'bg-surface-2 text-ink-3' : 'bg-booked-soft text-booked'}`}>{b.roomNumber}</span><div className="min-w-0"><div className="truncate"><b>{b.guestName}</b> {b.status === 'Cancelled' ? 'cancelled' : 'booked'} room {b.roomNumber}</div><div className="text-ink-3 text-[13px]">{fD(b.checkIn)} – {fD(b.checkOut)} · {inr(b.total)}</div></div><span className="text-ink-3 text-[13px] whitespace-nowrap">{ago(b.createdAt)}</span></div>)}</div> : <p className="text-ink-2 text-sm">New bookings appear here the moment a guest confirms.</p>}
            <Link className="btn btn-sm self-start" to="/owner/bookings">All bookings</Link></section>
        </div>
      </div>
      <section className="panel"><div><h2>Rooms booked per night</h2><p className="text-ink-3 text-[13px]">Next 7 nights, confirmed bookings</p></div><NightsChart data={d.next7Nights} max={d.totalRooms} /></section>
      {room && <RoomSheet r={room} onClose={() => setRoom(null)} onStatus={setStatus} />}
    </>
  )
}

export function RoomSheet({ r, onClose, onStatus }: { r: BoardRoomDto; onClose: () => void; onStatus: (r: BoardRoomDto, s: RoomStatus) => void }) {
  const stClass: Record<string, string> = { available: 'bg-avail-soft text-avail', booked: 'bg-booked-soft text-booked', cleaning: 'bg-clean-soft text-clean', maintenance: 'bg-maint-soft text-maint' }
  return (
    <Sheet eyebrow={`Floor ${r.floor} · ${r.type}`} title={`Room ${r.number}`} onClose={onClose}>
      <div><span className={`pill ${stClass[r.status]}`}>{STATUS_LABEL[r.status]}</span></div>
      {r.status === 'booked' && <div className="p-3.5 rounded-2xl bg-surface-2 flex flex-col gap-1"><span className="label">In house</span><b>{r.guestName}</b><span className="text-sm text-ink-2">Booking {r.bookingCode} · checks out {r.checkOut ? fD(r.checkOut) : ''}</span></div>}
      <div><h3 className="font-bold mb-2">Housekeeping status</h3>
        {r.status === 'booked' ? <p className="text-sm text-ink-2">Room is occupied until {r.checkOut ? fD(r.checkOut) : 'check-out'}. Change status after the guest checks out.</p>
          : <div className="seg" role="group" aria-label="Set status">{([['Available', 'Ready'], ['Cleaning', 'Cleaning'], ['Maintenance', 'Maintenance']] as [RoomStatus, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={r.status === k.toLowerCase()} onClick={() => onStatus(r, k)}>{l}</button>)}</div>}</div>
    </Sheet>
  )
}
