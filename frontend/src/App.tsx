import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';
import { HomePage } from './pages/HomePage';

// Lazy-loaded Secondary Pages for fast public landing & small initial bundle
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const EquipmentPage = React.lazy(() => import('./pages/EquipmentPage'));
const MyLoansPage = React.lazy(() =>
  import('./pages/MyLoansPage').then((m) => ({ default: m.MyLoansPage }))
);
const AdminLoansPage = React.lazy(() =>
  import('./pages/AdminLoansPage').then((m) => ({ default: m.AdminLoansPage }))
);
const AdminInventoryPage = React.lazy(() =>
  import('./pages/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage }))
);
const AdminRolesPage = React.lazy(() =>
  import('./pages/AdminRolesPage').then((m) => ({ default: m.AdminRolesPage }))
);
const AuditPage = React.lazy(() => import('./pages/AuditPage'));

const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Homepage & Equipment Catalog */}
              <Route
                path="/"
                element={
                  <Layout>
                    <HomePage />
                  </Layout>
                }
              />

              <Route
                path="/equipment"
                element={
                  <Layout>
                    <EquipmentPage />
                  </Layout>
                }
              />

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route
                path="/my-loans"
                element={
                  <ProtectedRoute allowedRoles={['BORROWER']}>
                    <Layout>
                      <MyLoansPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/loans"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Layout>
                      <AdminLoansPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/inventory"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Layout>
                      <AdminInventoryPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/roles"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Layout>
                      <AdminRolesPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Public Blockchain Audit Explorer */}
              <Route
                path="/audit"
                element={
                  <Layout>
                    <AuditPage />
                  </Layout>
                }
              />

              {/* Redirect legacy /overview to integrated Homepage */}
              <Route path="/overview" element={<Navigate to="/" replace />} />

              {/* Catch-All Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
