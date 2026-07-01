import ImpostazioniPage from './pages/ImpostazioniPage'
import MillesimiEditor from './components/MillesimiEditor'
import RipartizionePage from './pages/RipartizionePage'
import ConfigPagantePage from './pages/ConfigPagantePage'
import EstrattoContoPage from './pages/EstrattoContoPage'
import FattureFornitoriPage from './pages/FattureFornitoriPage'
import RiconciliazioniPage from './pages/RiconciliazioniPage'
import DashboardFinanziaria from './pages/DashboardFinanziaria'
import SpesePage from './pages/SpesePage'
import StoricoOperazioniPage from './pages/StoricoOperazioniPage'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { PlanProvider } from './hooks/usePlan'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import CondominiPage from './pages/CondominiPage'
import CondominiDetailPage from './pages/CondominiDetailPage'
import AnagraficaPage from './pages/AnagraficaPage'
import RiconciliazioniIncassiPage from './pages/RiconciliazioniIncassiPage'
import ComunicazioniPage from './pages/ComunicazioniPage'
import AssistenzaPage from './pages/AssistenzaPage'
import ModuloFiscalePage from './pages/ModuloFiscalePage'
import BackofficePage from './pages/BackofficePage'
import SuperAdminGuard from './components/SuperAdminGuard'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlanProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/condomini" element={<CondominiPage />} />
                <Route path="/anagrafica" element={<AnagraficaPage />} />
                <Route path="/condomini/:id" element={<CondominiDetailPage />} />
                <Route path="/condomini/:condominioId/anagrafica" element={<AnagraficaPage />} />
                <Route path="/condomini/:condominioId/spese" element={<SpesePage />} />
                <Route path="/archivio" element={<StoricoOperazioniPage />} />
                <Route path="/condomini/:condominioId/millesimi" element={<MillesimiEditor />} />
                <Route path="/condomini/:condominioId/ripartizione" element={<RipartizionePage />} />
                <Route path="/condomini/:condominioId/config-pagante" element={<ConfigPagantePage />} />
                <Route path="/condomini/:condominioId/estratto-conto" element={<EstrattoContoPage />} />
                <Route path="/condomini/:condominioId/fatture" element={<FattureFornitoriPage />} />
                <Route path="/condomini/:condominioId/riconciliazioni" element={<RiconciliazioniPage />} />
                <Route path="/condomini/:condominioId/riconciliazioni-incassi" element={<RiconciliazioniIncassiPage />} />
                <Route path="/condomini/:condominioId/dashboard-fin" element={<DashboardFinanziaria />} />
                <Route path="/comunicazioni" element={<ComunicazioniPage />} />
                <Route path="/fiscale" element={<ModuloFiscalePage />} />
                <Route path="/assistenza" element={<AssistenzaPage />} />
                <Route path="/impostazioni" element={<ImpostazioniPage />} />
                <Route element={<SuperAdminGuard />}>
                  <Route path="/backoffice" element={<BackofficePage />} />
                </Route>
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </PlanProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}