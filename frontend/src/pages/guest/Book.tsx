import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '@/api/client'
import type { BookingDto, CatalogDto, CreateBookingResult, RoomDto, RoomType } from '@/api/types'
import { useAuth } from '@/lib/auth'
import { addDays, arrivalText, fD, fDow, fTime, gstRate, inr, todayIso } from '@/lib/format'
import { Empty, ErrorBox, Icon, Seg, Sheet, Skyline, Spinner, Stepper, TravelPartners, copyText, useToast } from '@/components/ui'
import { TourSection } from '@/components/Tour'
import { RoomServices } from './RoomServices'

const SLOT_GROUPS: [string, number, number][] = [['Early check-in · on request', 0, 11 * 60 + 30], ['Standard check-in', 12 * 60, 20 * 60 + 30], ['Late arrival · desk open 24 hours', 21 * 60, 23 * 60 + 30]]
function slots(checkIn: string) {
  const all: string[] = []
  for (let m = 0; m < 24 * 60; m += 30) all.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  if (checkIn !== todayIso()) return all
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes()
  return all.filter((t) => { const [h, mm] = t.split(':').map(Number); return h * 60 + mm > now })
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function arrivalNote(t: string) {
  if (t === 'flex') return "No problem. Update it from My trips any time before you arrive."
  const h = +t.split(':')[0]
  if (h < 12) return 'Early check-in depends on room readiness. We hold your luggage if the room is not ready.'
  if (h >= 21) return 'Late arrival is fine. The front desk is open 24 hours and your room is held all night.'
  return ''
}

export default function Book({ catalog }: { catalog: CatalogDto }) {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [q, setQ] = useState({ checkIn: todayIso(), time: '14:00', nights: 1, guests: 2, rooms: 1, type: 'All' as RoomType | 'All' })
  const [rooms, setRooms] = useState<RoomDto[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [sel, setSel] = useState<number[]>([])
  const [showAll, setShowAll] = useState(false)
  const [review, setReview] = useState(false)
  const [done, setDone] = useState<CreateBookingResult | null>(null)
  const [tourFor, setTourFor] = useState<{ booking: BookingDto; pack: 'person' | 'family' } | null>(null)

  // keep the search sane: arrival time must be a real slot, guests between rooms and 4 per room
  const slotList = useMemo(() => slots(q.checkIn), [q.checkIn])
  useEffect(() => {
    setQ((s) => {
      const n = { ...s }
      if (n.checkIn < todayIso()) n.checkIn = todayIso()
      if (!slotList.length && n.checkIn === todayIso()) n.checkIn = addDays(todayIso(), 1)
      if (n.time !== 'flex' && !slotList.includes(n.time)) n.time = slotList.find((t) => toMin(t) >= 12 * 60) ?? slotList[0] ?? 'flex'
      n.guests = Math.min(n.rooms * 4, Math.max(n.rooms, n.guests))
      return JSON.stringify(n) === JSON.stringify(s) ? s : n
    })
  }, [slotList, q.rooms])

  useEffect(() => {
    let alive = true
    setRooms(null); setLoadErr(null)
    api.customer.available({ checkIn: q.checkIn, nights: q.nights, guests: q.guests, rooms: q.rooms, type: q.type === 'All' ? null : q.type })
      .then((r) => { if (alive) { setRooms(r); setSel((s) => s.filter((id) => r.some((x) => x.id === id)).slice(0, q.rooms)) } })
      .catch((e) => { if (alive) setLoadErr(errorMessage(e)) })
    return () => { alive = false }
  }, [q.checkIn, q.nights, q.guests, q.rooms, q.type])

  const checkOut = addDays(q.checkIn, q.nights)
  const per = Math.ceil(q.guests / q.rooms)
  const list = rooms ?? []
  const selected = sel.map((id) => list.find((r) => r.id === id)!).filter(Boolean)
  const total = selected.reduce((a, r) => a + r.price * q.nights * (1 + gstRate(r.price)), 0)
  const need = q.rooms - selected.length

  function pick(id: number) {
    if (sel.includes(id)) setSel(sel.filter((x) => x !== id))
    else if (sel.length < q.rooms) setSel([...sel, id])
    else if (q.rooms === 1) setSel([id])
    else toast(`You chose ${q.rooms} rooms. Deselect one, or add a room with the Rooms + button.`)
  }

  if (done) {
    const b = done.bookings[0], all = done.bookings, sum = all.reduce((a, x) => a + x.total, 0)
    return (
      <>
        <div className="panel items-center text-center p-10 max-w-[560px] mx-auto w-full">
          <div className="w-14 h-14 rounded-full bg-avail-soft text-avail grid place-items-center"><Icon name="check" size={28} /></div>
          <h1>{all.length > 1 ? `Rooms ${all.map((x) => x.roomNumber).join(', ')} are yours` : `Room ${b.roomNumber} is yours`}</h1>
          <p className="text-ink-2">{fDow(b.checkIn)}, {arrivalText(b.arrivalTime)} · until {fDow(b.checkOut)}, 11 AM · {b.nights} night{b.nights > 1 ? 's' : ''}</p>
          <p className="text-ink-2"><b className="text-ink">{inr(sum)}</b> to pay at the hotel</p>
          <p className="font-mono text-ink-3 text-[13px]">{all.map((x) => x.code).join(' · ')}</p>
          <p className="text-sm text-ink-2">The front desk can already see {all.length > 1 ? 'these rooms' : 'this booking'} on their room board.</p>
          <div className="flex gap-2.5 flex-wrap justify-center"><button className="btn btn-primary" onClick={() => nav('/trips')}>Go to my trip</button><button className="btn" onClick={() => { setDone(null); setSel([]) }}>Book another stay</button></div>
        </div>
        {done.earnedReferralCode && (
          <section className="flex gap-4 items-center flex-wrap p-[18px] rounded-[18px] bg-pop-soft border-[1.5px] border-dashed border-pop">
            <Icon name="gift" size={28} />
            <div className="flex-1 min-w-[220px]"><h2>You earned a referral code</h2><p className="text-sm text-ink-2">For booking {b.nights} nights in a row. Share it: friends get {catalog.referralDiscountPercent}% off their room charges.</p></div>
            <div className="flex gap-2 items-center"><span className="font-mono text-lg font-semibold tracking-[.14em] px-3.5 py-2 rounded-[10px] bg-surface border border-line select-all">{done.earnedReferralCode}</span><button className="btn btn-sm" onClick={() => copyText(done.earnedReferralCode!, toast)}>Copy</button></div>
          </section>
        )}
        <TourSection tour={catalog.tour} onPick={(pack) => setTourFor({ booking: b, pack })} />
        <section className="flex flex-col gap-3.5"><div><h2>Plan the journey</h2><p className="text-ink-2 text-sm">Flights, trains and cabs for {fDow(b.checkIn)}. These open in a new tab.</p></div><TravelPartners date={b.checkIn} /></section>
        {tourFor && <RoomServices booking={tourFor.booking} catalog={catalog} initialTab="tour" initialPack={tourFor.pack} onClose={() => setTourFor(null)} />}
      </>
    )
  }

  return (
    <>
      <section className="hero p-[18px] pb-[150px] sm:p-9 sm:pb-[200px]">
        <Skyline className="absolute left-0 right-0 bottom-0 w-full h-[130px] sm:h-[180px] -z-10" />
        <div className="eyebrow">{catalog.hotelName}</div>
        <h1 className="text-[2rem] sm:text-[3.3rem] leading-[1.04] max-w-[15ch] mt-2">Charminar by day, biryani by night.</h1>
        <p className="opacity-85 max-w-[54ch] mt-2.5">Rooms from {inr(catalog.roomTypes[0].price)} a night, 15 minutes from the old city. Check-in from 12 PM, check-out by 11 AM.</p>
        <div className="flex gap-2 flex-wrap mt-4">{['Free cancellation', 'Pay at hotel', 'In-room dining', 'Airport cabs'].map((c) => <span key={c} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/15">{c}</span>)}</div>
      </section>
      <form className="grid grid-cols-6 lg:grid-cols-5 gap-2.5 sm:gap-3 items-end bg-surface border border-line rounded-2xl p-3.5 sm:p-4 shadow-card -mt-16 sm:-mt-[92px] relative z-[2] mx-1.5 sm:mx-5" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-1.5 col-span-3 lg:col-span-1"><label htmlFor="ci" className="field-label">Check-in date</label><input id="ci" type="date" className="input" min={todayIso()} max={addDays(todayIso(), 180)} value={q.checkIn} onChange={(e) => { setQ({ ...q, checkIn: e.target.value || todayIso() }); setSel([]) }} /></div>
        <div className="flex flex-col gap-1.5 col-span-3 lg:col-span-1"><label htmlFor="tm" className="field-label">Arrival time</label>
          <select id="tm" className="input" value={q.time} onChange={(e) => setQ({ ...q, time: e.target.value })}>
            {SLOT_GROUPS.map(([l, a, b]) => { const g = slotList.filter((t) => toMin(t) >= a && toMin(t) <= b); return g.length ? <optgroup key={l} label={l}>{g.map((t) => <option key={t} value={t}>{fTime(t)}</option>)}</optgroup> : null })}
            <option value="flex">Not sure yet, I'll tell you later</option>
          </select></div>
        <div className="flex flex-col gap-1.5 col-span-2 lg:col-span-1"><span className="field-label">Nights</span><Stepper value={q.nights} onChange={(v) => { setQ({ ...q, nights: v }); setSel([]) }} min={1} max={30} label="nights" /></div>
        <div className="flex flex-col gap-1.5 col-span-2 lg:col-span-1"><span className="field-label">Guests</span><Stepper value={q.guests} onChange={(v) => setQ({ ...q, guests: v })} min={q.rooms} max={q.rooms * 4} label="guests" /></div>
        <div className="flex flex-col gap-1.5 col-span-2 lg:col-span-1"><span className="field-label">Rooms</span><Stepper value={q.rooms} onChange={(v) => setQ({ ...q, rooms: v, guests: Math.max(v, q.guests) })} min={1} max={5} label="rooms" /></div>
      </form>
      <div className="grid grid-cols-[1fr_auto_1fr] sm:grid-cols-[auto_auto_auto_1fr] gap-4 items-center px-4 py-3 rounded-xl bg-surface-2">
        <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-in</span><b className="font-serif font-normal">{fDow(q.checkIn)} · {q.time === 'flex' ? 'time flexible' : fTime(q.time)}</b></div>
        <span className="text-ink-3" aria-hidden="true">→</span>
        <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-out</span><b className="font-serif font-normal">{fDow(checkOut)} · 11 AM</b></div>
        <div className="flex flex-col col-span-3 sm:col-span-1 sm:text-right"><b>{q.nights} night{q.nights > 1 ? 's' : ''}</b><span className="text-ink-3 text-[13px]">{q.rooms} room{q.rooms > 1 ? 's' : ''} · {q.guests} guest{q.guests > 1 ? 's' : ''}{q.rooms > 1 ? ` · up to ${per} per room` : ''}</span></div>
      </div>
      {arrivalNote(q.time) && <p className="text-ink-3 text-[13px] -mt-2.5">{arrivalNote(q.time)}</p>}
      {q.nights >= catalog.referralMinNights ? <div className="nudge"><Icon name="gift" className="text-pop shrink-0" /><span>This {q.nights}-night stay earns you a referral code. Friends get {catalog.referralDiscountPercent}% off with it.</span></div>
        : q.nights === catalog.referralMinNights - 1 ? <div className="nudge"><Icon name="gift" className="text-pop shrink-0" /><span>Add 1 more night to earn a referral code for friends.</span></div> : null}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <p className="text-ink-2"><b className="text-ink">{rooms ? list.length : '…'} room{list.length === 1 ? '' : 's'}</b> free for {fD(q.checkIn)} – {fD(checkOut)}{q.rooms > 1 ? ` · select ${q.rooms}` : ''}</p>
        <Seg value={q.type} onChange={(t) => { setQ({ ...q, type: t }); setSel([]); setShowAll(false) }} label="Room type" options={(['All', 'Standard', 'Deluxe', 'Suite'] as const).map((t) => ({ v: t, l: t }))} />
      </div>
      <ErrorBox msg={loadErr} />
      {!rooms && !loadErr ? <Spinner label="Checking which rooms are free…" /> : list.length >= q.rooms ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
            {list.filter((r, i) => showAll || i < 12 || sel.includes(r.id)).map((r) => { const on = sel.includes(r.id); return (
              <button key={r.id} type="button" aria-pressed={on} onClick={() => pick(r.id)} className={`bg-surface border rounded-2xl p-4 flex flex-col gap-3 text-left hover:border-ink-3 ${on ? 'border-pop shadow-[0_0_0_2px_#D9701F]' : 'border-line'}`}>
                <div className="flex justify-between items-start gap-2.5"><div><div className="font-mono text-[1.6rem] font-semibold leading-none">{r.number}</div><div className="text-ink-3 text-[13px]">Floor {r.floor}</div></div><span className={`pill ${on ? 'bg-surface-2 text-ink' : 'bg-avail-soft text-avail'}`}>{on ? 'Selected' : 'Available'}</span></div>
                <div><div className="font-bold">{r.type} room</div><div className="text-ink-3 text-[13px]">Up to {r.capacity} guests</div></div>
                <div className="flex flex-wrap gap-1.5">{r.amenities.map((a) => <span key={a} className="text-xs font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-ink-2">{a}</span>)}</div>
                <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-dashed border-line"><span className="text-ink-3 text-[13px]">{inr(r.price)} / night</span><b className="font-serif font-normal text-xl tabular-nums">{inr(r.price * q.nights)}</b></div>
              </button>) })}
          </div>
          {!showAll && list.length > 12 && <div className="flex justify-center"><button className="btn" onClick={() => setShowAll(true)}>Show all {list.length} rooms</button></div>}
        </>
      ) : (
        <Empty title={list.length ? `Only ${list.length} room${list.length > 1 ? 's' : ''} free` : 'No rooms match'}>
          <p className="text-ink-2 max-w-[46ch]">{list.length ? `You asked for ${q.rooms} rooms. Reduce the number of rooms, choose another room type, or try other dates.` : `No ${q.type === 'All' ? '' : q.type + ' '}room for ${per} guest${per > 1 ? 's' : ''} is free from ${fD(q.checkIn)} to ${fD(checkOut)}. Try other dates, more rooms or another type.`}</p>
        </Empty>
      )}
      <TourSection tour={catalog.tour} onPick={() => { toast('The tour is for PayStay guests. Pick your dates and book a room first.'); document.getElementById('ci')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} hint="Book a room first, then add the tour from My trips." />
      {selected.length > 0 && (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] sm:bottom-4 z-20 rounded-2xl px-4 py-3.5 flex items-center gap-4 flex-wrap text-white shadow-[0_10px_30px_rgba(14,34,64,.25)]" style={{ background: 'linear-gradient(110deg,#0C1E3B,#244B85)' }} role="region" aria-label="Selected rooms">
          <div className="flex-1 min-w-[180px]"><div className="text-[13px] opacity-75">Room{selected.length > 1 ? 's' : ''} {selected.map((r) => r.number).join(', ')} · {q.nights} night{q.nights > 1 ? 's' : ''}</div><b className="font-serif font-normal text-lg">{inr(total)}</b> <span className="text-[13px] opacity-75">incl. GST</span></div>
          {need > 0 ? <span className="text-[13px] opacity-85">Select {need} more room{need > 1 ? 's' : ''}</span> : <button className="btn btn-pop" onClick={() => setReview(true)}>Review booking</button>}
        </div>
      )}
      {review && <Review q={q} rooms={selected} guestName={user?.name ?? ''} catalog={catalog} onClose={() => setReview(false)} onDone={(r) => { setReview(false); setDone(r); window.scrollTo(0, 0) }} />}
    </>
  )
}

function Review({ q, rooms, guestName, catalog, onClose, onDone }: { q: { checkIn: string; time: string; nights: number; guests: number }; rooms: RoomDto[]; guestName: string; catalog: CatalogDto; onClose: () => void; onDone: (r: CreateBookingResult) => void }) {
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<string | null>(null)
  const [refErr, setRefErr] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const d = applied ? catalog.referralDiscountPercent / 100 : 0
  const n = q.nights, checkOut = addDays(q.checkIn, n)
  const sub = rooms.reduce((a, r) => a + r.price * n, 0), disc = sub * d
  const gst = rooms.reduce((a, r) => a + r.price * n * (1 - d) * gstRate(r.price), 0)
  const cap = rooms.reduce((a, r) => a + r.capacity, 0)

  async function apply() {
    setRefErr(null)
    try { const r = await api.customer.checkReferral(code); if (r.valid) { setApplied(code.trim().toUpperCase()); toast(r.message) } else setRefErr(r.message) }
    catch (e) { setRefErr(errorMessage(e)) }
  }
  async function confirm() {
    setBusy(true); setErr(null)
    try { onDone(await api.customer.book({ checkIn: q.checkIn, nights: n, arrivalTime: q.time === 'flex' ? null : q.time, guests: q.guests, roomIds: rooms.map((r) => r.id), referralCode: applied })) }
    catch (e) { setErr(errorMessage(e)); setBusy(false) }
  }
  return (
    <Sheet eyebrow="Review booking" title={rooms.length > 1 ? `${rooms.length} rooms` : `Room ${rooms[0].number} · ${rooms[0].type}`} onClose={onClose}>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-center p-3 rounded-[10px] bg-surface-2">
        <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-in</span><b className="font-serif font-normal">{fDow(q.checkIn)}</b><span className="text-ink-3 text-[13px]">{q.time === 'flex' ? 'arrival time not fixed' : 'arriving ' + fTime(q.time)}</span></div><span className="text-ink-3">→</span>
        <div className="flex flex-col"><span className="text-ink-3 text-[13px]">Check-out</span><b className="font-serif font-normal">{fDow(checkOut)}</b><span className="text-ink-3 text-[13px]">by 11 AM</span></div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3"><span className="text-ink-2">Guest</span><span>{guestName}</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-2">Guests</span><span>{q.guests} in {rooms.length} room{rooms.length > 1 ? 's' : ''}</span></div>
        {rooms.map((r) => <div key={r.id} className="flex justify-between gap-3"><span className="text-ink-2">Room {r.number} · {r.type} · {inr(r.price)} × {n}</span><span className="font-mono">{inr(r.price * n)}</span></div>)}
        {disc > 0 && <div className="flex justify-between gap-3"><span className="text-ink-2">Referral {applied} · {catalog.referralDiscountPercent}% off</span><span className="font-mono text-avail">−{inr(disc)}</span></div>}
        <div className="flex justify-between gap-3"><span className="text-ink-2">GST</span><span className="font-mono">{inr(gst)}</span></div>
        <div className="flex justify-between gap-3 pt-2.5 border-t border-line font-bold text-base"><span>Total</span><span className="font-mono">{inr(sub - disc + gst)}</span></div>
      </div>
      <div className="flex flex-col gap-1.5"><label htmlFor="refIn" className="field-label">Referral code</label>
        {applied ? <div className="nudge"><Icon name="gift" className="text-pop" /><span><b className="font-mono">{applied}</b> applied</span><button type="button" className="ml-auto font-bold underline underline-offset-4" onClick={() => setApplied(null)}>Remove</button></div>
          : <div className="flex gap-2"><input id="refIn" className="input uppercase" placeholder="e.g. STAY4K9QZ2" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn" onClick={apply}>Apply</button></div>}
        <ErrorBox msg={refErr} /></div>
      {cap < q.guests && <p className="text-booked text-sm font-semibold">These rooms sleep {cap} in total. Choose larger rooms or add a room for {q.guests} guests.</p>}
      <p className="text-ink-3 text-[13px]">Pay at the hotel on arrival. Free cancellation until the day before check-in.</p>
      <ErrorBox msg={err} />
      <button className="btn btn-primary w-full" disabled={busy || cap < q.guests} onClick={confirm}>{busy ? 'Booking…' : `Confirm ${rooms.length > 1 ? rooms.length + ' rooms' : 'booking'}`}</button>
    </Sheet>
  )
}
