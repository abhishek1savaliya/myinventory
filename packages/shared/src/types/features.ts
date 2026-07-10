export enum AppFeature {
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  PRODUCTS = 'PRODUCTS',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  INVENTORY = 'INVENTORY',
  RECEIVING = 'RECEIVING',
  PICKING = 'PICKING',
  MOVEMENT = 'MOVEMENT',
  WAREHOUSES = 'WAREHOUSES',
  LOCATIONS = 'LOCATIONS',
  TRANSACTIONS = 'TRANSACTIONS',
  USERS = 'USERS',
  SETTINGS = 'SETTINGS',
  CHAT = 'CHAT',
}

export const ALL_APP_FEATURES = Object.values(AppFeature)

export const FEATURE_LABELS: Record<AppFeature, string> = {
  [AppFeature.DASHBOARD]: 'Dashboard',
  [AppFeature.SCAN]: 'Scan',
  [AppFeature.PRODUCTS]: 'Products',
  [AppFeature.PRODUCT_DELETE]: 'Delete products',
  [AppFeature.INVENTORY]: 'Inventory',
  [AppFeature.RECEIVING]: 'Receiving',
  [AppFeature.PICKING]: 'Picking',
  [AppFeature.MOVEMENT]: 'Stock movement',
  [AppFeature.WAREHOUSES]: 'Warehouses',
  [AppFeature.LOCATIONS]: 'Locations',
  [AppFeature.TRANSACTIONS]: 'Transactions',
  [AppFeature.USERS]: 'Users',
  [AppFeature.SETTINGS]: 'Settings',
  [AppFeature.CHAT]: 'Chat',
}

export const ROLE_DEFAULT_FEATURES: Record<string, AppFeature[]> = {
  ADMIN: ALL_APP_FEATURES,
  MANAGER: [
    AppFeature.DASHBOARD,
    AppFeature.SCAN,
    AppFeature.PRODUCTS,
    AppFeature.INVENTORY,
    AppFeature.RECEIVING,
    AppFeature.PICKING,
    AppFeature.MOVEMENT,
    AppFeature.WAREHOUSES,
    AppFeature.LOCATIONS,
    AppFeature.TRANSACTIONS,
    AppFeature.SETTINGS,
    AppFeature.CHAT,
  ],
  WAREHOUSE_USER: [
    AppFeature.DASHBOARD,
    AppFeature.SCAN,
    AppFeature.PRODUCTS,
    AppFeature.INVENTORY,
    AppFeature.RECEIVING,
    AppFeature.PICKING,
    AppFeature.MOVEMENT,
    AppFeature.WAREHOUSES,
    AppFeature.LOCATIONS,
    AppFeature.TRANSACTIONS,
    AppFeature.CHAT,
  ],
  PICKER: [
    AppFeature.SCAN,
    AppFeature.RECEIVING,
    AppFeature.PICKING,
    AppFeature.MOVEMENT,
    AppFeature.CHAT,
  ],
}

export function getEffectiveFeatures(role: string, extraFeatures: AppFeature[]): AppFeature[] {
  const defaults = ROLE_DEFAULT_FEATURES[role] ?? []
  return [...new Set([...defaults, ...extraFeatures])]
}

export function computeExtraFeatures(role: string, selectedFeatures: AppFeature[]): AppFeature[] {
  const defaults = new Set(ROLE_DEFAULT_FEATURES[role] ?? [])
  return selectedFeatures.filter((feature) => !defaults.has(feature))
}
