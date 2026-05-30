import { useTheme } from '../context/ThemeContext';

export function UsersPage() {
  return (
    <div className="fade-in">
      <div className="top-header">
        <h1 className="header-greeting">Users</h1>
      </div>
      <div className="page-content">
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <h2>User Management</h2>
          <p className="text-muted" style={{ marginTop: 8 }}>Manage organization members and their roles here.</p>
        </div></div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fade-in">
      <div className="top-header">
        <h1 className="header-greeting">Settings</h1>
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Appearance</span></div>
          <div className="card-body">
            <div className="form-group mb-4">
              <label className="form-label">Theme</label>
              <select 
                className="form-input" 
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              >
                <option value="light">Light Mode (Crisp & Clean)</option>
                <option value="dark">Dark Mode (Cyber Minimalist)</option>
              </select>
              <div className="text-sm text-muted mt-1">Select your preferred visual aesthetic.</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Organization Settings</span></div>
          <div className="card-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Organization settings and integrations are coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


