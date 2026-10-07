import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// ---------- icons (inline SVG, no icon library) ----------
const paths: Record<string, string> = {
  bed: 'M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
  ticket: 'M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4zM14 6v12',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  door: 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  out: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  plane: 'M10.5 13.5 3 11l1.5-1.5 8 1L17 6a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5L9 19v3l-1.5 1L6 19.5 2.5 18 3.5 16.5h3l3.5-3.5',
  train: 'M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM4 11h16M8 18l-2 3M16 18l2 3M8.5 14.5h.01M15.5 14.5h.01',
  car: 'M5 17H3v-5l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 7l2 5v5h-2M5 12h14M7.5 17a1.5 1.5 0 1 0 0 .01M16.5 17a1.5 1.5 0 1 0 0 .01M9 17h6',
  bell: 'M4 17h16M5.5 17a6.5 6.5 0 0 1 13 0M12 8V6M10 6h4M3 20h18',
  gift: 'M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  x: 'M6 6l12 12M18 6 6 18',
}
export function Icon({ name, size = 18, className = '' }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth={name === 'check' ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>()
  const show = useCallback((m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 3800) }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 top-[74px] z-[60] bg-ink text-page px-4 py-[11px] rounded-xl font-semibold text-sm shadow-card flex gap-2.5 items-center max-w-[calc(100%-32px)]">
          <i className="w-2 h-2 rounded-full bg-pop shrink-0" />{msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------- side sheet / bottom sheet ----------
export function Sheet({ title, eyebrow, onClose, children, footer }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(10,12,30,.5)] flex justify-end max-sm:items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" className="w-[min(460px,100%)] h-full max-sm:h-auto max-sm:max-h-[88vh] max-sm:rounded-t-[18px] overflow-y-auto bg-surface px-5 pt-[22px] pb-6 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-3">
          <div>{eyebrow && <div className="label">{eyebrow}</div>}<h2>{title}</h2></div>
          <button className="w-9 h-9 rounded-[10px] bg-surface-2 shrink-0 grid place-items-center" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="flex flex-col gap-3 flex-1">{children}</div>
        {footer && <div className="sticky -bottom-6 bg-surface pt-3 pb-1 border-t border-line flex gap-3 items-center justify-between flex-wrap">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- small pieces ----------
export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>−</button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>+</button>
    </div>
  )
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; l: ReactNode }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="flex flex-col items-center text-center gap-2.5 p-9 border border-dashed border-line rounded-2xl bg-surface"><h2>{title}</h2>{children}</div>
}

/** PayStay loading animation: a bobbing hotel with pulsing dots. `full` fills the screen (first load); otherwise it sits inside the page. */
export function Spinner({ label = 'Loading…', full = false }: { label?: string; full?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-2 text-ink ${full ? 'fixed inset-0 bg-page z-40' : 'py-10'}`}>
      <div className={`leading-none animate-hotel-bob ${full ? 'text-[56px]' : 'text-[40px]'}`} aria-hidden="true">🏨</div>
      <div className={`rounded-full bg-ink/20 animate-hotel-shadow -mt-2 ${full ? 'w-11 h-2' : 'w-8 h-1.5'}`} aria-hidden="true" />
      <div className={`font-serif ${full ? 'text-3xl' : 'text-xl'}`}>PayStay</div>
      <div className="flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className="w-[7px] h-[7px] rounded-full bg-pop animate-hotel-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>
      <span className="text-ink-3 text-sm">{label}</span>
    </div>
  )
}

export function ErrorBox({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="text-booked text-sm font-semibold">{msg}</p> : null
}

export function Skyline({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle cx="930" cy="92" r="46" fill="#FFC978" opacity=".95" />
      <g fill="#0A1830">
        <path d="M0 200V150h40v-22h26v22h18v-40h30v40h24v-18h34v58z" opacity=".55" />
        <path d="M190 200v-64h36v-14h22v14h30v-30h40v94zM1010 200v-52h30v-26h26v26h34v-18h40v-30h28v100z" opacity=".55" />
        <rect x="490" y="56" width="12" height="144" /><rect x="618" y="56" width="12" height="144" />
        <circle cx="496" cy="52" r="9" /><circle cx="624" cy="52" r="9" />
        <rect x="493" y="38" width="6" height="8" /><rect x="621" y="38" width="6" height="8" />
        <path d="M502 200V112h116v88h-34v-46a24 24 0 0 0-48 0v46z" />
        <ellipse cx="560" cy="110" rx="34" ry="12" />
        <path d="M330 200v-70h24v-12h18v12h26v70zM400 200v-48h60v48zM700 200v-58h50v58zM760 200v-80h22v-10h20v10h22v80zM840 200v-44h70v44z" />
        <path d="M118 200c4-34 10-56 18-74" stroke="#0A1830" strokeWidth="5" fill="none" />
        <path d="M136 126c-16-8-34-6-46 4 14-2 28 0 46-4zm0 0c-4-16-18-26-34-26 12 6 24 14 34 26zm0 0c10-14 26-20 42-16-14 2-30 6-42 16zm0 0c16-4 32 2 40 14-12-6-26-10-40-14z" />
        <path d="M1150 200c-3-30-8-50-15-66" stroke="#0A1830" strokeWidth="5" fill="none" />
        <path d="M1135 134c-15-7-31-5-42 4 13-2 26 0 42-4zm0 0c-3-15-16-24-31-24 11 6 22 13 31 24zm0 0c9-13 24-18 38-14-13 2-27 5-38 14z" />
        <rect x="0" y="186" width="1200" height="14" />
      </g>
    </svg>
  )
}

/** Links to outside booking sites. These open in a new tab; they are plain links, not affiliate deals. */
export function TravelPartners({ date }: { date: string }) {
  const flights = `https://www.google.com/travel/flights?q=${encodeURIComponent('Flights to Hyderabad on ' + date)}`
  const items = [
    { icon: 'plane', title: 'Flights to Hyderabad', sub: 'Compare fares into Rajiv Gandhi International (HYD)', go: 'Search on Google Flights ↗', href: flights },
    { icon: 'train', title: 'Trains', sub: 'Secunderabad (SC), Hyderabad (HYB) or Kacheguda (KCG)', go: 'Book on IRCTC ↗', href: 'https://www.irctc.co.in/nget/train-search' },
    { icon: 'car', title: 'Cabs in the city', sub: 'Or ask our travel desk for an airport or station cab', go: 'Open Uber ↗', href: 'https://www.uber.com/in/en/ride/' },
  ]
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3.5">
      {items.map((p) => (
        <a key={p.title} href={p.href} target="_blank" rel="noopener" className="flex gap-3.5 items-start p-4 rounded-2xl border border-line bg-surface hover:border-ink-3 hover:shadow-card text-ink no-underline">
          <span className="w-11 h-11 rounded-xl grid place-items-center bg-pop-soft text-pop shrink-0"><Icon name={p.icon} size={22} /></span>
          <span><b className="block">{p.title}</b><small className="block text-ink-3 text-xs">{p.sub}</small><span className="block mt-1.5 text-[13px] font-bold text-pop">{p.go}</span></span>
        </a>
      ))}
    </div>
  )
}

export async function copyText(t: string, toast: (m: string) => void) {
  try { await navigator.clipboard.writeText(t); toast('Code copied') } catch { toast('Select the code and copy it') }
}
