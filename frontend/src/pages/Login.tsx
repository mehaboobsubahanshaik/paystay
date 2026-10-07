import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '@/api/client'
import type { Role } from '@/api/types'
import { useAuth } from '@/lib/auth'
import { ErrorBox, Seg, Skyline, useToast } from '@/components/ui'

const fmtMob = (m: string) => (m.length > 5 ? m.slice(0, 5) + ' ' + m.slice(5, 10) : m)

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [role, setRole] = useState<Role>('Customer')
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone')
  const [mobile, setMobile] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { if (step !== 'otp') return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [step])
  useEffect(() => { if (step === 'otp') inputs.current[0]?.focus() }, [step])

  async function sendOtp(e?: FormEvent) {
    e?.preventDefault(); setErr(null)
    if (!/^[6-9]\d{9}$/.test(mobile)) { setErr('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'); return }
    setBusy(true)
    try { const r = await api.auth.requestOtp(mobile, role); setDevCode(r.devCode); setDigits(Array(6).fill('')); setStep('otp'); setResendAt(Date.now() + 30000) }
    catch (ex) { setErr(errorMessage(ex)) } finally { setBusy(false) }
  }

  async function verify(code: string) {
    if (code.length !== 6 || busy) return
    setBusy(true); setErr(null)
    try {
      const r = await api.auth.verify(mobile, code, role)
      signIn(r.token, r.user)
      if (r.needsName) { setStep('name'); return }
      toast(r.user.role === 'Owner' ? 'Signed in as owner' : `Welcome back, ${r.user.name.split(' ')[0]}`)
      nav(r.user.role === 'Owner' ? '/owner' : '/book', { replace: true })
    } catch (ex) { setErr(errorMessage(ex)); setDigits(Array(6).fill('')); inputs.current[0]?.focus() } finally { setBusy(false) }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { const next = clean.slice(0, 6).split(''); const d = Array(6).fill('').map((_, k) => next[k] ?? ''); setDigits(d); inputs.current[Math.min(5, next.length - 1)]?.focus(); if (next.length === 6) void verify(d.join('')); return }
    const d = [...digits]; d[i] = clean; setDigits(d)
    if (clean && i < 5) inputs.current[i + 1]?.focus()
    if (d.every((x) => x)) void verify(d.join(''))
  }

  async function saveName(e: FormEvent) {
    e.preventDefault(); setErr(null)
    const n = name.trim()
    if (n.length < 2) { setErr('Enter your name as it appears on your ID.'); return }
    setBusy(true)
    try { const r = await api.customer.setName(n); signIn(r.token, r.user); toast(`Welcome, ${n.split(' ')[0]}`); nav('/book', { replace: true }) }
    catch (ex) { setErr(errorMessage(ex)) } finally { setBusy(false) }
  }

  const owner = role === 'Owner'
  const secs = Math.ceil((resendAt - now) / 1000)
  return (
    <div className="min-h-screen grid md:grid-cols-[1.05fr_1fr]">
      <section className="relative overflow-hidden text-white p-6 md:p-12 flex flex-col gap-8 min-h-[300px]" style={{ background: 'linear-gradient(170deg,#0C1E3B 0%,#244B85 55%,#E8813A 100%)' }}>
        <div className="relative z-10 flex items-center gap-2.5 font-serif text-[1.6rem]"><span className="w-[30px] h-[30px] rounded-lg bg-pop text-[#1A1306] grid place-items-center text-[15px] font-bold font-sans">P</span>PayStay</div>
        <div className="relative z-10 flex flex-col gap-4 mt-3 mb-auto"><span className="eyebrow">PayStay Hyderabad</span><h1 className="text-[2rem] md:text-[3.2rem] leading-[1.05] max-w-[13ch]">Your city break starts here.</h1><p className="max-w-[42ch] opacity-80">Book a room in a minute, order biryani to your door, and get a cab to the airport, all from your trip.</p></div>
        <Skyline className="absolute left-0 right-0 bottom-0 w-full h-[120px] md:h-[230px]" />
      </section>
      <section className="flex items-center justify-center px-4 py-8">
        <div className="w-[min(420px,100%)] flex flex-col gap-5">
          {step === 'phone' && (
            <>
              <Seg value={role} onChange={(r) => { setRole(r); setErr(null) }} label="Sign in as" options={[{ v: 'Customer', l: 'Guest' }, { v: 'Owner', l: 'Hotel owner' }]} />
              <div><h1>{owner ? 'Owner sign in' : 'Sign in to book'}</h1><p className="text-ink-2 mt-1.5">{owner ? 'Manage rooms and see every booking as it comes in.' : 'Enter your mobile number. We will send a one-time password.'}</p></div>
              <form onSubmit={sendOtp} className="flex flex-col gap-1.5" noValidate>
                <label htmlFor="mobile" className="field-label">Mobile number</label>
                <div className="flex border border-line rounded-[10px] bg-surface overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-ink focus-within:-outline-offset-1">
                  <span className="flex items-center px-3 bg-surface-2 font-bold text-ink-2 font-mono">+91</span>
                  <input id="mobile" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={fmtMob(mobile)} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} className="flex-1 min-w-0 min-h-[50px] px-3 bg-transparent font-mono text-[17px] tracking-wide outline-none" />
                </div>
                <ErrorBox msg={err} />
                <button className="btn btn-primary w-full mt-2" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
                <p className="text-ink-3 text-[13px]">{owner ? <>Demo owner number: <b className="font-mono">90000 00001</b></> : 'Any Indian mobile number works in this demo.'}</p>
              </form>
            </>
          )}
          {step === 'otp' && (
            <>
              <button type="button" className="self-start font-bold underline underline-offset-4" onClick={() => { setStep('phone'); setErr(null) }}>← Change number</button>
              <div><h1>Enter the 6-digit code</h1><p className="text-ink-2 mt-1.5">Sent to <b className="font-mono">+91 {fmtMob(mobile)}</b></p></div>
              {devCode && <div role="note" className="flex gap-2.5 items-center px-3 py-2.5 rounded-[10px] bg-pop-soft text-sm">Demo mode, no SMS is sent. Your code is <b className="font-mono tracking-[.2em] text-base">{devCode}</b></div>}
              <form onSubmit={(e) => { e.preventDefault(); void verify(digits.join('')) }} className="flex flex-col gap-1.5" noValidate>
                <span className="field-label">One-time password</span>
                <div className="grid grid-cols-6 gap-2">
                  {digits.map((d, i) => (
                    <input key={i} ref={(el) => { inputs.current[i] = el }} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`} value={d}
                      onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) inputs.current[i - 1]?.focus() }}
                      className="min-h-[56px] w-full text-center font-mono text-[22px] font-semibold border border-line rounded-[10px] bg-surface p-0 focus:outline-ink" />
                  ))}
                </div>
                <ErrorBox msg={err} />
                <button className="btn btn-primary w-full mt-2" disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
                <p className="text-ink-3 text-[13px]">{secs > 0 ? <>Resend code in <span className="font-mono">0:{String(secs).padStart(2, '0')}</span></> : <>Didn't get it? <button type="button" className="font-bold underline underline-offset-4 text-ink" onClick={() => sendOtp()}>Resend code</button></>}</p>
              </form>
            </>
          )}
          {step === 'name' && (
            <>
              <div><h1>Welcome to PayStay</h1><p className="text-ink-2 mt-1.5">What name should the hotel use for your bookings?</p></div>
              <form onSubmit={saveName} className="flex flex-col gap-1.5" noValidate>
                <label htmlFor="gname" className="field-label">Full name</label>
                <input id="gname" className="input" autoComplete="name" placeholder="e.g. Priya Nair" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <ErrorBox msg={err} />
                <button className="btn btn-primary w-full mt-2" disabled={busy}>Start booking</button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
