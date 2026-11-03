import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Spinner, Empty } from './components/ui';
import { LoginPage, ChangePasswordPage } from './pages/Login';

const p = <T,>(f: () => Promise<T>, k: keyof T) => lazy(() => f().then((m) => ({ default: m[k] as React.ComponentType })));
const Home = p(() => import('./pages/Home'), 'HomePage');
const Dashboard = p(() => import('./pages/Dashboard'), 'DashboardPage');
const Sweeps = p(() => import('./pages/Sweeps'), 'SweepsPage');
const Fleet = p(() => import('./pages/Fleet'), 'FleetPage');
const UnitDetail = p(() => import('./pages/UnitDetail'), 'UnitDetailPage');
const Ops = p(() => import('./pages/Operations'), 'OperationsPage');
const Alerts = p(() => import('./pages/Alerts'), 'AlertsPage');
const Incidents = p(() => import('./pages/Incidents'), 'IncidentsPage');
const IncidentDetail = p(() => import('./pages/IncidentDetail'), 'IncidentDetailPage');
const Protocols = p(() => import('./pages/Protocols'), 'ProtocolsPage');
const Cameras = p(() => import('./pages/Cameras'), 'CamerasPage');
const Risk = p(() => import('./pages/RiskMap'), 'RiskMapPage');
const Havens = p(() => import('./pages/Havens'), 'HavensPage');
const Immob = p(() => import('./pages/Immobilization'), 'ImmobilizationPage');
const Emergency = p(() => import('./pages/Emergency'), 'EmergencyPage');
const Operators = p(() => import('./pages/Operators'), 'OperatorsPage');
const Communiques = p(() => import('./pages/Communiques'), 'CommuniquesPage');
const Status = p(() => import('./pages/StatusReports'), 'StatusReportsPage');
const Handover = p(() => import('./pages/Handover'), 'HandoverPage');
const HandoverDetail = p(() => import('./pages/Handover'), 'HandoverDetailPage');
const Training = p(() => import('./pages/Training'), 'TrainingPage');
const Reports = p(() => import('./pages/Reports'), 'ReportsPage');
const Catalogs = p(() => import('./pages/Catalogs'), 'CatalogsPage');
const Users = p(() => import('./pages/Users'), 'UsersPage');
const Config = p(() => import('./pages/Config'), 'ConfigPage');
const Audit = p(() => import('./pages/Audit'), 'AuditPage');

export function App() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner label="Iniciando…" />;
  if (!me) return <LoginPage />;
  if (me.mustChangePwd) return <ChangePasswordPage />;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tablero" element={<Dashboard />} />
          <Route path="barridos" element={<Sweeps />} />
          <Route path="flota" element={<Fleet />} />
          <Route path="flota/:id" element={<UnitDetail />} />
          <Route path="seguimiento" element={<Ops />} />
          <Route path="alertas" element={<Alerts />} />
          <Route path="incidencias" element={<Incidents />} />
          <Route path="incidencias/:id" element={<IncidentDetail />} />
          <Route path="protocolos" element={<Protocols />} />
          <Route path="camaras" element={<Cameras />} />
          <Route path="zonas-riesgo" element={<Risk />} />
          <Route path="resguardos" element={<Havens />} />
          <Route path="inmovilizacion" element={<Immob />} />
          <Route path="emergencias" element={<Emergency />} />
          <Route path="operadores" element={<Operators />} />
          <Route path="comunicados" element={<Communiques />} />
          <Route path="estatus" element={<Status />} />
          <Route path="turnos" element={<Handover />} />
          <Route path="turnos/:id" element={<HandoverDetail />} />
          <Route path="capacitacion" element={<Training />} />
          <Route path="reportes" element={<Reports />} />
          <Route path="catalogos" element={<Catalogs />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="configuracion" element={<Config />} />
          <Route path="auditoria" element={<Audit />} />
          <Route path="*" element={<Empty title="Página no encontrada" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
