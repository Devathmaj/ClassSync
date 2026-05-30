import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { timetableApi } from '../api';
import type { Timetable } from '../types';

interface TimetablesPageProps {
  onNavigate: (page: string, id?: string) => void;
}

export default function TimetablesPage({ onNavigate }: TimetablesPageProps) {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    academic_session: { name: '', start_date: '', end_date: '' },
  });

  useEffect(() => {
    timetableApi.list().then(setTimetables).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('Timetable Name is required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const payload: any = { name: form.name.trim(), description: form.description.trim() || undefined };
      if (form.academic_session.name || form.academic_session.start_date || form.academic_session.end_date) {
        payload.academic_session = form.academic_session;
      }
      const t = await timetableApi.create(payload);
      setTimetables(prev => [t, ...prev]);
      setShowCreateModal(false);
      setForm({ name: '', description: '', academic_session: { name: '', start_date: '', end_date: '' } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this timetable? This action cannot be undone.')) return;
    try {
      await timetableApi.delete(id);
      setTimetables(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert('Failed to delete timetable.');
    }
  };

  const published = timetables.filter(t => t.status === 'published');
  const drafts = timetables.filter(t => t.status === 'draft');

  return (
    <div className="fade-in">
      <div className="top-header">
        <div>
          <h1 className="header-greeting">My Timetables</h1>
          <p className="header-sub">Create, manage, and publish your timetables</p>
        </div>
        <button id="new-timetable-btn" className="btn btn-primary" onClick={() => { setShowCreateModal(true); setError(''); }}>
          + New Timetable
        </button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{timetables.length}</div>
            <div className="stat-label">Total Timetables</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-green)' }}>{published.length}</div>
            <div className="stat-label">Published</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-amber)' }}>{drafts.length}</div>
            <div className="stat-label">Drafts</div>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && createPortal(
          <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
            <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 20 }}>Create New Timetable</h2>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
              </div>
              <div className="modal-body">
                {error && <div className="info-note info-note-amber" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  <div>
                    <h3 className="font-semibold mb-4 text-sm" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>Basic Details</h3>
                    <div className="form-group">
                      <label className="form-label">Timetable Name *</label>
                      <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Academic Year 2026-27" maxLength={100} />
                      <div className="form-sublabel">Max 100 characters</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." rows={2} maxLength={500} />
                      <div className="form-sublabel">Optional — {form.description.length}/500 characters</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4 text-sm" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 8, marginTop: 8 }}>Academic Session (Optional)</h3>
                    <div className="info-note info-note-blue mb-4">
                      ℹ️ If you choose to fill these, all three fields (name, start date, end date) should be completed for proper tracking.
                    </div>
                    <div className="form-group">
                      <label className="form-label">Session Name</label>
                      <input className="form-input" value={form.academic_session.name} onChange={e => setForm({ ...form, academic_session: { ...form.academic_session, name: e.target.value } })} placeholder="e.g. 2026-2027 Full Year" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input className="form-input" type="date" value={form.academic_session.start_date} onChange={e => setForm({ ...form, academic_session: { ...form.academic_session, start_date: e.target.value } })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">End Date</label>
                        <input className="form-input" type="date" value={form.academic_session.end_date} onChange={e => setForm({ ...form, academic_session: { ...form.academic_session, end_date: e.target.value } })} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '16px 32px', borderTop: '1px solid var(--color-border)' }}>
                <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !form.name.trim()}>
                  {creating ? 'Creating…' : 'Create Timetable'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Published */}
        <div className="card mb-4" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Published Timetables</span>
            <span className="badge badge-green">{published.length}</span>
          </div>
          <div className="card-body">
            {loading ? (
              <p className="text-sm text-muted pulse">Loading…</p>
            ) : published.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <p className="font-semibold" style={{ marginBottom: 4 }}>No published timetables</p>
                <p className="text-sm text-muted">Publish a timetable to start using the substitute management system.</p>
              </div>
            ) : (
              <TimetableTable timetables={published} onOpen={id => onNavigate('timetable-overview', id)} onDelete={handleDelete} />
            )}
          </div>
        </div>

        {/* Drafts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Draft Timetables</span>
            <span className="badge badge-amber">{drafts.length}</span>
          </div>
          <div className="card-body">
            {loading ? (
              <p className="text-sm text-muted pulse">Loading…</p>
            ) : drafts.length === 0 ? (
              <p className="text-sm text-muted">No drafts. Create a timetable to get started.</p>
            ) : (
              <TimetableTable timetables={drafts} onOpen={id => onNavigate('timetable-overview', id)} onDelete={handleDelete} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimetableTable({ timetables, onOpen, onDelete }: { timetables: Timetable[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Created</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {timetables.map(t => (
          <tr key={t.id}>
            <td>
              <span className="font-semibold">{t.name}</span>
            </td>
            <td>
              <span className={`badge ${t.status === 'published' ? 'badge-green' : 'badge-amber'}`}>
                {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
              </span>
            </td>
            <td className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
            <td className="text-sm text-muted">{new Date(t.updated_at).toLocaleDateString('en-GB')}</td>
            <td>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  id={`open-timetable-${t.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpen(t.id)}
                >
                  Open
                </button>
                {t.status === 'draft' && (
                  <button
                    id={`publish-timetable-${t.id}`}
                    className="btn btn-green btn-sm"
                    onClick={async () => {
                      await timetableApi.publish(t.id);
                      window.location.reload();
                    }}
                  >
                    Publish
                  </button>
                )}
                <button
                  className="btn btn-red btn-sm"
                  onClick={() => onDelete(t.id)}
                  title="Delete Timetable"
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
