import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

import AuthPage from './pages/AuthPage';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import TimetablesPage from './pages/TimetablesPage';
import TimetableOverviewPage from './pages/TimetableOverviewPage';
import TimetableEditorPage from './pages/TimetableEditorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CalendarPage from './pages/CalendarPage';
import HelpDocsPage from './pages/HelpDocsPage';
import MasterDataPage from './pages/MasterDataPage';
import UsersPage from './pages/UsersPage';
import { SettingsPage as MiscSettingsPage } from './pages/MiscPages';
import FacultyPage from './pages/config/FacultyPage';
import BellSchedulePage from './pages/config/BellSchedulePage';
import TimetableDetailsPage from './pages/config/TimetableDetailsPage';
import ClassroomsPage from './pages/config/ClassroomsPage';
import RoomsPage from './pages/config/RoomsPage';
import SubjectsPage from './pages/config/SubjectsPage';
import LessonsPage from './pages/config/LessonsPage';
import ConstraintsPage from './pages/config/ConstraintsPage';
import SettingsPage from './pages/config/SettingsPage';
import type { Timetable } from './types';
import './index.css';

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTimetable, setCurrentTimetable] = useState<Timetable | null>(null);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 16px', width: 52, height: 52, fontSize: 24 }}>CS</div>
          <p className="text-muted pulse">Loading ClassSync…</p>
        </div>
      </div>
    );
  }

  if (!user || user.must_change_password) {
    return <AuthPage />;
  }

  const restrictedForFaculty = [
    '/analytics', '/master-data', '/users', '/settings'
  ];

  if (user.role === 'faculty' && restrictedForFaculty.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/timetables" />;
  }

  const handleNavigate = (p: string, id?: string) => {
    let path = '/';
    if (p === 'dashboard') path = '/';
    else if (p === 'timetables') path = '/timetables';
    else if (p === 'timetable-overview') path = `/timetables/${id}`;
    else if (p === 'timetable-editor') path = `/timetables/${id}/editor`;
    else if (p.startsWith('config-')) {
      const section = p.replace('config-', '');
      path = `/timetables/${id}/config/${section}`;
    } else {
      path = `/${p}`;
    }
    navigate(path);
  };

  const goBackOverview = (id: string) => handleNavigate('timetable-overview', id);

  let activePage = 'dashboard';
  const path = location.pathname;
  if (path.startsWith('/timetables')) activePage = 'timetables';
  else if (path.startsWith('/calendar')) activePage = 'calendar';
  else if (path.startsWith('/analytics')) activePage = 'analytics';
  else if (path.startsWith('/help')) activePage = 'help';
  else if (path.startsWith('/master-data')) activePage = 'master-data';
  else if (path.startsWith('/users')) activePage = 'users';
  else if (path.startsWith('/settings')) activePage = 'settings';

  const match = path.match(/^\/timetables\/([^/]+)/);
  const timetableId = match ? match[1] : undefined;

  if (path.match(/^\/timetables\/([^/]+)\/editor/)) {
    return (
      <TimetableEditorPage
        timetableId={timetableId!}
        onBack={() => handleNavigate(user?.role === 'faculty' ? 'timetables' : 'timetable-overview', timetableId)}
      />
    );
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage onNavigate={handleNavigate} />} />
          <Route path="/timetables" element={<TimetablesPage onNavigate={handleNavigate} />} />
          <Route path="/timetables/:id" element={<TimetableOverviewPage timetableId={timetableId!} onNavigate={handleNavigate} />} />
          <Route path="/timetables/:id/config/details" element={<TimetableDetailsPage timetableId={timetableId!} timetable={currentTimetable} onBack={() => goBackOverview(timetableId!)} onSaved={t => setCurrentTimetable(t)} />} />
          <Route path="/timetables/:id/config/bell-schedule" element={<BellSchedulePage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/faculty" element={<FacultyPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/classrooms" element={<ClassroomsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/rooms" element={<RoomsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/subjects" element={<SubjectsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/lessons" element={<LessonsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/constraints" element={<ConstraintsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/timetables/:id/config/settings" element={<SettingsPage timetableId={timetableId!} onBack={() => goBackOverview(timetableId!)} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/help" element={<HelpDocsPage />} />
          <Route path="/master-data" element={<MasterDataPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<MiscSettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
