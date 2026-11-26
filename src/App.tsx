import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AppLayout } from './layouts/AppLayout.tsx';
import { AuthPage } from './pages/auth/AuthPage.tsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { MatterDetailPage } from './pages/matters/MatterDetailPage.tsx';
import { MattersListPage } from './pages/matters/MattersListPage.tsx';
import { NotificationsPage } from './pages/notifications/NotificationsPage.tsx';
import { SettingsPage } from './pages/settings/SettingsPage.tsx';
import { SpaceDetailPage } from './pages/spaces/SpaceDetailPage.tsx';
import { SpacesPage } from './pages/spaces/SpacesPage.tsx';
import { TimelinePage } from './pages/timeline/TimelinePage.tsx';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0C0E]">
        <div className="text-sm text-[#9CA3AF]">Loading LIFEOS...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="matters" element={<MattersListPage />} />
            <Route path="matters/:id" element={<MatterDetailPage />} />
            <Route path="spaces" element={<SpacesPage />} />
            <Route path="spaces/:id" element={<SpaceDetailPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
