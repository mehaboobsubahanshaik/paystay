export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
export const pad = (n: number) => String(n).padStart(2, '0')
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s: string, n: number) => { const d = parseIso(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const fD = (s: string) => parseIso(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const fDow = (s: string) => parseIso(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
export const fTime = (t: string | null | undefined) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
export const arrivalText = (t: string | null | undefined) => (t ? `arriving ${fTime(t)}` : 'arrival time not fixed')
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}
export const gstRate = (price: number) => (price <= 7500 ? 0.05 : 0.18)
export const stageLabel: Record<string, string> = { upcoming: 'Upcoming', staying: 'Staying now', completed: 'Completed', cancelled: 'Cancelled' }
export const stageClass: Record<string, string> = {
  upcoming: 'bg-surface-2 text-ink', staying: 'bg-booked-soft text-booked', completed: 'bg-surface-2 text-ink-2', cancelled: 'bg-surface-2 text-ink-3',
}
export const kindLabel: Record<string, string> = { Housekeeping: 'Housekeeping', Dining: 'In-room dining', Cab: 'Cab', Tour: 'City tour' }
export const kindSteps: Record<string, string[]> = {
  Housekeeping: ['Requested', 'On the way', 'Done'], Dining: ['Ordered', 'Preparing', 'Delivered'],
  Cab: ['Requested', 'Confirmed', 'Completed'], Tour: ['Requested', 'Confirmed', 'Completed'],
}
export const stepIndex = (s: string) => (s === 'New' ? 0 : s === 'Accepted' ? 1 : s === 'Done' ? 2 : -1)
