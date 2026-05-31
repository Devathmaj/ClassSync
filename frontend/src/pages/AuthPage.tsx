import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'change_credentials';

export default function AuthPage() {
  const { login, changeCredentials, user, logout } = useAuth();
  
  const initialMode = user && user.must_change_password ? 'change_credentials' : 'login';
  const [mode, setMode] = useState<Mode>(initialMode);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.must_change_password && mode !== 'change_credentials') {
      setMode('change_credentials');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [user, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else if (mode === 'change_credentials') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await changeCredentials(username, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <div className="auth-logo">
          <div className="sidebar-logo-icon">CS</div>
          <div>
            <div className="sidebar-logo-text">Class<span>Sync</span></div>
            <div className="text-xs text-muted">Smart scheduling for educators</div>
          </div>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Action Required'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to manage your timetables'
            : 'For your security, please update your username and password to continue.'}
        </p>

        {error && (
          <div className="info-note info-note-amber mb-4" style={{ marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{mode === 'change_credentials' ? 'New Username *' : 'Username *'}</label>
            <input
              id="auth-username"
              className="form-input"
              type="text"
              placeholder={mode === 'change_credentials' ? 'Choose a new username' : ''}
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{mode === 'change_credentials' ? 'New Password *' : 'Password *'}</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              placeholder=""
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {mode === 'change_credentials' && (
            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <input
                id="auth-confirm-password"
                className="form-input"
                type="password"
                placeholder=""
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            className="btn btn-primary w-full btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? '⏳ Please wait…' : mode === 'login' ? 'Sign In' : 'Update Credentials'}
          </button>
        </form>

        {mode === 'change_credentials' ? (
          <>
            <div className="divider" />
            <p className="text-sm text-muted" style={{ textAlign: 'center' }}>
              <button
                className="btn-ghost"
                style={{ color: 'var(--color-primary)', fontWeight: 600, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => logout()}
              >
                Sign out
              </button>
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
