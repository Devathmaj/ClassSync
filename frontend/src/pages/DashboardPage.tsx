import { useEffect, useState } from 'react';
import { timetableApi, analyticsApi } from '../api';
import type { Timetable, DashboardStats } from '../types';
import { useAuth } from '../context/AuthContext';


interface DashboardPageProps {
  onNavigate: (page: string, id?: string) => void;
}



export default function DashboardPage({ onNavigate }: DashboardPageProps) {

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    analyticsApi.dashboard().then(setStats).catch(() => {});
    timetableApi.list().then(setTimetables).catch(() => {});
  }, []);

  return (
    <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Removed */}

      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: 1000, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stats Row */}
        {(user?.role !== 'faculty' ? stats : true) && (
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{user?.role === 'faculty' ? timetables.length : stats?.total_timetables}</div>
              <div className="stat-label">Total Timetables</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--color-green)' }}>{user?.role === 'faculty' ? timetables.filter(t => t.status === 'published').length : stats?.published}</div>
              <div className="stat-label">Published</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--color-amber)' }}>{user?.role === 'faculty' ? timetables.filter(t => t.status === 'draft').length : stats?.drafts}</div>
              <div className="stat-label">Drafts</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header"><span className="card-title">Quick Actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'My Timetables', icon: '📅', color: 'var(--color-blue)', page: 'timetables' },
                { label: 'Reports & Analytics', icon: '📊', color: 'var(--color-orange)', page: 'analytics' },
                { label: 'Manage Users', icon: '👥', color: 'var(--color-green)', page: 'users' },
                { label: 'View Calendar', icon: '📆', color: 'var(--color-green)', page: 'calendar' },
              ].filter(action => {
                if (user?.role !== 'faculty') return true;
                return action.page !== 'analytics' && action.page !== 'users';
              }).map(action => (
                <button
                  key={action.page}
                  id={`quick-action-${action.page}`}
                  className="btn btn-outline w-full"
                  style={{ justifyContent: 'flex-start', gap: 10, borderLeft: `4px solid ${action.color}` }}
                  onClick={() => onNavigate(action.page)}
                >
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* My Schedule */}
          <div className="card">
            <div className="card-header"><span className="card-title">My Schedule</span></div>
            <div className="card-body">
              {timetables.filter(t => t.status === 'published').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                  <p className="font-semibold" style={{ marginBottom: 6 }}>No published timetable at the moment</p>
                  <p className="text-sm text-muted">Your schedule will appear once timetables are published.</p>
                </div>
              ) : (
                <p className="text-sm">Published timetables will appear here.</p>
              )}
            </div>
          </div>
        </div>

        {/* Help Banner */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>📖</div>
              <div>
                <h3 className="font-semibold" style={{ fontSize: 16, marginBottom: 4 }}>Need help with anything?</h3>
                <p className="text-sm text-muted">Access our comprehensive Help Documentation to learn how to set up, configure, and generate your school timetables.</p>
              </div>
            </div>
            <button 
              id="dashboard-help-docs" 
              className="btn btn-primary"
              onClick={() => onNavigate('help')}
            >
              Open Help Docs
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
