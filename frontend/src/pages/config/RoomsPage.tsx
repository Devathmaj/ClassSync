import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { roomApi, timetableApi } from '../../api';
import type { Room, Timetable } from '../../types';
import BulkImportModal from '../../components/bulk-import/BulkImportModal';
import { downloadCSV } from '../../utils/export';

interface RoomsPageProps {
  timetableId: string;
  onBack: () => void;
}

const emptyForm = { name: '', short_name: '', capacity: '', building_name: '' };

export default function RoomsPage({ timetableId, onBack }: RoomsPageProps) {
  const [attached, setAttached] = useState<Room[]>([]);
  const [catalog, setCatalog] = useState<Room[]>([]);
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
    const [att, cat] = await Promise.all([
      roomApi.list(timetableId),
      roomApi.listGlobal(tt.owner_id),
    ]);
    setAttached(att);
    setCatalog(cat);
  };

  useEffect(() => {
    setLoading(true);
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const attachedIds = new Set(attached.map(r => r.id));
  const autoShort = (name: string) => name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (r: Room) => {
    setForm({ name: r.name, short_name: r.short_name, capacity: r.capacity?.toString() || '', building_name: r.building_name || '' });
    setEditId(r.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Room name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        short_name: form.short_name,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        building_name: form.building_name || undefined,
        display_color: '#6366F1',
      };
      if (editId) {
        await roomApi.updateGlobal(editId, payload);
        await loadData();
      } else {
        const created = await roomApi.createGlobal(payload, timetable?.owner_id);
        await roomApi.attach(timetableId, created.id).catch(() => {});
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
    await roomApi.detach(timetableId, id).catch(() => {});
    setAttached(prev => prev.filter(r => r.id !== id));
  };

  const handleDeleteGlobal = async (id: string) => {
    if (!confirm('Delete this room globally? This removes it from all timetables.')) return;
    await roomApi.deleteGlobal(id).catch(() => {});
    await loadData();
  };

  const handleAttach = async (id: string) => {
    setAttaching(id);
    try {
      await roomApi.attach(timetableId, id);
      await loadData();
    } catch { /* ignore duplicate */ }
    finally { setAttaching(null); }
  };

  const filteredCatalog = catalog.filter(r =>
    !attachedIds.has(r.id) &&
    (catalogSearch === '' ||
      r.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      r.short_name.toLowerCase().includes(catalogSearch.toLowerCase()))
  );

  const handleExport = () => {
    const headers = ['Room Name', 'Short Name', 'Capacity', 'Room Group Name'];
    const data = catalog.map(r => [
      r.name,
      r.short_name,
      r.capacity?.toString() || '',
      r.building_name || ''
    ]);
    downloadCSV('rooms', headers, data);
  };

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Rooms & Labs</span>
          </div>
          <h1 className="header-greeting">Rooms & Labs</h1>
          <p className="header-sub">Manage physical spaces available for classes</p>
        </div>
        <button id="add-room-btn" className="btn btn-primary" onClick={openCreateForm}>
          + Add New Room
        </button>
      </div>

      <div className="page-content">

        {/* Form */}
        {showForm && createPortal(
          <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
            <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 20 }}>{editId ? 'Edit Room' : 'Add New Room'}</h2>
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
                    }} placeholder="e.g. Physics Lab" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Name *</label>
                    <input className="form-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value.toUpperCase() }))} placeholder="e.g. PHLAB" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity (Optional)</label>
                    <input type="number" className="form-input" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 30" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Building Name (Optional)</label>
                    <input className="form-input" value={form.building_name} onChange={e => setForm(f => ({ ...f, building_name: e.target.value }))} placeholder="e.g. Science Block" />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Room'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Section 1: Attached Rooms ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">📌 Rooms in This Timetable ({attached.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="card-body"><p className="text-sm text-muted pulse">Loading…</p></div>
            ) : attached.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏛️</div>
                <p className="font-semibold">No rooms attached yet</p>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>Create a new room above or attach from the global catalog below.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Short Name</th>
                    <th>Capacity</th>
                    <th>Building</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attached.map(r => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.name}</td>
                      <td><span className="badge">{r.short_name}</span></td>
                      <td>{r.capacity || '—'}</td>
                      <td>{r.building_name || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEditForm(r)} title="Edit globally">✏️</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDetach(r.id)} title="Remove from timetable">🔗✕</button>
                          <button className="btn btn-red btn-sm" onClick={() => handleDeleteGlobal(r.id)} title="Delete globally">🗑️</button>
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
            <span className="card-title">🌐 Global Rooms Catalog ({catalog.length} total)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="catalog-search-rooms"
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
                  ? 'No rooms in the global catalog yet. Create your first room above.'
                  : 'All global rooms are already attached to this timetable.'}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Short Name</th>
                    <th>Capacity</th>
                    <th>Building</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Attach</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map(r => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.name}</td>
                      <td><span className="badge">{r.short_name}</span></td>
                      <td>{r.capacity || '—'}</td>
                      <td>{r.building_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          id={`attach-room-${r.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttach(r.id)}
                          disabled={attaching === r.id}
                        >
                          {attaching === r.id ? '…' : '+ Attach'}
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
          ℹ️ <strong>Global Catalog</strong>: Rooms are reusable across all timetables. Use <strong>+ Attach</strong> to add existing rooms to this timetable. Detaching removes from this timetable only — the room remains available globally.
        </div>
      </div>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        title="Bulk Import Rooms"
        subtitle="Add multiple physical spaces to your global catalog using a CSV file."
        expectedColumns={[
          { name: 'Room Name', required: true },
          { name: 'Short Name', required: false },
          { name: 'Room Group Name', required: false }
        ]}
        onImport={(file) => roomApi.bulkImportGlobal(file, timetable?.owner_id)}
        onSuccess={() => loadData()}
        onDownloadTemplate={() => {
          const csvContent = "data:text/csv;charset=utf-8,Room Name,Short Name,Room Group Name\nPhysics Lab,PHLAB,Science Block\nRoom 101,101,Main Building";
          const link = document.createElement("a");
          link.setAttribute("href", encodeURI(csvContent));
          link.setAttribute("download", "rooms_template.csv");
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