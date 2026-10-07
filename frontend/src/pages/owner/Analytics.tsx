import { useEffect, useState } from 'react'
import { api, errorMessage } from '@/api/client'
import type { AnalyticsDto, CatalogDto } from '@/api/types'
import { useLive } from '@/lib/live'
import { inr } from '@/lib/format'
import { ErrorBox, Spinner } from '@/components/ui'
import { NightsChart } from '@/components/owner'

export default function Analytics({ catalog }: { catalog: CatalogDto }) {
  const [a, setA] = useState<AnalyticsDto | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = () => api.owner.analytics().then(setA).catch((e) => setErr(errorMessage(e)))
  useEffect(() => { void load() }, [])
  useLive(() => { void load() })
  if (!a) return <>{err ? <ErrorBox msg={err} /> : <Spinner label="Crunching the numbers…" />}</>
  const total = a.byType.reduce((s, t) => s + t.rooms, 0)
  const maxRev = Math.max(1, ...a.byType.map((t) => t.value))
  return (
    <>
      <div><h1>Analytics</h1><p className="text-ink-2 mt-1">Confirmed bookings across all dates.</p></div>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Booking value</span><span className="kpi-v !text-[1.7rem]">{inr(a.bookingValue)}</span><span className="text-ink-3 text-[13px]">{a.confirmed} confirmed bookings</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Avg. occupancy</span><span className="kpi-v">{Math.round(a.avgOccupancy14 * 100)}%</span><span className="text-ink-3 text-[13px]">next 14 nights</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Avg. stay</span><span className="kpi-v">{a.avgStay.toFixed(1)}</span><span className="text-ink-3 text-[13px]">nights per booking</span></div>
        <div className="kpi"><span className="text-[13px] font-bold text-ink-2">Cancellations</span><span className="kpi-v">{a.cancelled}</span><span className="text-ink-3 text-[13px]">{a.confirmed + a.cancelled ? Math.round((a.cancelled / (a.confirmed + a.cancelled)) * 100) : 0}% of all bookings</span></div>
      </section>
      <section className="panel"><div><h2>Rooms booked per night</h2><p className="text-ink-3 text-[13px]">Next 14 nights, out of {total} rooms</p></div><NightsChart data={a.next14Nights} max={total || 50} /></section>
      <section className="panel"><div><h2>Referrals</h2><p className="text-ink-3 text-[13px]">Codes earned by guests staying {catalog.referralMinNights}+ nights in a row; friends get {catalog.referralDiscountPercent}% off</p></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">{[[a.referralCodesIssued, 'codes issued'], [a.referredBookings, 'bookings with a code'], [inr(a.referralDiscount), 'discount given'], [inr(a.referredValue), 'referred booking value']].map(([v, l]) => <div key={String(l)} className="flex flex-col"><b className="font-serif font-normal text-xl tabular-nums">{v}</b><span className="text-[13px] text-ink-2">{l}</span></div>)}</div></section>
      <section className="panel"><h2>By room type</h2><div className="overflow-x-auto -mx-5 px-5"><table className="tbl w-full text-sm border-collapse"><thead><tr><th>Type</th><th className="text-right">Bookings</th><th className="text-right">Rooms</th><th>Booking value</th></tr></thead><tbody>
        {a.byType.map((t) => <tr key={t.type}><td><b>{t.type}</b></td><td className="text-right font-mono">{t.bookings}</td><td className="text-right font-mono">{t.rooms}</td><td><div className="flex items-center gap-2.5 min-w-[200px]"><div className="flex-1 h-2 rounded bg-surface-2"><div className="h-full rounded bg-ink" style={{ width: `${(t.value / maxRev) * 100}%` }} /></div><span className="font-mono min-w-[90px] text-right">{inr(t.value)}</span></div></td></tr>)}
      </tbody></table></div></section>
    </>
  )
}
