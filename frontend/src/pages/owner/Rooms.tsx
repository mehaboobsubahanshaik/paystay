import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/api/client'
import type { BoardRoomDto, CatalogDto, RoomStatus } from '@/api/types'
import { useLive } from '@/lib/live'
import { inr } from '@/lib/format'
import { ErrorBox, Seg, Spinner, useToast } from '@/components/ui'
import { Legend, RoomBoard } from '@/components/owner'
import { RoomSheet } from './Dashboard'

export default function Rooms({ catalog }: { catalog: CatalogDto }) {
  const toast = useToast()
  const [rooms, setRooms] = useState<BoardRoomDto[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [room, setRoom] = useState<BoardRoomDto | null>(null)
  const load = useCallback(() => api.owner.rooms().then(setRooms).catch((e) => setErr(errorMessage(e))), [])
  useEffect(() => { void load() }, [load])
  useLive(() => { void load() })
  async function setStatus(r: BoardRoomDto, status: RoomStatus) {
    try { const u = await api.owner.setRoomStatus(r.id, status); setRoom(u); toast(`Room ${r.number} marked ${status === 'Available' ? 'ready' : status.toLowerCase()}`); void load() } catch (e) { toast(errorMessage(e)) }
  }
  if (!rooms) return <>{err ? <ErrorBox msg={err} /> : <Spinner label="Loading rooms…" />}</>
  const n = (s: string) => (s === 'all' ? rooms.length : rooms.filter((r) => r.status === s).length)
  return (
    <>
      <div><h1>Rooms</h1><p className="text-ink-2 mt-1">All {rooms.length} rooms by floor. Tap a room to mark it cleaning, under maintenance or ready.</p></div>
      <section className="panel"><div className="flex justify-between items-center gap-3 flex-wrap">
        <Seg value={filter} onChange={setFilter} label="Show" options={[['all', 'All'], ['available', 'Available'], ['booked', 'Booked'], ['cleaning', 'Cleaning'], ['maintenance', 'Maintenance']].map(([v, l]) => ({ v, l: <>{l} <span className="font-mono text-ink-3">{n(v)}</span></> }))} /><Legend /></div>
        <RoomBoard rooms={rooms} filter={filter} onPick={setRoom} /></section>
      <section className="panel"><h2>Room types</h2><div className="overflow-x-auto -mx-5 px-5"><table className="tbl w-full text-sm border-collapse"><thead><tr><th>Type</th><th>Rooms</th><th className="text-right">Rate / night</th><th>Sleeps</th><th>Includes</th></tr></thead><tbody>
        {catalog.roomTypes.map((t) => <tr key={t.type}><td><b>{t.type}</b></td><td className="font-mono">{rooms.filter((r) => r.type === t.type).length}</td><td className="text-right font-mono">{inr(t.price)}</td><td>{t.capacity}</td><td className="text-ink-2">{t.amenities.join(', ')}</td></tr>)}
      </tbody></table></div></section>
      {room && <RoomSheet r={room} onClose={() => setRoom(null)} onStatus={setStatus} />}
    </>
  )
}
