import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { facultyApi } from '../../api';
import type { Faculty } from '../../types';
import BulkImportModal from '../../components/bulk-import/BulkImportModal';

interface FacultyPageProps {
  timetableId: string;
  onBack: () => void;
}

const emptyForm = { full_name: '', short_name: '', email: '', phone: '', designation: '', role: 'Member' };

export default function FacultyPage({ timetableId, onBack }: FacultyPageProps) {
  // Timetable-attached faculty
  const [attached, setAttached] = useState<Faculty[]>([]);
  // Global catalog
  const [catalog, setCatalog] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Create / Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Attaching state
  const [attaching, setAttaching] = useState<string | null>(null);

  const loadData = async () => {
    const [att, cat] = await Promise.all([
      facultyApi.list(timetableId),
      facultyApi.listGlobal(),
    ]);
    setAttached(att);
    setCatalog(cat);
  };

  useEffect(() => {
    setLoading(true);
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const attachedIds = new Set(attached.map(f => f.id));

  const autoShort = (name: string) => name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, full_name: name, short_name: f.short_name || autoShort(name) }));
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (f: Faculty) => {
    setForm({ full_name: f.full_name, short_name: f.short_name, email: f.email || '', phone: f.phone || '', designation: f.designation || '', role: f.role });
    setEditId(f.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = { ...form };
    if (!payload.email) delete payload.email;
    if (!payload.phone) delete payload.phone;
    if (!payload.designation) delete payload.designation;
    try {
      if (editId) {
        // Update globally
        await facultyApi.updateGlobal(editId, payload);
        await loadData();
      } else {
        // Create globally + auto-attach to timetable
        const created = await facultyApi.createGlobal(payload);
        await facultyApi.attach(timetableId, created.id).catch(() => {});
        await loadData();
      }
      setShowForm(false);
      setEditId(null);
      setForm({ ...emptyForm });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDetach = async (id: string) => {
    await facultyApi.detach(timetableId, id).catch(() => {});
    setAttached(prev => prev.filter(f => f.id !== id));
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('Delete this faculty member globally? This will remove them from all timetables.')) return;
    await facultyApi.deleteGlobal(id).catch(() => {});
    await loadData();
  };

  const handleAttach = async (id: string) => {
    setAttaching(id);
    try {
      await facultyApi.attach(timetableId, id);
      await loadData();
    } catch { /* ignore duplicate */ }
    finally { setAttaching(null); }
  };

  const filteredCatalog = catalog.filter(f =>
    !attachedIds.has(f.id) &&
    (catalogSearch === '' ||
      f.full_name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      f.short_name.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Faculty</span>
          </div>
          <h1 className="header-greeting">Faculty</h1>
          <p className="header-sub">Manage teachers, instructors, and teaching staff</p>
        </div>
        <button id="add-faculty-btn" className="btn btn-primary" onClick={openCreateForm}>
          + Add New Faculty
        </button>
      </div>

      <div className="page-content">

        {/* Create / Edit Form */}
        {showForm && createPortal(
          <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
            <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 20 }}>{editId ? 'Edit Faculty' : 'Add New Faculty'}</h2>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditId(null); }}>×</button>
              </div>
              <div className="modal-body">
                {error && <div className="info-note info-note-amber" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input id="faculty-name" className="form-input" value={form.full_name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Dr. Jane Smith" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Name *</label>
                    <input id="faculty-short" className="form-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value.toUpperCase() }))} placeholder="e.g. JNS" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input id="faculty-email" className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@school.edu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input id="faculty-phone" className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9999999999" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input id="faculty-designation" className="form-input" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g. Head of Department" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select id="faculty-role" className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option>Member</option>
                      <option>Admin</option>
                      <option>Guest</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
                <button id="save-faculty-btn" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Faculty'}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Section 1: Attached Faculty ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">📌 Faculty in This Timetable ({attached.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="card-body"><p className="text-sm text-muted pulse">Loading…</p></div>
            ) : attached.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👩‍🏫</div>
                <p className="font-semibold">No faculty attached yet</p>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>Create new faculty above or attach from the global catalog below.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Short Name</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Availability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attached.map(f => (
                    <tr key={f.id}>
                      <td className="font-semibold">{f.full_name}</td>
                      <td><span className="badge badge-gray">{f.short_name}</span></td>
                      <td className="text-muted">{f.designation || '—'}</td>
                      <td className="text-muted">{f.email || '—'}</td>
                      <td><span className="badge badge-green">{f.availability}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button id={`edit-faculty-${f.id}`} className="btn btn-outline btn-sm" onClick={() => openEditForm(f)} title="Edit globally">✏️</button>
                          <button id={`detach-faculty-${f.id}`} className="btn btn-outline btn-sm" onClick={() => handleDetach(f.id)} title="Remove from this timetable">🔗✕</button>
                          <button id={`delete-faculty-${f.id}`} className="btn btn-red btn-sm" onClick={() => handleDeleteGlobal(f.id)} title="Delete globally">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Section 2: Global Catalog ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🌐 Global Faculty Catalog ({catalog.length} total)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="catalog-search-faculty"
                className="form-input"
                style={{ padding: '6px 10px', fontSize: 13, minWidth: 200 }}
                placeholder="🔍 Search catalog…"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
              />
              <button className="btn btn-outline btn-sm" onClick={() => setShowBulkImport(true)}>
                📥 Bulk Import
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {filteredCatalog.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--color-text-muted)' }}>
                {catalog.length === 0
                  ? 'No faculty in the global catalog yet. Create your first faculty member above.'
                  : 'All global faculty are already attached to this timetable.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Short Name</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Attach</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(f => (
                    <tr key={f.id}>
                      <td className="font-semibold">{f.full_name}</td>
                      <td><span className="badge badge-gray">{f.short_name}</span></td>
                      <td className="text-muted">{f.designation || '—'}</td>
                      <td className="text-muted">{f.email || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          id={`attach-faculty-${f.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttach(f.id)}
                          disabled={attaching === f.id}
                          title="Attach to this timetable"
                        >
                          {attaching === f.id ? '…' : '+ Attach'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="info-note info-note-blue" style={{ marginTop: 12 }}>
          ℹ️ <strong>Global Catalog</strong>: Faculty created here are reusable across all timetables. Use <strong>+ Attach</strong> to link existing faculty to this timetable. Detaching (🔗✕) removes from timetable only — the faculty remains in the global catalog.
        </div>
      </div>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        title="Bulk Import Faculty"
        subtitle="Add multiple faculty members to your global catalog using a CSV file."
        expectedColumns={[
          { name: 'Name', required: true },
          { name: 'Short Name', required: false },
          { name: 'Email', required: false },
          { name: 'Phone', required: false },
          { name: 'Designation', required: false },
          { name: 'Role', required: false }
        ]}
        onImport={(file) => facultyApi.bulkImportGlobal(file)}
        onSuccess={() => loadData()}
        onDownloadTemplate={() => {
          const csvContent = "data:text/csv;charset=utf-8,Name,Short Name,Email,Phone,Designation,Role\nJane Doe,JDOE,jane@school.edu,555-0100,Senior Teacher,Member\nJohn Smith,JSM,john@school.edu,,Substitute,Guest";
          const link = document.createElement("a");
          link.setAttribute("href", encodeURI(csvContent));
          link.setAttribute("download", "faculty_template.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />

      </div>
      <div style={{ position: 'fixed', left: 'var(--sidebar-width)', right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', height: 64, padding: '0 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onBack}>
          Save & Continue →
        </button>
      </div>
    </>
  );
}