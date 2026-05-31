import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { constraintApi, subjectApi, classroomApi } from '../../api';
import type { Constraint, Subject, Classroom } from '../../types';

interface ConstraintsPageProps {
  timetableId: string;
  onBack: () => void;
}

const TIPS = [
  { color: 'yellow', title: 'Subject Sequence', body: 'Force one subject to immediately follow another (e.g. Physics Theory followed by Physics Lab).' },
  { color: 'blue', title: 'Same Day Exclusion', body: 'Prevent two heavy subjects from happening on the same day (e.g. Math and Science).' },
  { color: 'purple', title: 'Class Teacher', body: 'Ensure that the first period of the day is taught by the class teacher.' },
  { color: 'green', title: 'Specific Days', body: 'Force a subject to only be scheduled on specific days (e.g. PE only on Thursday/Friday).' },
  { color: 'indigo', title: 'Max One Per Day', body: 'Restrict a subject from appearing more than once per day.' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ConstraintsPage({ timetableId, onBack }: ConstraintsPageProps) {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({
    constraint_type: 'subject_sequence',
    scope: 'institute',
    subject_a_id: '',
    subject_b_id: '',
    classroom_id: '',
    description: '',
    days_of_week: [] as string[],
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      constraintApi.list(timetableId),
      subjectApi.list(timetableId),
      classroomApi.list(timetableId),
    ]).then(([c, s, cl]) => {
      setConstraints(c);
      setSubjects(s);
      setClassrooms(cl);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const handleSave = async () => {
    if (form.constraint_type === 'subject_sequence' || form.constraint_type === 'same_day_exclusion') {
      if (!form.subject_a_id || !form.subject_b_id) {
        setError('Both Subject A and Subject B are required for this constraint type.');
        return;
      }
    }
    if (form.constraint_type === 'specific_days_subject') {
      if (!form.subject_a_id || form.days_of_week.length === 0) {
        setError('Subject and at least one day are required.');
        return;
      }
    }
    if (form.constraint_type === 'first_period_class_teacher') {
      if (form.scope === 'institute') {
        // Valid for all classes
      }
    }
    
    setSaving(true); setError('');
    try {
      const payload: Partial<Constraint> = {
        constraint_type: form.constraint_type as any,
        scope: form.scope as any,
        subject_a_id: form.subject_a_id || undefined,
        subject_b_id: form.subject_b_id || undefined,
        classroom_id: form.scope === 'class' ? (form.classroom_id || undefined) : undefined,
        description: form.description || undefined,
        days_of_week: (form.constraint_type === 'first_period_class_teacher' || form.constraint_type === 'specific_days_subject') && form.days_of_week.length > 0 ? form.days_of_week : undefined,
      };
      
      const created = await constraintApi.create(timetableId, payload);
      setConstraints(prev => [...prev, created]);
      setShowForm(false);
      setForm({ ...form, description: '', subject_a_id: '', subject_b_id: '', days_of_week: [] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await constraintApi.delete(timetableId, id);
    setConstraints(prev => prev.filter(c => c.id !== id));
  };

  const getSubjectName = (id?: string) => subjects.find(s => s.id === id)?.name || id;

  const renderConstraintRule = (c: Constraint) => {
    if (c.constraint_type === 'subject_sequence') {
      return `${getSubjectName(c.subject_a_id)} must precede ${getSubjectName(c.subject_b_id)}`;
    }
    if (c.constraint_type === 'same_day_exclusion') {
      return `${getSubjectName(c.subject_a_id)} and ${getSubjectName(c.subject_b_id)} not on the same day`;
    }
    if (c.constraint_type === 'first_period_class_teacher') {
      const daysStr = c.days_of_week && c.days_of_week.length > 0 ? ` on ${c.days_of_week.join(', ')}` : ' (All Days)';
      return `1st Period matched to Class Teacher${daysStr}`;
    }
    if (c.constraint_type === 'specific_days_subject') {
      return `${getSubjectName(c.subject_a_id)} restricted to ${c.days_of_week?.join(', ') || 'no days'}`;
    }
    if (c.constraint_type === 'max_one_per_day') {
      return c.subject_a_id ? `${getSubjectName(c.subject_a_id)}: max 1 per day` : `All subjects: max 1 per day`;
    }
    return c.constraint_type;
  };

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Constraints</span>
          </div>
          <h1 className="header-greeting">Conditions & Constraints</h1>
          <p className="header-sub">Set advanced rules for the generation engine</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Constraint
        </button>
      </div>

      <div className="page-content" style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          {showForm && createPortal(
            <div className="modal-overlay fade-in" style={{ zIndex: 100 }}>
              <div className="modal-container" style={{ width: 600, maxWidth: '90vw' }}>
                <div className="modal-header">
                  <h2 className="modal-title" style={{ fontSize: 20 }}>Add New Constraint</h2>
                  <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                </div>
                <div className="modal-body">
                  {error && <div className="info-note info-note-amber mb-4" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Constraint Type</label>
                      <select className="form-input" value={form.constraint_type} onChange={e => setForm(f => ({ ...f, constraint_type: e.target.value }))}>
                        <option value="subject_sequence">Subject Sequence (A follows B)</option>
                        <option value="same_day_exclusion">Same Day Exclusion (A & B not same day)</option>
                        <option value="first_period_class_teacher">1st Period Matches Class Teacher</option>
                        <option value="specific_days_subject">Specific Days for Subject</option>
                        <option value="max_one_per_day">Max One Per Day</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Scope</label>
                      <select className="form-input" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                        <option value="institute">Entire Institute</option>
                        <option value="class">Specific Classroom</option>
                      </select>
                    </div>
                    
                    {form.scope === 'class' && (
                      <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
                        <label className="form-label">Target Classroom</label>
                        <select className="form-input" value={form.classroom_id} onChange={e => setForm(f => ({ ...f, classroom_id: e.target.value }))}>
                          <option value="">-- Select Classroom --</option>
                          {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {form.constraint_type === 'first_period_class_teacher' && (
                      <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
                        <label className="form-label">Apply on specific days? (Leave empty for All Days)</label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                          {DAYS.map(day => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                              <input
                                type="checkbox"
                                checked={form.days_of_week.includes(day)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setForm(f => ({ ...f, days_of_week: [...f.days_of_week, day] }));
                                  } else {
                                    setForm(f => ({ ...f, days_of_week: f.days_of_week.filter(d => d !== day) }));
                                  }
                                }}
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.constraint_type === 'specific_days_subject' && (
                      <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
                        <label className="form-label">Allowed Days *</label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                          {DAYS.map(day => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                              <input
                                type="checkbox"
                                checked={form.days_of_week.includes(day)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setForm(f => ({ ...f, days_of_week: [...f.days_of_week, day] }));
                                  } else {
                                    setForm(f => ({ ...f, days_of_week: f.days_of_week.filter(d => d !== day) }));
                                  }
                                }}
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.constraint_type !== 'first_period_class_teacher' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">{form.constraint_type === 'specific_days_subject' || form.constraint_type === 'max_one_per_day' ? 'Subject' : 'Subject A'}</label>
                          <select className="form-input" value={form.subject_a_id} onChange={e => setForm(f => ({ ...f, subject_a_id: e.target.value }))}>
                            <option value="">{form.constraint_type === 'max_one_per_day' ? '-- All Subjects --' : `-- Select Subject ${form.constraint_type !== 'specific_days_subject' ? 'A' : ''} --`}</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>

                        {form.constraint_type !== 'specific_days_subject' && form.constraint_type !== 'max_one_per_day' && (
                          <div className="form-group">
                            <label className="form-label">Subject B</label>
                            <select className="form-input" value={form.subject_b_id} onChange={e => setForm(f => ({ ...f, subject_b_id: e.target.value }))}>
                              <option value="">-- Select Subject B --</option>
                              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
                      <label className="form-label">Description (Optional)</label>
                      <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Explain why this constraint exists" />
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Constraint'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Active Constraints</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Scope</th>
                    <th>Description</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 30 }}>Loading...</td></tr>
                  ) : constraints.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 30 }}>No constraints defined yet.</td></tr>
                  ) : (
                    constraints.map(c => (
                      <tr key={c.id}>
                        <td className="font-bold">{renderConstraintRule(c)}</td>
                        <td>
                          {c.scope === 'institute' ? <span className="badge">Institute-wide</span> : (
                            <span className="badge badge-purple">{classrooms.find(cl => cl.id === c.classroom_id)?.short_name || 'Class'}</span>
                          )}
                        </td>
                        <td className="text-muted">{c.description || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TIPS.map((tip, i) => (
            <div key={i} className={`info-note info-note-${tip.color}`}>
              <div className="font-bold" style={{ marginBottom: 4 }}>{tip.title}</div>
              <div className="text-sm">{tip.body}</div>
            </div>
          ))}
        </div>
      </div>

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