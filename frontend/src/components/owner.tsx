import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BoardRoomDto, NightDto, ServiceRequestDto } from '@/api/types'
import { ago, fDow, inr, kindLabel, kindSteps, stepIndex } from '@/lib/format'

export const STATUS_LABEL: Record<string, string> = { available: 'Available', booked: 'Booked', cleaning: 'Cleaning', maintenance: 'Maintenance' }
const cellClass: Record<string, string> = {
  available: 'bg-avail-soft text-avail', booked: 'bg-booked text-white', cleaning: 'bg-clean-soft text-clean shadow-[inset_0_0_0_1.5px_#B4740B]',
  maintenance: 'text-maint bg-[repeating-linear-gradient(45deg,#E4E8EF_0_4px,#E8EDF4_4px_8px)]',
}

export function Legend() {
  return <div className="flex gap-4 flex-wrap text-[13px] font-semibold text-ink-2">{[['bg-avail', 'Available'], ['bg-booked', 'Booked'], ['bg-clean', 'Cleaning'], ['bg-maint', 'Maintenance']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><i className={`w-[11px] h-[11px] rounded-[3px] ${c}`} />{l}</span>)}</div>
}

/** 50 rooms by floor, colour-coded. `flash` is a room number that just changed, for a short highlight. */
export function RoomBoard({ rooms, filter = 'all', onPick, flash }: { rooms: BoardRoomDto[]; filter?: string; onPick: (r: BoardRoomDto) => void; flash?: number | null }) {
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a)
  return (
    <div className="flex flex-col gap-2">
      {floors.map((f) => (
        <div key={f} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 items-center">
          <span className="font-mono text-xs text-ink-3 font-semibold">F{f}</span>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {rooms.filter((r) => r.floor === f).map((r) => (
              <button key={r.id} type="button" onClick={() => onPick(r)} aria-label={`Room ${r.number}, ${r.type}, ${STATUS_LABEL[r.status]}`}
                className={`rounded-md sm:rounded-lg px-0.5 py-1 sm:py-2 font-mono text-[11px] sm:text-[13px] font-semibold flex flex-col items-center justify-center gap-0.5 min-h-[38px] sm:min-h-[44px] hover:outline hover:outline-2 hover:outline-ink hover:outline-offset-1 ${cellClass[r.status]} ${filter !== 'all' && filter !== r.status ? 'opacity-25' : ''} ${flash === r.number ? 'animate-pulse outline outline-2 outline-pop' : ''}`}>
                {r.number}<small className="hidden sm:block font-sans text-[10px] font-bold tracking-wide uppercase opacity-85">{r.status === 'booked' ? 'BKD' : r.status === 'cleaning' ? 'CLN' : r.status === 'maintenance' ? 'MNT' : r.type[0]}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function NightsChart({ data, max }: { data: NightDto[]; max: number }) {
  const rows = data.map((n, i) => ({ ...n, label: i === 0 ? 'Today' : fDow(n.date).split(',')[0] }))
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D7DFEA" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8CA5', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval={data.length > 7 ? 1 : 0} />
          <YAxis domain={[0, max]} ticks={[0, 10, 20, 30, 40, 50]} tick={{ fontSize: 11, fill: '#7C8CA5', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#E8EDF4' }} contentStyle={{ background: '#0E2240', border: 0, borderRadius: 8, color: '#F1F4F8', fontSize: 13 }} labelStyle={{ color: '#F1F4F8', fontWeight: 700 }} itemStyle={{ color: '#F1F4F8' }}
            formatter={(v: number) => [`${v} of ${max} rooms (${Math.round((v / max) * 100)}%)`, 'Booked']} labelFormatter={(_, p) => (p?.[0]?.payload ? fDow(p[0].payload.date) : '')} />
          <Bar dataKey="booked" radius={[4, 4, 0, 0]} maxBarSize={56}>{rows.map((_, i) => <Cell key={i} fill={i === 0 ? '#D9701F' : '#0E2240'} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const nextAction: Record<string, [string, string] | null> = {
  'New:Housekeeping': ['Accepted', 'Accept'], 'New:Dining': ['Accepted', 'Start preparing'], 'New:Cab': ['Accepted', 'Confirm ride'], 'New:Tour': ['Accepted', 'Confirm tour'],
  'Accepted:Housekeeping': ['Done', 'Mark done'], 'Accepted:Dining': ['Done', 'Mark delivered'], 'Accepted:Cab': ['Done', 'Mark completed'], 'Accepted:Tour': ['Done', 'Mark completed'],
}
export function RequestCard({ r, onStatus }: { r: ServiceRequestDto; onStatus: (id: string, status: 'Accepted' | 'Done') => void }) {
  const i = stepIndex(r.status), next = nextAction[`${r.status}:${r.kind}`]
  return (
    <div className="border border-line rounded-2xl p-3.5 flex flex-col gap-2.5 bg-surface min-w-0">
      <div className="flex justify-between items-start gap-2.5">
        <div className="flex gap-2.5 items-center min-w-0"><span className="w-10 h-10 rounded-[10px] grid place-items-center font-mono font-semibold text-[13px] bg-booked-soft text-booked shrink-0">{r.roomNumber}</span><div className="min-w-0"><b>{kindLabel[r.kind]}</b><div className="text-ink-3 text-[13px] truncate">{r.guestName} · {ago(r.createdAt)}</div></div></div>
        <span className={`pill ${r.status === 'Cancelled' ? 'bg-surface-2 text-ink-3' : i === 2 ? 'bg-avail-soft text-avail' : i === 1 ? 'bg-surface-2 text-ink' : 'bg-pop-soft text-pop'}`}>{r.status === 'Cancelled' ? 'Cancelled' : kindSteps[r.kind][i]}</span>
      </div>
      <div className="text-sm">{r.items.map((x, k) => <span key={k}>{k > 0 && ' · '}{x.qty > 1 && <b>{x.qty} × </b>}{x.name}</span>)}</div>
      <div className="text-ink-3 text-[13px]">When: {r.when}{r.note ? ` · Note: “${r.note}”` : ''}{r.total > 0 && <> · <b className="font-mono text-ink">{inr(r.total)}</b> to room bill</>}</div>
      {next && <div><button className={`btn btn-sm ${r.status === 'New' ? 'btn-primary' : ''}`} onClick={() => onStatus(r.id, next[0] as 'Accepted' | 'Done')}>{next[1]}</button></div>}
    </div>
  )
}
