import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { MyLoansPage } from './pages/MyLoansPage';
import { AdminLoansPage } from './pages/AdminLoansPage';
import { AdminInventoryPage } from './pages/AdminInventoryPage';
import { AuditPage } from './pages/AuditPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/equipment"
            element={
              <ProtectedRoute>
                <Layout>
                  <EquipmentPage />
                </Layout>
              </ProtectedRoute>
            }
          />

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
            path="/audit"
            element={
              <ProtectedRoute>
                <Layout>
                  <AuditPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Root and Catch-All Redirects */}
          <Route path="/" element={<Navigate to="/equipment" replace />} />
          <Route path="*" element={<Navigate to="/equipment" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
