import type { TourInfo } from '@/api/types'
import { inr } from '@/lib/format'
import { Icon } from './ui'

/** The "Hyderabad in a Day" recommendation. onPick opens the tour booking with that price option selected. */
export function TourSection({ tour, onPick, hint }: { tour: TourInfo; onPick: (pack: 'person' | 'family') => void; hint?: string }) {
  const saving = tour.perPerson * tour.familySize - tour.familyPack
  return (
    <section className="grid md:grid-cols-2 gap-5 md:gap-7 p-[18px] md:p-[26px] rounded-[22px] bg-surface border border-line shadow-card">
      <div className="flex flex-col gap-3.5 min-w-0">
        <div className="eyebrow !text-pop">PayStay recommends</div>
        <h2 className="text-[1.7rem]">{tour.name}</h2>
        <p className="text-ink-2">A guided day across the city's landmarks, from the old city bazaars to Golconda at sunset. Pickup and drop at the hotel.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => onPick('person')} className="flex flex-col items-start gap-0.5 p-3.5 rounded-2xl border border-line bg-surface text-left hover:border-ink-3 hover:shadow-card">
            <span className="label">Per person</span><b className="font-serif font-normal text-[2rem] leading-tight">{inr(tour.perPerson)}</b><span className="text-ink-3 text-[13px]">Per traveller, full day</span><span className="mt-1.5 text-[13px] font-bold text-pop">Book per person →</span>
          </button>
          <button type="button" onClick={() => onPick('family')} className="flex flex-col items-start gap-0.5 p-3.5 rounded-2xl border border-pop bg-pop-soft text-left hover:shadow-card">
            <span className="label">Family pack</span><b className="font-serif font-normal text-[2rem] leading-tight">{inr(tour.familyPack)}</b><span className="text-ink-3 text-[13px]">{tour.familySize} members · save {inr(saving)}</span><span className="mt-1.5 text-[13px] font-bold text-pop">Book family pack →</span>
          </button>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {tour.includes.map((x) => <li key={x} className="flex gap-2 items-center"><Icon name="check" size={14} className="text-avail shrink-0" />{x}</li>)}
          {tour.excludes.map((x) => <li key={x} className="flex gap-2 items-center text-ink-2"><span className="text-booked font-bold w-3.5 text-center" aria-hidden="true">✕</span>{x}</li>)}
        </ul>
        {hint && <p className="text-sm text-ink-2">{hint}</p>}
      </div>
      <ol className="flex flex-col min-w-0 pl-1">
        {tour.stops.map((s, i) => (
          <li key={s.time} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 relative pb-3.5">
            <span className="font-mono text-xs text-ink-3 text-right pt-0.5">{s.time}</span>
            <span className="absolute left-[79px] top-1.5 w-[9px] h-[9px] rounded-full bg-pop shadow-[0_0_0_3px_#FBE7D6]" />
            {i < tour.stops.length - 1 && <span className="absolute left-[83px] top-[17px] -bottom-1 w-px bg-line" />}
            <div className="pl-[18px] min-w-0"><b className="block text-sm">{s.name}</b><small className="block text-ink-3 text-xs">{s.description}</small></div>
          </li>
        ))}
      </ol>
    </section>
  )
}
