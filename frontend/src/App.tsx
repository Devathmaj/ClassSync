import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import { UsersPage, SettingsPage as MiscSettingsPage } from './pages/MiscPages';
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

type Page =
  | 'dashboard' | 'timetables' | 'calendar' | 'analytics' | 'help'
  | 'users' | 'master-data' | 'settings'
  | 'timetable-overview' | 'timetable-editor'
  | 'config-details' | 'config-bell-schedule' | 'config-faculty'
  | 'config-classrooms' | 'config-rooms' | 'config-subjects' | 'config-lessons'
  | 'config-settings' | 'config-constraints';

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>(() => (localStorage.getItem('tm_page') as Page) || 'dashboard');
  const [timetableId, setTimetableId] = useState<string | null>(() => localStorage.getItem('tm_timetableId'));

  useEffect(() => {
    localStorage.setItem('tm_page', page);
    if (timetableId) localStorage.setItem('tm_timetableId', timetableId);
    else localStorage.removeItem('tm_timetableId');
  }, [page, timetableId]);
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

  if (!user) return <AuthPage />;

  const navigate = (p: string, id?: string) => {
    setPage(p as Page);
    if (id) setTimetableId(id);
  };

  // Full-screen pages (no sidebar)
  if (page === 'timetable-editor' && timetableId) {
    return (
      <TimetableEditorPage
        timetableId={timetableId}
        onBack={() => setPage('timetable-overview')}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'timetables':
        return <TimetablesPage onNavigate={navigate} />;
      case 'timetable-overview':
        return timetableId ? (
          <TimetableOverviewPage timetableId={timetableId} onNavigate={navigate} />
        ) : <TimetablesPage onNavigate={navigate} />;
      case 'config-details':
        return timetableId ? (
          <TimetableDetailsPage
            timetableId={timetableId}
            timetable={currentTimetable}
            onBack={() => setPage('timetable-overview')}
            onSaved={t => setCurrentTimetable(t)}
          />
        ) : null;
      case 'config-bell-schedule':
        return timetableId ? (
          <BellSchedulePage timetableId={timetableId} onBack={() => setPage('timetable-overview')} />
        ) : null;
      case 'config-faculty':
        return timetableId ? (
          <FacultyPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} />
        ) : null;
      case 'config-classrooms':
        return timetableId ? <ClassroomsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'config-rooms':
        return timetableId ? <RoomsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'config-subjects':
        return timetableId ? <SubjectsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'config-lessons':
        return timetableId ? <LessonsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'config-constraints':
        return timetableId ? <ConstraintsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'config-settings':
        return timetableId ? <SettingsPage timetableId={timetableId} onBack={() => setPage('timetable-overview')} /> : null;
      case 'calendar': return <CalendarPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'help': return <HelpDocsPage />;
      case 'master-data': return <MasterDataPage />;
      case 'users': return <UsersPage />;
      case 'settings': return <MiscSettingsPage />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={page} onNavigate={navigate} />
      <div className="main-content">
        {renderPage()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
