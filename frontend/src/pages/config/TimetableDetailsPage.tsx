import { useState, useEffect } from 'react';
import { timetableApi } from '../../api';
import type { Timetable } from '../../types';

interface DetailsPageProps {
  timetableId: string;
  timetable: Timetable | null;
  onBack: () => void;
  onSaved: (t: Timetable) => void;
}

const TIPS = [
  { color: 'yellow', title: 'Descriptive Names Work Best', body: 'Use names like "2026-27 Science Block" to identify timetables at a glance.' },
  { color: 'blue', title: 'Academic Session is Optional', body: 'If filled, all three fields (name, start date, end date) should be completed.' },
  { color: 'green', title: 'Auto-Save Active', body: 'Changes are saved automatically every 5 seconds. Cloud icon shows sync status.' },
];

export default function TimetableDetailsPage({ timetableId, timetable, onBack, onSaved }: DetailsPageProps) {
  const [name, setName] = useState(timetable?.name || '');
  const [description, setDescription] = useState(timetable?.description || '');
  const [sessionName, setSessionName] = useState(timetable?.session_name || '');
  const [sessionStart, setSessionStart] = useState(timetable?.session_start || '');
  const [sessionEnd, setSessionEnd] = useState(timetable?.session_end || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!timetable) {
      timetableApi.get(timetableId).then(t => {
        setName(t.name);
        setDescription(t.description || '');
        setSessionName(t.session_name || '');
        setSessionStart(t.session_start || '');
        setSessionEnd(t.session_end || '');
        onSaved(t);
      }).catch(() => {});
    }
  }, [timetableId, timetable]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const updated = await timetableApi.update(timetableId, {
        name, description: description || undefined,
        session_name: sessionName || undefined,
        session_start: sessionStart || undefined,
        session_end: sessionEnd || undefined,
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onBack();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getDuration = () => {
    if (!sessionStart || !sessionEnd) return null;
    const days = Math.ceil((new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 86400000);
    return `Duration: ${days} days`;
  };

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Timetable Details</span>
          </div>
          <h1 className="header-greeting">Timetable Details</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && <span className="badge badge-green">☁️ Saved</span>}
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          {error && <div className="info-note info-note-amber mb-4" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

          <div className="card mb-4" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Basic Details</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Timetable Name *</label>
                <div className="form-sublabel">Max 100 characters</div>
                <input id="timetable-name" className="form-input" value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="e.g. Academic Year 2026-27" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <div className="form-sublabel">Optional — {description.length}/500 characters</div>
                <textarea id="timetable-desc" className="form-input" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="Brief description of this timetable…" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Academic Session (Optional)</span></div>
            <div className="card-body">
              <div className="info-note info-note-blue mb-4" style={{ marginBottom: 16 }}>
                ℹ️ If you choose to fill these, all three fields (name, start date, end date) should be completed for proper tracking.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Session Name</label>
                  <input id="session-name" className="form-input" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="e.g. 2026-27 Academic Year" />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input id="session-start" className="form-input" type="date" value={sessionStart} onChange={e => setSessionStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input id="session-end" className="form-input" type="date" value={sessionEnd} onChange={e => setSessionEnd(e.target.value)} />
                </div>
              </div>
              {getDuration() && (
                <div className="info-note info-note-green" style={{ marginTop: 8 }}>
                  ✅ {getDuration()} — Status: Currently Active
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Tips */}
        <div className="tips-panel">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--color-text-secondary)' }}>Tips & Tricks</div>
          {TIPS.map(tip => (
            <div key={tip.title} className={`tip-card tip-${tip.color}`}>
              <div className="tip-title">{tip.title}</div>
              <div>{tip.body}</div>
            </div>
          ))}
        </div>
      </div>

      </div>
      <div style={{ position: 'fixed', left: 'var(--sidebar-width)', right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', height: 64, padding: '0 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1 }} />
        <button id="save-continue-btn" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & Continue →'}
        </button>
      </div>
    </>
  );
}