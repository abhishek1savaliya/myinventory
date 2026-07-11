export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAREHOUSE_USER = 'WAREHOUSE_USER',
  PICKER = 'PICKER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum WarehouseStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum LocationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TransactionType {
  STOCK_RECEIVED = 'STOCK_RECEIVED',
  STOCK_MOVED = 'STOCK_MOVED',
  STOCK_PICKED = 'STOCK_PICKED',
  STOCK_ADJUSTED = 'STOCK_ADJUSTED',
  STOCK_RETURNED = 'STOCK_RETURNED',
}

export enum AdjustmentReason {
  DAMAGE = 'DAMAGE',
  LOST = 'LOST',
  FOUND = 'FOUND',
  COUNT_CORRECTION = 'COUNT_CORRECTION',
  OTHER = 'OTHER',
}

export interface ApiError {
  error: string
  message: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export type { AuthUser, LoginResponse, JwtPayload } from './auth.js'
export type { ProductDto, ProductImageDto, WarehouseDto, LocationDto } from './catalog.js'
export type {
  InventoryItemDto,
  InventoryTransactionDto,
  StockOperationResult,
  MoveStockResult,
} from './inventory.js'
export type { UserDisableRequestDto } from './users.js'
export type { ChatUserSummary, ChatMessageDto, ChatConversationSummary, ChatDeliveryStatus, ChatMessageReplyPreview } from './chat.js'
export {
  ChatAttachmentType,
  CHAT_MAX_IMAGE_BYTES,
  CHAT_MAX_VIDEO_BYTES,
  CHAT_MAX_FILE_BYTES,
  getChatDeliveryStatus,
  getChatMessagePreview,
  formatChatLastSeen,
} from './chat.js'
export type {
  OrganizationBranding,
  OrganizationSummary,
  OrganizationSignupResponse,
  OrganizationPublicProfile,
  OrganizationSearchResult,
} from './organization.js'
export { AppFeature, ALL_APP_FEATURES, FEATURE_LABELS, ROLE_DEFAULT_FEATURES, getEffectiveFeatures, computeExtraFeatures } from './features.js'
export {
  slugifyOrganizationName,
  orgCodePrefixFromName,
  randomOrgCodeSuffix,
  buildOrgCode,
} from '../utils/organization.js'
