import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { subjectApi } from '../../api';
import type { Subject } from '../../types';
import BulkImportModal from '../../components/bulk-import/BulkImportModal';

interface SubjectsPageProps {
  timetableId: string;
  onBack: () => void;
}

const emptyForm = { name: '', short_name: '', description: '', display_color: '#8B5CF6' };

export default function SubjectsPage({ timetableId, onBack }: SubjectsPageProps) {
  const [attached, setAttached] = useState<Subject[]>([]);
  const [catalog, setCatalog] = useState<Subject[]>([]);
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
    const [att, cat] = await Promise.all([
      subjectApi.list(timetableId),
      subjectApi.listGlobal(),
    ]);
    setAttached(att);
    setCatalog(cat);
  };

  useEffect(() => {
    setLoading(true);
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const attachedIds = new Set(attached.map(s => s.id));
  const autoShort = (name: string) => name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (s: Subject) => {
    setForm({ name: s.name, short_name: s.short_name, description: s.description || '', display_color: s.display_color });
    setEditId(s.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Subject name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        short_name: form.short_name,
        description: form.description || undefined,
        display_color: form.display_color,
      };
      if (editId) {
        await subjectApi.updateGlobal(editId, payload);
        await loadData();
      } else {
        const created = await subjectApi.createGlobal(payload);
        await subjectApi.attach(timetableId, created.id).catch(() => {});
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
    await subjectApi.detach(timetableId, id).catch(() => {});
    setAttached(prev => prev.filter(s => s.id !== id));
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('Delete this subject globally? This removes it from all timetables.')) return;
    await subjectApi.deleteGlobal(id).catch(() => {});
    await loadData();
  };

  const handleAttach = async (id: string) => {
    setAttaching(id);
    try {
      await subjectApi.attach(timetableId, id);
      await loadData();
    } catch { /* ignore duplicate */ }
    finally { setAttaching(null); }
  };

  const filteredCatalog = catalog.filter(s =>
    !attachedIds.has(s.id) &&
    (catalogSearch === '' ||
      s.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      s.short_name.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Subjects & Activities</span>
          </div>
          <h1 className="header-greeting">Subjects & Activities</h1>
          <p className="header-sub">Manage academic subjects and non-academic activities</p>
        </div>
        <button id="add-subject-btn" className="btn btn-primary" onClick={openCreateForm}>
          + Add New Subject / Activity
        </button>
      </div>

      <div className="page-content">

        {/* Form */}
        {showForm && createPortal(
          <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
            <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 20 }}>{editId ? 'Edit Subject / Activity' : 'Add New Subject / Activity'}</h2>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditId(null); }}>×</button>
              </div>
              <div className="modal-body">
                {error && <div className="info-note info-note-amber" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input id="subject-name" className="form-input" value={form.name} onChange={e => {
                      const name = e.target.value;
                      setForm(f => ({ ...f, name, short_name: f.short_name || autoShort(name) }));
                    }} placeholder="e.g. Mathematics or Sports" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Name *</label>
                    <input id="subject-short" className="form-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value.toUpperCase() }))} placeholder="e.g. MATH" maxLength={10} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Description (Optional)</label>
                    <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Core curriculum math subject" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Color</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={form.display_color} onChange={e => setForm(f => ({ ...f, display_color: e.target.value }))} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                      <input className="form-input" value={form.display_color} onChange={e => setForm(f => ({ ...f, display_color: e.target.value }))} placeholder="#8B5CF6" style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
                <button id="save-subject-btn" className="btn btn-primary" onClick={handleSave} disabled={saving}>
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
            <span className="card-title">📌 Subjects & Activities in This Timetable ({attached.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="card-body"><p className="text-sm text-muted pulse">Loading…</p></div>
            ) : attached.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
                <p className="font-semibold">No subjects attached yet</p>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>Create a new subject above or attach from the global catalog below.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject / Activity</th>
                    <th>Short Name</th>
                    <th>Description</th>
                    <th>Color</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attached.map(s => (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.name}</td>
                      <td>
                        <span className="badge" style={{ background: s.display_color, color: 'white' }}>{s.short_name}</span>
                      </td>
                      <td className="text-muted">{s.description || '—'}</td>
                      <td>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: s.display_color, border: '1px solid rgba(0,0,0,0.1)' }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEditForm(s)} title="Edit globally">✏️</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDetach(s.id)} title="Remove from timetable">🔗✕</button>
                          <button className="btn btn-red btn-sm" onClick={() => handleDeleteGlobal(s.id)} title="Delete globally">🗑️</button>
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
            <span className="card-title">🌐 Global Subjects & Activities Catalog ({catalog.length} total)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="catalog-search-subjects"
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
                  ? 'No subjects in the global catalog yet. Create your first subject above.'
                  : 'All global subjects are already attached to this timetable.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject / Activity</th>
                    <th>Short Name</th>
                    <th>Description</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Attach</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(s => (
                    <tr key={s.id}>
                      <td className="font-semibold">{s.name}</td>
                      <td>
                        <span className="badge" style={{ background: s.display_color, color: 'white' }}>{s.short_name}</span>
                      </td>
                      <td className="text-muted">{s.description || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          id={`attach-subject-${s.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttach(s.id)}
                          disabled={attaching === s.id}
                        >
                          {attaching === s.id ? '…' : '+ Attach'}
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
          ℹ️ <strong>Global Catalog</strong>: Subjects & Activities are reusable across all timetables. Use <strong>+ Attach</strong> to add existing ones to this timetable. Detaching removes from this timetable only.
        </div>
      </div>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        title="Bulk Import Subjects & Activities"
        subtitle="Add multiple subjects or activities to your global catalog using a CSV file."
        expectedColumns={[
          { name: 'Subject Name', required: true },
          { name: 'Short Name', required: false },
          { name: 'Description', required: false }
        ]}
        onImport={(file) => subjectApi.bulkImportGlobal(file)}
        onSuccess={() => loadData()}
        onDownloadTemplate={() => {
          const csvContent = "data:text/csv;charset=utf-8,Subject Name,Short Name,Description\nMathematics,MATH,Core math subject\nPhysical Education,PE,Sports and activities";
          const link = document.createElement("a");
          link.setAttribute("href", encodeURI(csvContent));
          link.setAttribute("download", "subjects_template.csv");
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