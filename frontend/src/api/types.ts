// Mirrors the DTOs in backend/PayStay.Api/Dtos/Dtos.cs
export type Role = 'Customer' | 'Owner'
export type RoomType = 'Standard' | 'Deluxe' | 'Suite'
export type BookingStatus = 'Confirmed' | 'Cancelled'
export type Stage = 'upcoming' | 'staying' | 'completed' | 'cancelled'
export type RequestKind = 'Housekeeping' | 'Dining' | 'Cab' | 'Tour'
export type RequestStatus = 'New' | 'Accepted' | 'Done' | 'Cancelled'
export type RoomStatus = 'Available' | 'Cleaning' | 'Maintenance'

export interface UserDto { id: string; name: string; mobileLast4: string; role: Role }
export interface AuthResult { token: string; expiresAt: string; user: UserDto; needsName: boolean }
export interface OtpRequestResult { sent: boolean; devCode: string | null; expiresInSeconds: number }

export interface RoomDto { id: number; number: number; floor: number; type: RoomType; price: number; capacity: number; amenities: string[] }

export interface BookingDto {
  id: string; code: string; groupId: string; roomId: number; roomNumber: number; roomType: RoomType; floor: number
  checkIn: string; checkOut: string; nights: number; arrivalTime: string | null; guests: number
  price: number; discount: number; gst: number; total: number; referralCode: string | null
  status: BookingStatus; stage: Stage; createdAt: string; guestName: string; mobileLast4: string; openRequests: number
}
export interface CreateBookingDto { checkIn: string; nights: number; arrivalTime: string | null; guests: number; roomIds: number[]; referralCode?: string | null }
export interface CreateBookingResult { bookings: BookingDto[]; earnedReferralCode: string | null }
export interface ReferralCheckResult { valid: boolean; discountPercent: number; message: string }
export interface MyReferralDto { code: string; uses: number; createdAt: string }

export interface RequestItem { name: string; qty: number; price: number }
export interface ServiceRequestDto {
  id: string; bookingId: string; roomNumber: number; guestName: string; kind: RequestKind
  items: RequestItem[]; when: string; note: string | null; total: number; status: RequestStatus; createdAt: string; updatedAt: string
}
export interface CreateRequestDto {
  kind: RequestKind; items: { id: string; qty: number }[]; when?: string; note?: string
  date?: string; time?: string; tourPack?: 'person' | 'family'; tourCount?: number
}

export interface BoardRoomDto { id: number; number: number; floor: number; type: RoomType; status: 'available' | 'booked' | 'cleaning' | 'maintenance'; guestName: string | null; bookingCode: string | null; checkOut: string | null }
export interface NightDto { date: string; booked: number }
export interface DashboardDto {
  totalRooms: number; booked: number; available: number; cleaning: number; maintenance: number
  arrivalsToday: number; departuresToday: number; board: BoardRoomDto[]; feed: BookingDto[]
  openRequests: ServiceRequestDto[]; newRequests: number; next7Nights: NightDto[]; hasSampleData: boolean
}
export interface TypeStatDto { type: RoomType; bookings: number; rooms: number; value: number }
export interface AnalyticsDto {
  bookingValue: number; confirmed: number; cancelled: number; avgStay: number; avgOccupancy14: number
  next14Nights: NightDto[]; byType: TypeStatDto[]; referralCodesIssued: number; referredBookings: number; referralDiscount: number; referredValue: number
}

export interface RoomTypeInfo { type: RoomType; price: number; capacity: number; amenities: string[] }
export interface CatalogItem { id: string; name: string; description: string; price: number; veg: boolean; category: string | null }
export interface TourStop { time: string; name: string; description: string }
export interface TourInfo { name: string; perPerson: number; familyPack: number; familySize: number; pickup: string; drop: string; stops: TourStop[]; includes: string[]; excludes: string[] }
export interface CatalogDto {
  hotelName: string; roomTypes: RoomTypeInfo[]; housekeeping: CatalogItem[]; housekeepingTimes: string[]
  menu: CatalogItem[]; cabs: CatalogItem[]; tour: TourInfo; referralDiscountPercent: number; referralMinNights: number
}

export interface HotelEvent { entity: 'booking' | 'request' | 'room' | 'sample'; action: string; message?: string | null; room?: number | null; id?: string | null }
