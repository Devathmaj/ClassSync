import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { user } = useAuth();
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'institution' | 'faculty'>('institution');
  const [targetInstitutionId, setTargetInstitutionId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '', fullName: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const data = await usersApi.getHierarchy();
      setHierarchy(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'faculty') return;
    loadData();
  }, [user]);

  if (user?.role === 'faculty') {
    return (
      <div className="page-content" style={{ textAlign: 'center', marginTop: 100 }}>
        <h2>Access Denied</h2>
        <p className="text-muted">You do not have permission to view this page.</p>
      </div>
    );
  }

  const openModal = (type: 'institution' | 'faculty', institutionId?: string) => {
    if (type === 'faculty' && user?.role === 'admin' && hierarchy.length === 0) {
      alert('You must create an Institution first before you can add Faculty.');
      return;
    }
    setModalType(type);
    setTargetInstitutionId(institutionId || (hierarchy.length > 0 ? hierarchy[0].id : ''));
    setIsEditing(false);
    setEditUserId(null);
    setForm({ username: '', password: '', confirmPassword: '', fullName: '', email: '' });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (type: 'institution' | 'faculty', targetUser: any, instId?: string) => {
    setModalType(type);
    setIsEditing(true);
    setEditUserId(targetUser.id);
    setTargetInstitutionId(instId || '');
    setForm({ 
      username: targetUser.username || '', 
      password: '', 
      confirmPassword: '', 
      fullName: targetUser.full_name, 
      email: targetUser.email || '' 
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
    try {
      await usersApi.deleteUser(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleSave = async () => {
    if (!form.username || (!isEditing && !form.password) || !form.fullName) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEditing && editUserId) {
        await usersApi.updateUser(editUserId, {
          username: form.username,
          full_name: form.fullName,
          email: form.email || undefined,
          ...(form.password ? { password: form.password } : {})
        });
      } else {
        if (modalType === 'institution') {
          await usersApi.createInstitution(form.username, form.password, form.fullName, form.email);
        } else {
          await usersApi.createFaculty(form.username, form.password, form.fullName, targetInstitutionId, form.email);
        }
      }
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-content"><p className="text-muted pulse">Loading users...</p></div>;
  }

  return (
    <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <h1 className="header-greeting">User Management</h1>
          <p className="header-sub">Manage institutions and faculty accounts</p>
        </div>
        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => openModal('faculty')}>
              + Add Faculty
            </button>
            <button className="btn btn-primary" onClick={() => openModal('institution')}>
              + Add Institution
            </button>
          </div>
        )}
        {user?.role === 'institution' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => openModal('faculty', user.id)}>
              + Add Faculty
            </button>
          </div>
        )}
      </div>

      <div className="page-content">
        {hierarchy.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <h2>No Users Found</h2>
              <p className="text-muted">Get started by creating your first user.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {hierarchy.map(inst => (
              <div key={inst.id} className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="card-title font-bold" style={{ fontSize: 18 }}>🏢 {inst.full_name}</span>
                    <span className="badge badge-gray ml-2">@{inst.username}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(user?.role === 'admin' || user?.id === inst.id) && (
                      <button className="btn btn-outline btn-sm" onClick={() => openModal('faculty', inst.id)}>
                        + Add Faculty
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => openEditModal('institution', inst)}>Edit</button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleDelete(inst.id, inst.full_name)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="card-body" style={{ padding: 0 }}>
                  {inst.faculty_list.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No faculty members added yet.
                    </div>
                  ) : (
                    <details style={{ background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}>
                      <summary style={{ padding: '16px 24px', cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>
                        View Faculty Members ({inst.faculty_list.length})
                      </summary>
                      <table className="data-table">
                        <thead style={{ background: 'var(--color-surface)' }}>
                          <tr>
                            <th style={{ paddingLeft: 24 }}>Faculty Name</th>
                            <th>Short Name</th>
                            <th>Role</th>
                            <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody style={{ background: 'var(--color-surface)' }}>
                          {inst.faculty_list.map((fac: any) => (
                            <tr key={fac.id}>
                              <td style={{ paddingLeft: 24 }} className="font-semibold">👩‍🏫 {fac.full_name}</td>
                              <td><span className="badge">{fac.short_name}</span></td>
                              <td><span className="badge badge-green">Faculty</span></td>
                              <td style={{ textAlign: 'right', paddingRight: 24 }}>
                                {(user?.role === 'admin' || user?.id === inst.id) && (
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-sm btn-outline" onClick={() => openEditModal('faculty', fac, inst.id)}>Edit</button>
                                    <button className="btn btn-sm btn-outline" style={{ color: 'var(--color-danger)', borderColor: 'transparent' }} onClick={() => handleDelete(fac.id, fac.full_name)}>Delete</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-container" style={{ width: 500, maxWidth: '90vw' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditing 
                  ? `Edit ${modalType === 'institution' ? 'Institution' : 'Faculty'}`
                  : `Add New ${modalType === 'institution' ? 'Institution' : 'Faculty'}`}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="info-note info-note-amber" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
              
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input 
                  className="form-input" 
                  value={form.fullName} 
                  onChange={e => setForm({ ...form, fullName: e.target.value })} 
                  placeholder={modalType === 'institution' ? "e.g. Springfield High" : "e.g. Dr. Jane Smith"}
                />
              </div>

              {modalType === 'faculty' && user?.role === 'admin' && (
                <div className="form-group">
                  <label className="form-label">Assign to Institution *</label>
                  <select 
                    className="form-input"
                    value={targetInstitutionId}
                    onChange={e => setTargetInstitutionId(e.target.value)}
                  >
                    <option value="" disabled>Select an Institution</option>
                    {hierarchy.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.full_name} (@{inst.username})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Username *</label>
                <input 
                  className="form-input" 
                  value={form.username} 
                  onChange={e => setForm({ ...form, username: e.target.value })} 
                  placeholder="e.g. janesmith"
                />
                <div className="text-xs text-muted mt-1">They will use this to log in.</div>
              </div>

              <div className="form-group">
                <label className="form-label">{isEditing ? 'New Password' : 'Password'} {isEditing ? '(Optional)' : '*'}</label>
                <input 
                  className="form-input" 
                  type="password" 
                  value={form.password} 
                  onChange={e => setForm({ ...form, password: e.target.value })} 
                  placeholder={isEditing ? "Leave blank to keep unchanged" : "Min 8 characters"}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password {isEditing && !form.password ? '(Optional)' : '*'}</label>
                <input 
                  className="form-input" 
                  type="password" 
                  value={form.confirmPassword} 
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })} 
                  placeholder="Re-type password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input 
                  className="form-input" 
                  type="email"
                  value={form.email} 
                  onChange={e => setForm({ ...form, email: e.target.value })} 
                  placeholder="name@school.edu"
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
