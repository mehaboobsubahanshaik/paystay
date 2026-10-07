import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { tokenStore } from '@/api/client'
import type { UserDto } from '@/api/types'

interface AuthState { user: UserDto | null; token: string | null; signIn: (token: string, user: UserDto) => void; signOut: () => void }

const Ctx = createContext<AuthState>({ user: null, token: null, signIn: () => {}, signOut: () => {} })

/** Reads name, role and id out of the JWT so a page refresh keeps the session without an extra request. */
function userFromToken(token: string): UserDto | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp * 1000 < Date.now()) return null
    return { id: payload.sub, name: payload.name ?? '', mobileLast4: payload.mobile4 ?? '', role: payload.role }
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStore.get())
  const [user, setUser] = useState<UserDto | null>(() => { const t = tokenStore.get(); return t ? userFromToken(t) : null })

  const signIn = useCallback((t: string, u: UserDto) => { tokenStore.set(t); setToken(t); setUser(u) }, [])
  const signOut = useCallback(() => { tokenStore.clear(); setToken(null); setUser(null) }, [])

  const value = useMemo(() => ({ user: token ? user : null, token, signIn, signOut }), [user, token, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
