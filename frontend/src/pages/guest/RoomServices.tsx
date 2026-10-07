import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '@/api/client'
import type { BookingDto, CatalogDto, RequestKind, ServiceRequestDto } from '@/api/types'
import { useLive } from '@/lib/live'
import { addDays, ago, fD, fDow, fTime, inr, kindLabel, kindSteps, stepIndex, todayIso } from '@/lib/format'
import { ErrorBox, Icon, Sheet, Stepper, useToast } from '@/components/ui'

type Tab = 'housekeeping' | 'dining' | 'tour' | 'cab' | 'mine'

export function RoomServices({ booking: b, catalog, initialTab, initialPack, onClose }: { booking: BookingDto; catalog: CatalogDto; initialTab?: Tab; initialPack?: 'person' | 'family'; onClose: () => void }) {
  const toast = useToast()
  const inHouse = b.stage === 'staying'
  const [tab, setTab] = useState<Tab>(initialTab ?? (inHouse ? 'housekeeping' : 'dining'))
  const [mine, setMine] = useState<ServiceRequestDto[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [hk, setHk] = useState<string[]>([])
  const [when, setWhen] = useState(catalog.housekeepingTimes[0])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [cab, setCab] = useState<string | null>(null)
  const [cabDate, setCabDate] = useState(b.checkOut)
  const [cabTime, setCabTime] = useState('09:00')
  const [pack, setPack] = useState<'person' | 'family'>(initialPack ?? (b.guests >= catalog.tour.familySize ? 'family' : 'person'))
  const [tourN, setTourN] = useState(initialPack === 'family' || (!initialPack && b.guests >= catalog.tour.familySize) ? Math.max(1, Math.ceil(b.guests / catalog.tour.familySize)) : b.guests)
  const [tourDate, setTourDate] = useState<string | null>(null)

  const load = useCallback(() => api.customer.requests(b.id).then(setMine).catch(() => {}), [b.id])
  useEffect(() => { void load() }, [load])
  useLive((e) => { if (e.entity === 'request') void load() })

  const tourDays = useMemo(() => {
    const t = todayIso(); let start = b.checkIn < t ? t : b.checkIn
    if (start === t && new Date().getHours() >= 9) start = addDays(t, 1)
    const out: string[] = []; for (let d = start; d <= b.checkOut; d = addDays(d, 1)) out.push(d); return out
  }, [b.checkIn, b.checkOut])
  const tDate = tourDate && tourDays.includes(tourDate) ? tourDate : (tourDays.find((d) => d !== b.checkOut) ?? tourDays[0])
  const cabDays = useMemo(() => { const t = todayIso(); const out: string[] = []; for (let d = b.checkIn < t ? t : b.checkIn; d <= b.checkOut; d = addDays(d, 1)) out.push(d); return out }, [b.checkIn, b.checkOut])

  async function send(kind: RequestKind, items: { id: string; qty: number }[], extra: object = {}) {
    setBusy(true); setErr(null)
    try {
      await api.customer.createRequest(b.id, { kind, items, note: note.trim() || undefined, ...extra })
      setNote(''); setHk([]); setCart({}); setCab(null)
      await load(); setTab('mine'); toast(`${kindLabel[kind]} request sent to the front desk`)
    } catch (e) { setErr(errorMessage(e)) } finally { setBusy(false) }
  }

  const openN = mine.filter((r) => r.status === 'New' || r.status === 'Accepted').length
  const tabs: [Tab, string][] = [['housekeeping', 'Housekeeping'], ['dining', 'Dining'], ['tour', 'City tour'], ['cab', 'Cabs'], ['mine', `My requests${openN ? ` (${openN})` : ''}`]]
  const cartItems = Object.entries(cart).filter(([, q]) => q > 0)
  const cartSub = cartItems.reduce((a, [id, q]) => a + catalog.menu.find((m) => m.id === id)!.price * q, 0)
  const tour = catalog.tour, fam = pack === 'family', people = fam ? tourN * tour.familySize : tourN
  const tourTotal = fam ? tourN * tour.familyPack : tourN * tour.perPerson, tourFull = people * tour.perPerson
  const cabItem = catalog.cabs.find((c) => c.id === cab)
  const noteField = (label: string, placeholder: string, maxLength = 140, disabled = false) => (
    <div className="flex flex-col gap-1.5"><label htmlFor="stNote" className="field-label">{label}</label><input id="stNote" className="input" maxLength={maxLength} placeholder={placeholder} value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} /></div>
  )

  let body: React.ReactNode, footer: React.ReactNode = null
  if (tab === 'housekeeping') {
    body = <>
      {!inHouse && <div className="nudge"><Icon name="bell" className="text-pop shrink-0" /><span>Housekeeping opens when you check in on {fDow(b.checkIn)}.</span></div>}
      <div className="grid grid-cols-2 gap-2.5">{catalog.housekeeping.map((h) => <button key={h.id} type="button" disabled={!inHouse} aria-pressed={hk.includes(h.id)} onClick={() => setHk(hk.includes(h.id) ? hk.filter((x) => x !== h.id) : [...hk, h.id])} className={`border rounded-xl p-3 text-left flex flex-col gap-0.5 min-h-[64px] disabled:opacity-50 ${hk.includes(h.id) ? 'border-pop shadow-[0_0_0_1.5px_#D9701F] bg-pop-soft' : 'border-line bg-surface'}`}><b className="text-sm">{h.name}</b><small className="text-ink-3 text-xs">{h.description}</small></button>)}</div>
      <div className="flex flex-col gap-1.5"><label htmlFor="hkWhen" className="field-label">When</label><select id="hkWhen" className="input" value={when} onChange={(e) => setWhen(e.target.value)} disabled={!inHouse}>{catalog.housekeepingTimes.map((w) => <option key={w}>{w}</option>)}</select></div>
      {noteField('Note for the team (optional)', 'e.g. Please knock, baby sleeping', 140, !inHouse)}
    </>
    footer = <><span className="text-sm text-ink-2">{hk.length ? `${hk.length} selected · free` : 'Pick one or more'}</span><button className="btn btn-primary" disabled={!inHouse || !hk.length || busy} onClick={() => send('Housekeeping', hk.map((id) => ({ id, qty: 1 })), { when })}>Send request</button></>
  } else if (tab === 'dining') {
    const cats = [...new Set(catalog.menu.map((m) => m.category))]
    body = <>
      {!inHouse && <div className="nudge"><Icon name="bell" className="text-pop shrink-0" /><span>Pre-order now and we'll bring it to Room {b.roomNumber} when you arrive on {fDow(b.checkIn)}{b.arrivalTime ? ' around ' + fTime(b.arrivalTime) : ''}.</span></div>}
      {cats.map((c) => <div key={c}><div className="label mt-2.5">{c}</div>{catalog.menu.filter((m) => m.category === c).map((m) => { const q = cart[m.id] || 0; return (
        <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-t border-line">
          <div><b><span className={`inline-block w-3 h-3 border-[1.5px] rounded-sm mr-1.5 align-[-1px] relative after:content-[''] after:absolute after:inset-0.5 after:rounded-full ${m.veg ? 'border-avail after:bg-avail' : 'border-booked after:bg-booked'}`} aria-label={m.veg ? 'Vegetarian' : 'Non-vegetarian'} />{m.name}</b><small className="block text-ink-3 text-xs">{m.description} · <span className="font-mono">{inr(m.price)}</span></small></div>
          {q ? <span className="inline-flex items-center border border-line rounded-lg overflow-hidden bg-surface"><button type="button" className="w-8 h-8 font-bold hover:bg-surface-2" onClick={() => setCart({ ...cart, [m.id]: q - 1 })} aria-label={`One less ${m.name}`}>−</button><span className="min-w-[22px] text-center font-mono font-semibold">{q}</span><button type="button" className="w-8 h-8 font-bold hover:bg-surface-2" onClick={() => setCart({ ...cart, [m.id]: Math.min(20, q + 1) })} aria-label={`One more ${m.name}`}>+</button></span>
            : <button type="button" className="btn btn-sm" onClick={() => setCart({ ...cart, [m.id]: 1 })}>Add</button>}
        </div>) })}</div>)}
      <div className="mt-1.5">{noteField('Cooking note (optional)', 'e.g. Less spicy, no onion')}</div>
    </>
    const count = cartItems.reduce((a, [, q]) => a + q, 0)
    footer = <><span><b className="font-mono">{inr(cartSub * 1.05)}</b> <span className="text-sm text-ink-2">incl. 5% GST · added to room bill</span></span><button className="btn btn-primary" disabled={!count || busy} onClick={() => send('Dining', cartItems.map(([id, qty]) => ({ id, qty })))}>{count ? `Place order · ${count} item${count > 1 ? 's' : ''}` : 'Add dishes to order'}</button></>
  } else if (tab === 'tour') {
    body = tourDays.length ? <>
      <div className="nudge"><Icon name="gift" className="text-pop shrink-0" /><span>{tour.name}: {tour.pickup} pickup, {tour.drop} drop, with a guide. Food on your own.</span></div>
      <div className="grid grid-cols-2 gap-2.5">
        {(['person', 'family'] as const).map((p) => <button key={p} type="button" aria-pressed={pack === p} onClick={() => { if (p !== pack) { setPack(p); setTourN(p === 'family' ? Math.max(1, Math.ceil(b.guests / tour.familySize)) : b.guests) } }} className={`flex flex-col items-start gap-0.5 p-3.5 rounded-2xl border text-left ${pack === p ? 'border-pop shadow-[0_0_0_2px_#D9701F]' : 'border-line'}`}><span className="label">{p === 'person' ? 'Per person' : 'Family pack'}</span><b className="font-serif font-normal text-[1.6rem] leading-tight">{inr(p === 'person' ? tour.perPerson : tour.familyPack)}</b><span className="text-ink-3 text-[13px]">{p === 'person' ? 'Each traveller' : `${tour.familySize} members together`}</span></button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5"><label htmlFor="tourDate" className="field-label">Tour date</label><select id="tourDate" className="input" value={tDate} onChange={(e) => setTourDate(e.target.value)}>{tourDays.map((d) => <option key={d} value={d}>{fDow(d)}{d === b.checkOut ? ' · check-out day' : ''}</option>)}</select></div>
        <div className="flex flex-col gap-1.5"><span className="field-label">{fam ? 'Family packs' : 'Travellers'}</span><Stepper value={tourN} onChange={setTourN} min={1} max={fam ? 3 : 12} label={fam ? 'family packs' : 'travellers'} /></div>
      </div>
      {tDate === b.checkOut && <p className="text-ink-3 text-[13px]">On check-out day we keep your luggage at the desk during the tour.</p>}
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3"><span className="text-ink-2">{fam ? `Family pack × ${tourN} (${people} people)` : `Per person × ${tourN}`}</span><span className="font-mono">{inr(tourTotal)}</span></div>
        {tourTotal < tourFull && <div className="flex justify-between gap-3"><span className="text-ink-2">You save vs per person</span><span className="font-mono text-avail">{inr(tourFull - tourTotal)}</span></div>}
        <div className="flex justify-between gap-3 pt-2.5 border-t border-line font-bold text-base"><span>Tour total</span><span className="font-mono">{inr(tourTotal)}</span></div>
      </div>
      {!fam && tourN >= 3 && <p className="text-ink-3 text-[13px]">Travelling as {tourN}? A family pack of {tour.familySize} costs {inr(tour.familyPack)}. <button type="button" className="font-bold underline underline-offset-4 text-ink" onClick={() => { setPack('family'); setTourN(Math.max(1, Math.ceil(tourN / tour.familySize))) }}>Switch to family pack</button></p>}
      <ol className="flex flex-col pl-1">{tour.stops.map((s, i) => <li key={s.time} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 relative pb-2"><span className="font-mono text-xs text-ink-3 text-right pt-0.5">{s.time}</span><span className="absolute left-[79px] top-1.5 w-[9px] h-[9px] rounded-full bg-pop shadow-[0_0_0_3px_#FBE7D6]" />{i < tour.stops.length - 1 && <span className="absolute left-[83px] top-[17px] -bottom-1 w-px bg-line" />}<b className="pl-[18px] text-sm">{s.name}</b></li>)}</ol>
    </> : <p className="text-ink-2 p-6 text-center">This stay has ended, so the tour can't be added to it. Book a new stay to join the tour.</p>
    footer = tourDays.length ? <><span className="text-sm text-ink-2">{people} traveller{people > 1 ? 's' : ''} · <b className="font-mono text-ink">{inr(tourTotal)}</b> on room bill</span><button className="btn btn-primary" disabled={busy} onClick={() => send('Tour', [], { date: tDate, tourPack: pack, tourCount: tourN })}>Book tour · {inr(tourTotal)}</button></> : null
  } else if (tab === 'cab') {
    body = <>
      <div className="grid grid-cols-2 gap-2.5">{catalog.cabs.map((c) => <button key={c.id} type="button" aria-pressed={cab === c.id} onClick={() => { setCab(c.id); setCabDate(c.id === 'airport-pick' ? b.checkIn : b.checkOut) }} className={`border rounded-xl p-3 text-left flex flex-col gap-0.5 min-h-[64px] ${cab === c.id ? 'border-pop shadow-[0_0_0_1.5px_#D9701F] bg-pop-soft' : 'border-line bg-surface'}`}><b className="text-sm">{c.name}</b><small className="text-ink-3 text-xs">{c.description}</small><small className="font-mono font-bold text-ink mt-1">{inr(c.price)}</small></button>)}</div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5"><label htmlFor="tDate" className="field-label">Date</label><select id="tDate" className="input" value={cabDays.includes(cabDate) ? cabDate : cabDays[0]} onChange={(e) => setCabDate(e.target.value)}>{cabDays.map((d) => <option key={d} value={d}>{fDow(d)}</option>)}</select></div>
        <div className="flex flex-col gap-1.5"><label htmlFor="tTime" className="field-label">Pickup time</label><select id="tTime" className="input" value={cabTime} onChange={(e) => setCabTime(e.target.value)}>{Array.from({ length: 38 }, (_, i) => `${String(Math.floor((i + 10) / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`).map((t) => <option key={t} value={t}>{fTime(t)}</option>)}</select></div>
      </div>
      {noteField('Flight or train number (optional)', 'e.g. 6E 2134 or 12723', 60)}
      <p className="text-ink-3 text-[13px]">Prefer to book yourself? <a className="underline" href="https://www.uber.com/in/en/ride/" target="_blank" rel="noopener">Open Uber ↗</a></p>
    </>
    footer = <><span className="text-sm text-ink-2">{cabItem ? <>{cabItem.name} · <b className="font-mono text-ink">{inr(cabItem.price)}</b> on room bill</> : 'Choose a ride'}</span><button className="btn btn-primary" disabled={!cab || busy} onClick={() => send('Cab', [{ id: cab!, qty: 1 }], { date: cabDays.includes(cabDate) ? cabDate : cabDays[0], time: cabTime })}>Book ride</button></>
  } else {
    body = mine.length ? mine.map((r) => { const i = stepIndex(r.status), steps = kindSteps[r.kind]; return (
      <div key={r.id} className="border border-line rounded-2xl p-3.5 flex flex-col gap-2.5 bg-surface">
        <div className="flex justify-between items-start gap-2.5"><div><b>{kindLabel[r.kind]}</b><div className="text-ink-3 text-[13px]">{r.when} · {ago(r.createdAt)}</div></div><span className={`pill ${r.status === 'Cancelled' ? 'bg-surface-2 text-ink-3' : i === 2 ? 'bg-avail-soft text-avail' : i === 1 ? 'bg-surface-2 text-ink' : 'bg-pop-soft text-pop'}`}>{r.status === 'Cancelled' ? 'Cancelled' : steps[i]}</span></div>
        <div className="text-sm text-ink-2">{r.items.map((x) => `${x.qty > 1 ? x.qty + ' × ' : ''}${x.name}`).join(', ')}{r.note ? ` · “${r.note}”` : ''}</div>
        {r.status !== 'Cancelled' && <div><div className="grid grid-cols-3 gap-1">{[0, 1, 2].map((k) => <i key={k} className={`h-1 rounded-sm ${k <= i ? 'bg-avail' : 'bg-surface-2'}`} />)}</div><div className="grid grid-cols-3 gap-1 text-[11px] text-ink-3 font-bold mt-1">{steps.map((s) => <span key={s}>{s}</span>)}</div></div>}
        {r.total > 0 && <div className="flex justify-between text-sm"><span className="text-ink-2">On room bill</span><b className="font-mono">{inr(r.total)}</b></div>}
        {r.status === 'New' && <button className="btn btn-sm self-start" onClick={async () => { try { await api.customer.cancelRequest(r.id); toast('Request cancelled'); void load() } catch (e) { toast(errorMessage(e)) } }}>Cancel request</button>}
      </div>) })
      : <p className="text-ink-2 p-6 text-center">Requests you send appear here, and update live as the team picks them up.</p>
  }

  return (
    <Sheet eyebrow={`Room ${b.roomNumber} · ${fD(b.checkIn)} – ${fD(b.checkOut)}`} title="Room services" onClose={onClose} footer={footer}>
      <div className="sticky -top-[22px] z-[2] bg-surface py-1.5"><div className="seg" role="tablist">{tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => { setTab(k); setErr(null); setNote('') }}>{l}</button>)}</div></div>
      <ErrorBox msg={err} />
      <div className="flex flex-col gap-3">{body}</div>
    </Sheet>
  )
}
