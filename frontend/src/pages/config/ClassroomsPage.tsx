import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { classroomApi, facultyApi, timetableApi } from '../../api';
import type { Classroom, Faculty, Timetable } from '../../types';
import BulkImportModal from '../../components/bulk-import/BulkImportModal';
import { downloadCSV } from '../../utils/export';

interface ClassroomsPageProps {
  timetableId: string;
  onBack: () => void;
}

const emptyForm = { name: '', short_name: '', student_count: '', class_teacher_id: '' };

export default function ClassroomsPage({ timetableId, onBack }: ClassroomsPageProps) {
  const [attached, setAttached] = useState<Classroom[]>([]);
  const [catalog, setCatalog] = useState<Classroom[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);

  const [attaching, setAttaching] = useState<string | null>(null);

  const loadData = async () => {
    let tt = timetable;
    if (!tt) {
      tt = await timetableApi.get(timetableId);
      setTimetable(tt);
    }
    const [att, cat, facs] = await Promise.all([
      classroomApi.list(timetableId),
      classroomApi.listGlobal(tt.owner_id),
      facultyApi.listGlobal(tt.owner_id),
    ]);
    setAttached(att);
    setCatalog(cat);
    setFaculties(facs);
  };

  useEffect(() => {
    setLoading(true);
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const attachedIds = new Set(attached.map(c => c.id));
  const autoShort = (name: string) => name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (c: Classroom) => {
    setForm({ name: c.name, short_name: c.short_name, student_count: c.student_count?.toString() || '', class_teacher_id: c.class_teacher_id || '' });
    setEditId(c.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        short_name: form.short_name,
        student_count: form.student_count ? parseInt(form.student_count) : undefined,
        class_teacher_id: form.class_teacher_id || undefined,
        display_color: '#3B82F6',
      };
      if (editId) {
        await classroomApi.updateGlobal(editId, payload);
        await loadData();
      } else {
        const created = await classroomApi.createGlobal(payload, timetable?.owner_id);
        await classroomApi.attach(timetableId, created.id).catch(() => {});
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
    await classroomApi.detach(timetableId, id).catch(() => {});
    setAttached(prev => prev.filter(c => c.id !== id));
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('Delete this classroom globally? This removes it from all timetables.')) return;
    await classroomApi.deleteGlobal(id).catch(() => {});
    await loadData();
  };

  const handleAttach = async (id: string) => {
    setAttaching(id);
    try {
      await classroomApi.attach(timetableId, id);
      await loadData();
    } catch { /* ignore duplicate */ }
    finally { setAttaching(null); }
  };

  const filteredCatalog = catalog.filter(c =>
    !attachedIds.has(c.id) &&
    (catalogSearch === '' ||
      c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      c.short_name.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  const handleExport = () => {
    const headers = ['Class Name', 'Short Name', 'Class Teacher', 'Student Count'];
    const data = catalog.map(c => [
      c.name,
      c.short_name,
      c.class_teacher_id ? faculties.find(f => f.id === c.class_teacher_id)?.full_name || '' : '',
      c.student_count?.toString() || ''
    ]);
    downloadCSV('classrooms', headers, data);
  };

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Grades & Divisions</span>
          </div>
          <h1 className="header-greeting">Grades & Divisions</h1>
          <p className="header-sub">Manage student groups, grades, and class divisions</p>
        </div>
        <button id="add-classroom-btn" className="btn btn-primary" onClick={openCreateForm}>
          + Add New Grade / Division
        </button>
      </div>

      <div className="page-content">

        {/* Form */}
        {showForm && createPortal(
          <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
            <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 20 }}>{editId ? 'Edit Grade / Division' : 'Add New Grade / Division'}</h2>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditId(null); }}>×</button>
              </div>
              <div className="modal-body">
                {error && <div className="info-note info-note-amber" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input className="form-input" value={form.name} onChange={e => {
                      const name = e.target.value;
                      setForm(f => ({ ...f, name, short_name: f.short_name || autoShort(name) }));
                    }} placeholder="e.g. 10th Grade A" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Name *</label>
                    <input className="form-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value.toUpperCase() }))} placeholder="e.g. 10A" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Student Count (Optional)</label>
                    <input type="number" className="form-input" value={form.student_count} onChange={e => setForm(f => ({ ...f, student_count: e.target.value }))} placeholder="e.g. 40" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class Teacher (Optional)</label>
                    <select className="form-input" value={form.class_teacher_id} onChange={e => setForm(f => ({ ...f, class_teacher_id: e.target.value }))}>
                      <option value="">-- None --</option>
                      {faculties.map(f => (
                        <option key={f.id} value={f.id}>{f.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Section 1: Attached ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">📌 Grades & Divisions in This Timetable ({attached.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="card-body"><p className="text-sm text-muted pulse">Loading…</p></div>
            ) : attached.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏫</div>
                <p className="font-semibold">No grades attached yet</p>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>Create a new grade above or attach from the catalog below.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Short Name</th>
                    <th>Class Teacher</th>
                    <th>Students</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attached.map(c => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.name}</td>
                      <td><span className="badge">{c.short_name}</span></td>
                      <td>{c.class_teacher_id ? faculties.find(f => f.id === c.class_teacher_id)?.full_name || 'Unknown' : '—'}</td>
                      <td>{c.student_count || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEditForm(c)} title="Edit globally">✏️</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDetach(c.id)} title="Remove from timetable">🔗✕</button>
                          <button className="btn btn-red btn-sm" onClick={() => handleDeleteGlobal(c.id)} title="Delete globally">🗑️</button>
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
            <span className="card-title">🌐 Global Grades & Divisions Catalog ({catalog.length} total)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="catalog-search-classrooms"
                className="form-input"
                style={{ padding: '6px 10px', fontSize: 13, minWidth: 200 }}
                placeholder="🔍 Search catalog…"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
              />
              <button className="btn btn-outline btn-sm" onClick={handleExport}>
                📤 Export
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setShowBulkImport(true)}>
                📥 Bulk Import
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {filteredCatalog.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--color-text-muted)' }}>
                {catalog.length === 0
                  ? 'No grades in the global catalog yet. Create your first grade above.'
                  : 'All global grades are already attached to this timetable.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Short Name</th>
                    <th>Class Teacher</th>
                    <th>Students</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Attach</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(c => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.name}</td>
                      <td><span className="badge badge-gray">{c.short_name}</span></td>
                      <td>{c.class_teacher_id ? faculties.find(f => f.id === c.class_teacher_id)?.full_name || 'Unknown' : '—'}</td>
                      <td>{c.student_count || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          id={`attach-classroom-${c.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttach(c.id)}
                          disabled={attaching === c.id}
                        >
                          {attaching === c.id ? '…' : '+ Attach'}
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
          ℹ️ <strong>Global Catalog</strong>: Grades & Divisions are reusable across all timetables. Use <strong>+ Attach</strong> to add existing ones to this timetable. Detaching removes from this timetable only.
        </div>
      </div>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        title="Bulk Import Grades & Divisions"
        subtitle="Add multiple grades or divisions to your global catalog using a CSV file."
        expectedColumns={[
          { name: 'Class Name', required: true },
          { name: 'Short Name', required: false },
          { name: 'Class Teacher', required: false },
          { name: 'Student Count', required: false }
        ]}
        onImport={(file) => classroomApi.bulkImportGlobal(file, timetable?.owner_id)}
        onSuccess={() => loadData()}
        onDownloadTemplate={() => {
          const csvContent = "data:text/csv;charset=utf-8,Class Name,Short Name,Class Teacher,Student Count\nGrade 10 A,10A,John Doe,30\nGrade 10 B,10B,,28";
          const link = document.createElement("a");
          link.setAttribute("href", encodeURI(csvContent));
          link.setAttribute("download", "classrooms_template.csv");
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