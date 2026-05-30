import { useState } from 'react';

interface SettingsPageProps {
  timetableId: string;
  onBack: () => void;
}

export default function SettingsPage({ timetableId: _timetableId, onBack }: SettingsPageProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onBack();
    }, 1000);
  };

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Settings</span>
          </div>
          <h1 className="header-greeting">System Settings</h1>
          <p className="header-sub">Configure generation preferences and weights</p>
        </div>
        
      </div>

      <div className="page-content">
        <div className="card mb-4" style={{ maxWidth: 600 }}>
          <div className="card-header"><span className="card-title">Generation Settings</span></div>
          <div className="card-body">
            <div className="form-group mb-4">
              <label className="form-label">Max Execution Time (seconds)</label>
              <input type="number" className="form-input" defaultValue={300} />
              <div className="text-sm text-muted mt-1">Maximum time the AI will spend finding a schedule.</div>
            </div>
            
            <div className="form-group mb-4">
              <label className="form-label">Optimization Goal</label>
              <select className="form-input" defaultValue="balanced">
                <option value="fast">Fast (First Valid Schedule)</option>
                <option value="balanced">Balanced (Good Spread)</option>
                <option value="faculty_pref">Faculty Preferences (Minimize Gaps)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span className="font-bold text-sm">Strict Hard Constraints</span>
              </label>
              <div className="text-sm text-muted mt-1" style={{ marginLeft: 21 }}>If checked, generation will fail if hard constraints cannot be met.</div>
            </div>
          </div>
        </div>
      </div>
    
      </div>
      <div style={{ position: 'fixed', left: 'var(--sidebar-width)', right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', height: 64, padding: '0 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings →'}
        </button>
      </div>
    </>
  );
}
