import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppFeature, UserRole } from '@myinventory/shared'
import { AuthProvider } from '@renderer/contexts/AuthContext'
import { ChatProvider } from '@renderer/contexts/ChatContext'
import { ProtectedRoute } from '@renderer/components/auth/ProtectedRoute'
import { RoleRoute } from '@renderer/components/auth/RoleRoute'
import { FeatureRoute } from '@renderer/components/auth/FeatureRoute'
import { AppShell } from '@renderer/components/layout/AppShell'
import { OrganizationSearchPage } from '@renderer/pages/OrganizationSearchPage'
import { OrgLoginPage } from '@renderer/pages/OrgLoginPage'
import { HomePage } from '@renderer/pages/HomePage'
import { ProductsPage } from '@renderer/pages/ProductsPage'
import { WarehousesPage } from '@renderer/pages/WarehousesPage'
import { LocationsPage } from '@renderer/pages/LocationsPage'
import { InventoryPage } from '@renderer/pages/InventoryPage'
import { TransactionsPage } from '@renderer/pages/TransactionsPage'
import { UsersPage } from '@renderer/pages/UsersPage'
import { ChatPage } from '@renderer/pages/ChatPage'
import { FeaturePage } from '@renderer/pages/FeaturePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ChatProvider>
        <Routes>
          <Route path="/login" element={<OrganizationSearchPage />} />
          <Route path="/login/:orgSlug" element={<OrgLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/scan"
                element={
                  <FeatureRoute feature={AppFeature.SCAN}>
                    <FeaturePage title="Scan" description="Barcode scanning for warehouse operations." />
                  </FeatureRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <FeatureRoute feature={AppFeature.PRODUCTS}>
                    <ProductsPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <FeatureRoute feature={AppFeature.INVENTORY}>
                    <InventoryPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/receiving"
                element={
                  <FeatureRoute feature={AppFeature.RECEIVING}>
                    <FeaturePage title="Receiving" description="Receive stock into warehouse locations." />
                  </FeatureRoute>
                }
              />
              <Route
                path="/picking"
                element={
                  <FeatureRoute feature={AppFeature.PICKING}>
                    <FeaturePage title="Picking" description="Pick stock for outbound orders." />
                  </FeatureRoute>
                }
              />
              <Route
                path="/movement"
                element={
                  <FeatureRoute feature={AppFeature.MOVEMENT}>
                    <FeaturePage title="Stock movement" description="Move inventory between locations." />
                  </FeatureRoute>
                }
              />
              <Route
                path="/warehouses"
                element={
                  <FeatureRoute feature={AppFeature.WAREHOUSES}>
                    <WarehousesPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/locations"
                element={
                  <FeatureRoute feature={AppFeature.LOCATIONS}>
                    <LocationsPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <FeatureRoute feature={AppFeature.TRANSACTIONS}>
                    <TransactionsPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <FeatureRoute feature={AppFeature.CHAT}>
                    <ChatPage />
                  </FeatureRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <RoleRoute roles={[UserRole.ADMIN]}>
                    <FeatureRoute feature={AppFeature.USERS}>
                      <UsersPage />
                    </FeatureRoute>
                  </RoleRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        </ChatProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
