export interface UserDisableRequestDto {
  id: string
  targetUserId: string
  targetUserName: string
  targetUserEmail: string
  requestedById: string
  requestedByName: string
  requestedByEmail: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  createdAt: string
  resolvedAt: string | null
}
