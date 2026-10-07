import { useEffect, useRef } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { API_URL } from '@/api/client'
import type { HotelEvent } from '@/api/types'
import { useAuth } from './auth'

let shared: { token: string; conn: HubConnection; listeners: Set<(e: HotelEvent) => void>; status: Set<(s: string) => void> } | null = null

function connect(token: string) {
  if (shared && shared.token === token) return shared
  if (shared) void shared.conn.stop()
  const conn = new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/hotel`, { accessTokenFactory: () => token })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build()
  const entry = { token, conn, listeners: new Set<(e: HotelEvent) => void>(), status: new Set<(s: string) => void>() }
  conn.on('changed', (e: HotelEvent) => entry.listeners.forEach((l) => l(e)))
  const announce = () => entry.status.forEach((s) => s(conn.state))
  conn.onreconnecting(announce); conn.onreconnected(announce); conn.onclose(announce)
  conn.start().then(announce).catch(announce)
  shared = entry
  return entry
}

/** Subscribe to the hotel's live events. The handler is called for every "changed" event the server sends this user. */
export function useLive(onEvent: (e: HotelEvent) => void, onStatus?: (connected: boolean) => void) {
  const { token } = useAuth()
  const handler = useRef(onEvent); handler.current = onEvent
  const statusRef = useRef(onStatus); statusRef.current = onStatus

  useEffect(() => {
    if (!token) return
    const entry = connect(token)
    const l = (e: HotelEvent) => handler.current(e)
    const s = (st: string) => statusRef.current?.(st === HubConnectionState.Connected)
    entry.listeners.add(l); entry.status.add(s)
    s(entry.conn.state)
    return () => { entry.listeners.delete(l); entry.status.delete(s) }
  }, [token])
}

export function stopLive() { if (shared) { void shared.conn.stop(); shared = null } }
