import SpesePage from './pages/SpesePage'
import ArchivioPage from './pages/ArchivioPage'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import CondominiPage from './pages/CondominiPage'
import CondominiDetailPage from './pages/CondominiDetailPage'
import AnagraficaPage from './pages/AnagraficaPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

<Route element={<ProtectedRoute />}>
  <Route element={<AppLayout />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/condomini" element={<CondominiPage />} />
    <Route path="/condomini/:id" element={<CondominiDetailPage />} />
    <Route path="/condomini/:condominioId/anagrafica" element={<AnagraficaPage />} />
    <Route path="/condomini/:condominioId/spese" element={<SpesePage />} />
    <Route path="/archivio" element={<ArchivioPage />} />
  </Route>
</Route>
         {/* Default */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
