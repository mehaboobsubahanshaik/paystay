import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/api/client'
import type { BookingDto } from '@/api/types'
import { useLive } from '@/lib/live'
import { ago, fD, fTime, inr, stageClass, stageLabel } from '@/lib/format'
import { ErrorBox, Seg, Spinner, useToast } from '@/components/ui'

export default function Bookings() {
  const toast = useToast()
  const [stage, setStage] = useState('all')
  const [q, setQ] = useState('')
  const [list, setList] = useState<BookingDto[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ask, setAsk] = useState<string | null>(null)
  const load = useCallback(() => api.owner.bookings(stage, q).then(setList).catch((e) => setErr(errorMessage(e))), [stage, q])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useLive(() => { void load() })
  return (
    <>
      <div><h1>Bookings</h1><p className="text-ink-2 mt-1">Every booking guests make, newest first.</p></div>
      <section className="panel">
        <div className="flex justify-between items-center gap-3 flex-wrap"><input className="input max-w-[300px]" type="search" placeholder="Search guest, room, ID or last 4 digits" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
          <Seg value={stage} onChange={setStage} label="Filter" options={[['all', 'All'], ['staying', 'In house'], ['upcoming', 'Upcoming'], ['cancelled', 'Cancelled']].map(([v, l]) => ({ v, l }))} /></div>
        <ErrorBox msg={err} />
        {!list ? <Spinner label="Loading bookings…" /> : (
          <div className="overflow-x-auto -mx-5 px-5"><table className="tbl w-full text-sm border-collapse"><thead><tr><th>Guest</th><th>Room</th><th>Stay</th><th>Status</th><th className="text-right">Amount</th><th>Booked</th><th></th></tr></thead><tbody>
            {list.length ? list.map((b) => (
              <tr key={b.id}><td><b>{b.guestName}</b><div className="text-ink-3 text-[13px] font-mono">••••{b.mobileLast4} · {b.code}</div></td><td><b className="font-mono">{b.roomNumber}</b><div className="text-ink-3 text-[13px]">{b.roomType}</div></td>
                <td className="whitespace-nowrap">{fD(b.checkIn)} – {fD(b.checkOut)}<div className="text-ink-3 text-[13px]">{b.nights} night{b.nights > 1 ? 's' : ''}{b.arrivalTime ? ` · arr. ${fTime(b.arrivalTime)}` : ' · arrival not fixed'}</div></td>
                <td><span className={`pill ${stageClass[b.stage]}`}>{stageLabel[b.stage]}</span></td><td className="text-right font-mono">{inr(b.total)}</td><td className="text-ink-3 text-[13px] whitespace-nowrap">{ago(b.createdAt)}</td>
                <td className="text-right">{b.stage === 'upcoming' && (ask === b.id ? <span className="inline-flex gap-1.5"><button className="btn btn-sm btn-danger" onClick={async () => { try { await api.owner.cancelBooking(b.id); setAsk(null); toast('Booking cancelled'); void load() } catch (e) { toast(errorMessage(e)) } }}>Confirm</button><button className="btn btn-sm" onClick={() => setAsk(null)}>Keep</button></span> : <button className="btn btn-sm" onClick={() => setAsk(b.id)}>Cancel</button>)}</td></tr>
            )) : <tr><td colSpan={7} className="text-center text-ink-3 py-8">{q || stage !== 'all' ? 'No bookings match this search or filter.' : 'No bookings yet. They appear here as soon as guests book.'}</td></tr>}
          </tbody></table></div>
        )}
      </section>
    </>
  )
}
