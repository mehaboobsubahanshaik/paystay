import axios, { AxiosError } from 'axios'
import type {
  AnalyticsDto, AuthResult, BoardRoomDto, BookingDto, CatalogDto, CreateBookingDto, CreateBookingResult, CreateRequestDto,
  DashboardDto, MyReferralDto, OtpRequestResult, ReferralCheckResult, RequestStatus, Role, RoomDto, RoomStatus, RoomType,
  ServiceRequestDto, UserDto,
} from './types'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'paystay.token'

export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { sessionStorage.setItem(TOKEN_KEY, t) } catch { /* private mode */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

export const http = axios.create({ baseURL: API_URL + '/api' })
http.interceptors.request.use((cfg) => {
  const t = tokenStore.get()
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

/** Turns any API failure into a sentence the guest or owner can read. */
export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string; title?: string; errors?: Record<string, string[]> }>
  const d = err?.response?.data
  if (d?.message) return d.message
  if (d?.errors) return Object.values(d.errors).flat()[0] ?? 'Check the form and try again.'
  if (d?.title) return d.title
  if (err?.response?.status === 401) return 'Your session has ended. Sign in again.'
  if (err?.response?.status === 403) return 'You do not have access to that.'
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the API is running.'
  return 'Something went wrong. Try again.'
}

export const api = {
  catalog: () => http.get<CatalogDto>('/catalog').then((r) => r.data),

  auth: {
    requestOtp: (mobile: string, role: Role) => http.post<OtpRequestResult>('/auth/otp/request', { mobile, role }).then((r) => r.data),
    verify: (mobile: string, code: string, role: Role) => http.post<AuthResult>('/auth/otp/verify', { mobile, code, role }).then((r) => r.data),
  },

  customer: {
    profile: () => http.get<UserDto>('/customer/profile').then((r) => r.data),
    setName: (name: string) => http.put<AuthResult>('/customer/profile', { name }).then((r) => r.data),
    available: (p: { checkIn: string; nights: number; guests: number; rooms: number; type?: RoomType | null }) =>
      http.get<RoomDto[]>('/customer/rooms/available', { params: { ...p, type: p.type ?? undefined } }).then((r) => r.data),
    bookings: () => http.get<BookingDto[]>('/customer/bookings').then((r) => r.data),
    book: (dto: CreateBookingDto) => http.post<CreateBookingResult>('/customer/bookings', dto).then((r) => r.data),
    cancel: (id: string) => http.post<BookingDto>(`/customer/bookings/${id}/cancel`).then((r) => r.data),
    setArrival: (id: string, arrivalTime: string | null) => http.patch<BookingDto[]>(`/customer/bookings/${id}/arrival`, { arrivalTime }).then((r) => r.data),
    checkReferral: (code: string) => http.post<ReferralCheckResult>('/customer/referrals/check', { code }).then((r) => r.data),
    referrals: () => http.get<MyReferralDto[]>('/customer/referrals').then((r) => r.data),
    requests: (bookingId: string) => http.get<ServiceRequestDto[]>(`/customer/bookings/${bookingId}/requests`).then((r) => r.data),
    createRequest: (bookingId: string, dto: CreateRequestDto) => http.post<ServiceRequestDto>(`/customer/bookings/${bookingId}/requests`, dto).then((r) => r.data),
    cancelRequest: (id: string) => http.post<ServiceRequestDto>(`/customer/requests/${id}/cancel`).then((r) => r.data),
  },

  owner: {
    dashboard: () => http.get<DashboardDto>('/owner/dashboard').then((r) => r.data),
    analytics: () => http.get<AnalyticsDto>('/owner/analytics').then((r) => r.data),
    rooms: () => http.get<BoardRoomDto[]>('/owner/rooms').then((r) => r.data),
    setRoomStatus: (id: number, status: RoomStatus) => http.put<BoardRoomDto>(`/owner/rooms/${id}/status`, { status }).then((r) => r.data),
    bookings: (stage: string, q: string) => http.get<BookingDto[]>('/owner/bookings', { params: { stage, q: q || undefined } }).then((r) => r.data),
    cancelBooking: (id: string) => http.post<BookingDto>(`/owner/bookings/${id}/cancel`).then((r) => r.data),
    requests: (filter: string) => http.get<ServiceRequestDto[]>('/owner/requests', { params: { filter } }).then((r) => r.data),
    setRequestStatus: (id: string, status: RequestStatus) => http.put<ServiceRequestDto>(`/owner/requests/${id}/status`, { status }).then((r) => r.data),
    addSample: () => http.post<{ added: number }>('/owner/sample-data').then((r) => r.data),
    removeSample: () => http.delete('/owner/sample-data'),
  },
}
