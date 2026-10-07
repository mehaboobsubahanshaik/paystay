import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/api/client'
import type { ServiceRequestDto } from '@/api/types'
import { useLive } from '@/lib/live'
import { Empty, ErrorBox, Seg, Spinner, useToast } from '@/components/ui'
import { RequestCard } from '@/components/owner'

export default function Requests() {
  const toast = useToast()
  const [filter, setFilter] = useState('open')
  const [list, setList] = useState<ServiceRequestDto[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => api.owner.requests(filter).then(setList).catch((e) => setErr(errorMessage(e))), [filter])
  useEffect(() => { void load() }, [load])
  useLive(() => { void load() })
  const open = (list ?? []).filter((r) => r.status === 'New' || r.status === 'Accepted')
  const by = (k: string) => open.filter((r) => r.kind === k).length
  return (
    <>
      <div><h1>Guest requests</h1><p className="text-ink-2 mt-1">Housekeeping, food orders, cab bookings and tours from guests in their rooms. Guests see each status change live.</p></div>
      {filter === 'open' && list && <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Open</span><span className="kpi-v">{open.length}</span><span className="text-ink-3 text-[13px]">{open.filter((r) => r.status === 'New').length} waiting for a reply</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Housekeeping</span><span className="kpi-v">{by('Housekeeping')}</span><span className="text-ink-3 text-[13px]">open</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Dining</span><span className="kpi-v">{by('Dining')}</span><span className="text-ink-3 text-[13px]">open orders</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Tours and cabs</span><span className="kpi-v">{by('Tour') + by('Cab')}</span><span className="text-ink-3 text-[13px]">{by('Tour')} tour{by('Tour') === 1 ? '' : 's'} · {by('Cab')} ride{by('Cab') === 1 ? '' : 's'}</span></div>
      </section>}
      <Seg value={filter} onChange={setFilter} label="Filter requests" options={[['open', 'Open'], ['done', 'Done'], ['all', 'All']].map(([v, l]) => ({ v, l }))} />
      <ErrorBox msg={err} />
      {!list ? <Spinner label="Loading requests…" /> : list.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3.5">{list.map((r) => <RequestCard key={r.id} r={r} onStatus={async (id, s) => { try { await api.owner.setRequestStatus(id, s); toast(s === 'Accepted' ? 'Guest notified' : 'Marked done'); void load() } catch (e) { toast(errorMessage(e)) } }} />)}</div>
        : <Empty title={filter === 'open' ? 'All caught up' : 'Nothing here yet'}><p className="text-ink-2">When a guest orders food, asks for cleaning or books a cab or tour from their trip, it appears here instantly.</p></Empty>}
    </>
  )
}
