import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '@/api/client'
import type { BookingDto, CatalogDto, MyReferralDto } from '@/api/types'
import { useAuth } from '@/lib/auth'
import { useLive } from '@/lib/live'
import { arrivalText, fDow, fTime, inr, stageClass, stageLabel, todayIso } from '@/lib/format'
import { Empty, ErrorBox, Icon, Sheet, Skyline, Spinner, TravelPartners, copyText, useToast } from '@/components/ui'
import { TourSection } from '@/components/Tour'
import { RoomServices } from './RoomServices'

const SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

export default function Trips({ catalog }: { catalog: CatalogDto }) {
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState<BookingDto[] | null>(null)
  const [codes, setCodes] = useState<MyReferralDto[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [stay, setStay] = useState<{ b: BookingDto; tab?: 'tour'; pack?: 'person' | 'family' } | null>(null)
  const [cancelAsk, setCancelAsk] = useState<string | null>(null)
  const [arrEdit, setArrEdit] = useState<BookingDto | null>(null)

  const load = useCallback(() => Promise.all([api.customer.bookings(), api.customer.referrals()]).then(([b, c]) => { setList(b); setCodes(c) }).catch((e) => setErr(errorMessage(e))), [])
  useEffect(() => { void load() }, [load])
  useLive(() => { void load() })

  const first = user?.name.split(' ')[0] ?? ''
  const up = (list ?? []).filter((b) => b.stage === 'upcoming' || b.stage === 'staying')
  const past = (list ?? []).filter((b) => !up.includes(b)).reverse()
  const next = up[0]
  const liveForTour = up[0]

  const card = (b: BookingDto) => {
    const live = b.stage === 'staying' || b.stage === 'upcoming'
    const earned = b.status === 'Confirmed' && b.nights >= catalog.referralMinNights && codes.length > 0
    return (
      <article key={b.id} className={`relative grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] bg-surface border border-line rounded-[18px] overflow-hidden ${live ? '' : 'opacity-90'}`}>
        <div className={`text-white p-3.5 sm:p-[18px] flex flex-col justify-between gap-3 border-r-2 border-dashed border-white/50 ${live ? '' : 'grayscale-[.75] opacity-75'}`} style={{ background: 'linear-gradient(165deg,#0C1E3B,#244B85 70%,#E8813A)' }}>
          <div><small className="text-[11px] tracking-[.1em] uppercase opacity-80 font-bold">Room</small><div className="font-mono text-[1.3rem] sm:text-[1.75rem] font-semibold leading-none">{b.roomNumber}</div></div>
          <div><small className="text-[11px] tracking-[.1em] uppercase opacity-80 font-bold">{b.roomType}</small><div className="text-[13px] opacity-85">Floor {b.floor}</div></div>
        </div>
        <div className="p-4 flex flex-col gap-3 min-w-0">
          <div className="flex justify-between items-start gap-2.5"><div><div className="eyebrow !text-pop">Hyderabad</div><b className="font-serif font-normal text-xl">{catalog.hotelName}</b></div><span className={`pill ${stageClass[b.stage]}`}>{stageLabel[b.stage]}</span></div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-center p-3 rounded-[10px] bg-surface-2">
            <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-in</span><b className="font-serif font-normal">{fDow(b.checkIn)}</b><span className="text-ink-3 text-[13px]">{arrivalText(b.arrivalTime)}</span></div><span className="text-ink-3">→</span>
            <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-out</span><b className="font-serif font-normal">{fDow(b.checkOut)}</b><span className="text-ink-3 text-[13px]">by 11 AM</span></div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-3"><span className="text-ink-2">{b.nights} night{b.nights > 1 ? 's' : ''} · {b.guests} guest{b.guests > 1 ? 's' : ''}</span><b className="font-mono">{inr(b.total)}</b></div>
            <div className="flex justify-between gap-3"><span className="text-ink-2">Booking ID</span><span className="font-mono">{b.code}</span></div>
            {b.referralCode && <div className="flex justify-between gap-3"><span className="text-ink-2">Referral applied</span><span className="font-mono">{b.referralCode}</span></div>}
          </div>
          {earned && <div className="nudge"><Icon name="gift" className="text-pop shrink-0" /><span>Referral code earned with this stay</span></div>}
          {live && <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={() => setStay({ b })}><Icon name="bell" size={16} />Room services{b.openRequests ? <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-booked text-white text-[11px] grid place-items-center">{b.openRequests}</span> : null}</button>
            {(b.stage === 'upcoming' || b.checkIn === todayIso()) && <button className="btn btn-sm" onClick={() => setArrEdit(b)}>Change arrival time</button>}
            {b.stage === 'upcoming' && cancelAsk !== b.id && <button className="btn btn-sm" onClick={() => setCancelAsk(b.id)}>Cancel</button>}
          </div>}
          {b.stage === 'upcoming' && cancelAsk === b.id && <div className="flex flex-col gap-2.5 p-3 rounded-[10px] bg-booked-soft"><b>Cancel this booking?</b><span className="text-sm">Room {b.roomNumber} will be released to other guests.</span><div className="flex gap-2 flex-wrap"><button className="btn btn-sm btn-danger" onClick={async () => { try { await api.customer.cancel(b.id); setCancelAsk(null); toast('Booking cancelled. The room is open for other guests.'); void load() } catch (e) { toast(errorMessage(e)) } }}>Yes, cancel it</button><button className="btn btn-sm" onClick={() => setCancelAsk(null)}>Keep booking</button></div></div>}
        </div>
      </article>
    )
  }

  return (
    <>
      <section className="hero p-[22px] pb-24 sm:p-8 sm:pb-24"><Skyline className="absolute left-0 right-0 bottom-0 w-full h-[110px] -z-10" /><div className="eyebrow">My trips</div>
        <h1 className="text-[2rem] sm:text-[2.6rem] mt-2">{next ? `${next.stage === 'staying' ? 'Enjoy your stay' : 'See you on ' + fDow(next.checkIn)}, ${first}` : `Where to next, ${first}?`}</h1>
        <p className="opacity-85 max-w-[54ch] mt-2.5">{next ? `Room ${next.roomNumber} · ${next.nights} night${next.nights > 1 ? 's' : ''} in Hyderabad. Order food, ask for housekeeping or book an airport cab from your trip.` : 'Book a stay in Hyderabad and plan the journey from here.'}</p></section>
      <ErrorBox msg={err} />
      {codes.length > 0 ? (
        <section className="flex gap-4 items-center flex-wrap p-[18px] rounded-[18px] bg-pop-soft border-[1.5px] border-dashed border-pop"><Icon name="gift" size={28} />
          <div className="flex-1 min-w-[220px]"><h2>Your referral code{codes.length > 1 ? 's' : ''}</h2><p className="text-sm text-ink-2">You earned {codes.length > 1 ? 'these' : 'this'} by booking {catalog.referralMinNights} or more nights in a row. Friends get {catalog.referralDiscountPercent}% off their room charges when they enter it at checkout.</p></div>
          <div className="flex flex-col gap-2">{codes.map((c) => <div key={c.code} className="flex gap-2 items-center flex-wrap"><span className="font-mono text-lg font-semibold tracking-[.14em] px-3.5 py-2 rounded-[10px] bg-surface border border-line select-all">{c.code}</span><button className="btn btn-sm" onClick={() => copyText(c.code, toast)}>Copy</button><span className="text-ink-3 text-[13px]">{c.uses} use{c.uses === 1 ? '' : 's'}</span></div>)}</div>
        </section>
      ) : list?.length ? <div className="nudge"><Icon name="gift" className="text-pop shrink-0" /><span>Book {catalog.referralMinNights} or more nights in a row to earn a referral code. Friends get {catalog.referralDiscountPercent}% off with it.</span></div> : null}
      {!list ? <Spinner label="Finding your trips…" /> : list.length ? (
        <>
          <section className="flex flex-col gap-3.5"><div className="flex justify-between items-center gap-3 flex-wrap"><h2>Upcoming and current</h2><Link className="btn btn-sm" to="/book">Book another stay</Link></div>{up.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">{up.map(card)}</div> : <p className="text-ink-2">Nothing coming up.</p>}</section>
          {past.length > 0 && <section className="flex flex-col gap-3.5"><h2>Past and cancelled</h2><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">{past.map(card)}</div></section>}
        </>
      ) : <Empty title="No trips yet"><p className="text-ink-2 max-w-[46ch]">Stays you book with this mobile number appear here as tickets. Open one to order food, ask for housekeeping or book a cab.</p><Link className="btn btn-primary" to="/book">Find a room</Link></Empty>}
      <TourSection tour={catalog.tour} onPick={(pack) => liveForTour ? setStay({ b: liveForTour, tab: 'tour', pack }) : toast('Book a room first, then add the tour to your stay.')} hint={liveForTour ? `Room ${liveForTour.roomNumber} · ${fDow(liveForTour.checkIn)} – ${fDow(liveForTour.checkOut)}` : 'Book a room first, then add the tour from here.'} />
      <section className="flex flex-col gap-3.5"><div><h2>Getting to Hyderabad</h2><p className="text-ink-2 text-sm">Book your flight, train or cab with these services. They open in a new tab.</p></div><TravelPartners date={next?.checkIn ?? todayIso()} /></section>
      {stay && <RoomServices booking={stay.b} catalog={catalog} initialTab={stay.tab} initialPack={stay.pack} onClose={() => { setStay(null); void load() }} />}
      {arrEdit && <ArrivalSheet b={arrEdit} onClose={() => setArrEdit(null)} onSaved={() => { setArrEdit(null); void load() }} />}
    </>
  )
}

function ArrivalSheet({ b, onClose, onSaved }: { b: BookingDto; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState(b.arrivalTime ?? 'flex')
  const [busy, setBusy] = useState(false)
  const isToday = b.checkIn === todayIso(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes()
  const opts = SLOTS.filter((t) => { const [h, m] = t.split(':').map(Number); return !isToday || h * 60 + m > nowMin })
  return (
    <Sheet eyebrow={`Room ${b.roomNumber} · ${fDow(b.checkIn)}`} title="Change arrival time" onClose={onClose}>
      <p className="text-ink-2">Arrive any time. Early check-in depends on room readiness; the front desk is open 24 hours.</p>
      <div className="flex flex-col gap-1.5"><label htmlFor="arrSel" className="field-label">Arrival time on {fDow(b.checkIn)}</label>
        <select id="arrSel" className="input" value={v} onChange={(e) => setV(e.target.value)}>
          <optgroup label="Early check-in · on request">{opts.filter((t) => +t.slice(0, 2) < 12).map((t) => <option key={t} value={t}>{fTime(t)}</option>)}</optgroup>
          <optgroup label="Standard check-in">{opts.filter((t) => +t.slice(0, 2) >= 12 && +t.slice(0, 2) < 21).map((t) => <option key={t} value={t}>{fTime(t)}</option>)}</optgroup>
          <optgroup label="Late arrival · desk open 24 hours">{opts.filter((t) => +t.slice(0, 2) >= 21).map((t) => <option key={t} value={t}>{fTime(t)}</option>)}</optgroup>
          <option value="flex">Not sure yet, I'll tell you later</option>
        </select></div>
      <button className="btn btn-primary w-full" disabled={busy} onClick={async () => { setBusy(true); try { await api.customer.setArrival(b.id, v === 'flex' ? null : v); toast(v === 'flex' ? 'Arrival time set to flexible' : `Arrival updated to ${fTime(v)}`); onSaved() } catch (e) { toast(errorMessage(e)); setBusy(false) } }}>Save arrival time</button>
    </Sheet>
  )
}
