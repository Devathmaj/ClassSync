import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Classroom, Subject, Faculty, Room } from '../types';

interface AddLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payloads: any[]) => Promise<void>;
  classrooms: Classroom[];
  subjects: Subject[];
  facultyList: Faculty[];
  rooms: Room[];
}

export default function AddLessonModal({ isOpen, onClose, onSave, classrooms, subjects, facultyList, rooms }: AddLessonModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 State
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [isFacultyOnly, setIsFacultyOnly] = useState(false);
  const [searchClassroom, setSearchClassroom] = useState('');
  const [showClassroomDropdown, setShowClassroomDropdown] = useState(false);

  // Step 2 State
  const [splitIntoGroups, setSplitIntoGroups] = useState(false);
  const [numGroups, setNumGroups] = useState(2);
  const [groups, setGroups] = useState(
    Array.from({ length: 5 }).map(() => ({
      subjectText: '', selectedSubjectId: null as string | null,
      facultyText: '', selectedFacultyId: null as string | null,
      roomText: '', selectedRoomId: null as string | null
    }))
  );
  const [activeDropdown, setActiveDropdown] = useState<{type: string, index: number} | null>(null);

  // Step 3 State
  const [configurations, setConfigurations] = useState([
    { count: 1, duration: 'Single' }
  ]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedClassrooms([]);
      setIsFacultyOnly(false);
      setSearchClassroom('');
      setShowClassroomDropdown(false);
      setSplitIntoGroups(false);
      setNumGroups(2);
      setGroups(
        Array.from({ length: 5 }).map(() => ({
          subjectText: '', selectedSubjectId: null as string | null,
          facultyText: '', selectedFacultyId: null as string | null,
          roomText: '', selectedRoomId: null as string | null
        }))
      );
      setConfigurations([{ count: 1, duration: 'Single' }]);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helpers
  const toggleClassroom = (id: string) => {
    setSelectedClassrooms(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const filteredClassrooms = classrooms.filter(c => c.name.toLowerCase().includes(searchClassroom.toLowerCase()) || c.short_name.toLowerCase().includes(searchClassroom.toLowerCase()));


  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!isFacultyOnly && selectedClassrooms.length === 0) {
        setError('Please select at least one section or choose Faculty Only.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const activeGroups = splitIntoGroups ? groups.slice(0, numGroups) : [groups[0]];
      for (let i = 0; i < activeGroups.length; i++) {
        const g = activeGroups[i];
        if (!g.subjectText.trim() && !g.selectedSubjectId) {
          setError(`Subject is required${splitIntoGroups ? ` for Group ${i + 1}` : ''}.`);
          return;
        }
        if (!g.selectedFacultyId) {
          setError(`Please select a faculty member${splitIntoGroups ? ` for Group ${i + 1}` : ''}.`);
          return;
        }
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      // Build payloads. If multiple sections are selected, we usually create a single lesson for that classroom, OR multiple lessons if we don't support multi-classroom lessons. Wait, our Lesson model only supports one `classroom_id`.
      // So if multiple sections are selected, we must create multiple lessons.
      const payloads: any[] = [];
      const targets = isFacultyOnly ? [undefined] : selectedClassrooms;
      
      for (const cid of targets) {
        for (const conf of configurations) {
          const activeGroups = splitIntoGroups ? groups.slice(0, numGroups) : [groups[0]];
          for (const g of activeGroups) {
            payloads.push({
              classroom_id: cid,
              subject_ids: g.selectedSubjectId ? [g.selectedSubjectId] : [], 
              faculty_ids: g.selectedFacultyId ? [g.selectedFacultyId] : [],
              room_id: g.selectedRoomId || undefined,
              periods_per_week: conf.count,
              sequence: 1, 
              double_periods: conf.duration === 'Double',
              is_faculty_only: isFacultyOnly,
              split_into_groups: splitIntoGroups,
              _customSubjectName: g.selectedSubjectId ? undefined : g.subjectText.trim() 
            });
          }
        }
      }

      await onSave(payloads);
      // Reset state on successful close (handled by parent typically)
    } catch (err: any) {
      setError(err.message || 'Failed to create lesson');
    } finally {
      setSaving(false);
    }
  };

  const addConfiguration = () => {
    setConfigurations([...configurations, { count: 1, duration: 'Single' }]);
  };

  const updateConfig = (idx: number, field: string, value: any) => {
    const newConfigs = [...configurations];
    (newConfigs[idx] as any)[field] = value;
    setConfigurations(newConfigs);
  };

  const removeConfig = (idx: number) => {
    if (configurations.length > 1) {
      setConfigurations(configurations.filter((_, i) => i !== idx));
    }
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-container">
        
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Add New Lesson</h2>
          <button className="modal-close" onClick={onClose} disabled={saving}>×</button>
        </div>

        {/* Stepper */}
        <div className="modal-stepper">
          {['Sections', 'Setup', 'Frequency'].map((label, idx) => {
            const num = idx + 1;
            const isActive = step === num;
            const isCompleted = step > num;
            return (
              <div key={label} className="stepper-item">
                <div className="stepper-circle-wrap">
                  <div className={`stepper-circle ${isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}`}>
                    {isCompleted ? '✓' : num}
                  </div>
                  {idx < 2 && <div className={`stepper-line ${isCompleted ? 'completed' : ''}`} />}
                </div>
                <div className={`stepper-label ${isActive ? 'active' : ''}`}>{label}</div>
              </div>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="modal-body">
          {error && <div className="info-note info-note-amber mb-4">⚠️ {error}</div>}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="step-content fade-in">
              <h3 className="section-title">Select Sections</h3>
              <p className="section-sub">Select student sections, or skip to schedule an activity without sections</p>

              <div className="dropdown-container" style={{ marginTop: 24, position: 'relative' }}>
                <input 
                  type="text" 
                  className="modern-input" 
                  placeholder="Search or select sections" 
                  value={searchClassroom}
                  onChange={e => { setSearchClassroom(e.target.value); setShowClassroomDropdown(true); }}
                  onFocus={() => setShowClassroomDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClassroomDropdown(false), 200)}
                  disabled={isFacultyOnly}
                />
                {showClassroomDropdown && !isFacultyOnly && (
                  <div className="modern-dropdown">
                    {filteredClassrooms.map(c => {
                      const isSelected = selectedClassrooms.includes(c.id);
                      return (
                        <div 
                          key={c.id} 
                          className="dropdown-item" 
                          style={{ background: isSelected ? 'var(--color-bg-secondary)' : 'transparent' }}
                          onMouseDown={e => e.preventDefault()} 
                          onClick={() => { 
                            toggleClassroom(c.id); 
                            setSearchClassroom(''); 
                          }}
                        >
                          <div className="dropdown-item-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 16, height: 16, border: '1px solid var(--color-border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--color-primary)' : 'transparent' }}>
                              {isSelected && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                            </div>
                            {c.name}
                          </div>
                          {c.student_count && <div className="dropdown-item-sub" style={{ paddingLeft: 24 }}>{c.student_count} Students</div>}
                        </div>
                      );
                    })}
                    {filteredClassrooms.length === 0 && <div className="dropdown-empty">No sections found</div>}
                  </div>
                )}
              </div>

              {selectedClassrooms.length > 0 && !isFacultyOnly && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedClassrooms.map(id => {
                      const c = classrooms.find(x => x.id === id);
                      return (
                        <div key={id} className="pill-chip orange-chip">
                          {c?.name}
                          <span className="chip-remove" onClick={() => toggleClassroom(id)}>×</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-sm text-muted mt-2">{selectedClassrooms.length} section{selectedClassrooms.length > 1 ? 's' : ''} selected</div>
                </div>
              )}

              <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid #e2e8f0' }}>
                <label className="toggle-label">
                  <input type="checkbox" className="modern-checkbox" checked={isFacultyOnly} onChange={e => setIsFacultyOnly(e.target.checked)} />
                  <div>
                    <div className="font-semibold" style={{ color: '#1e293b' }}>Create faculty-only activity</div>
                    <div className="text-sm text-muted" style={{ marginTop: 2 }}>For meetings, duties, release periods, planning blocks, or staff-only activities</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="step-content fade-in">
              <div className="summary-card mb-4">
                <div className="summary-card-header">SELECTED SECTIONS</div>
                <div className="summary-card-body">
                  {isFacultyOnly ? (
                    <span className="badge badge-gray">Faculty Only</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedClassrooms.map(id => {
                        const c = classrooms.find(x => x.id === id);
                        return <div key={id} className="pill-chip orange-chip">{c?.name}</div>;
                      })}
                    </div>
                  )}
                </div>
              </div>

              {!isFacultyOnly && (
                <div className="split-groups-area mb-4">
                  <button className="btn btn-outline btn-sm" onClick={() => setSplitIntoGroups(!splitIntoGroups)}>
                    {splitIntoGroups ? '− Cancel Split' : '+ Split into Groups'}
                  </button>
                  {splitIntoGroups && (
                    <div className="expandable-panel mt-2 p-3" style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <label className="form-label" style={{ fontSize: 13 }}>Number of Groups</label>
                      <input type="number" min="2" max="5" className="modern-input" value={numGroups} onChange={e => setNumGroups(parseInt(e.target.value) || 2)} style={{ width: 100 }} />
                      <div className="text-xs text-muted mt-1">Students will be divided evenly or assigned later.</div>
                    </div>
                  )}
                </div>
              )}

              {Array.from({ length: splitIntoGroups ? numGroups : 1 }).map((_, idx) => {
                const g = groups[idx];
                const updateGroup = (field: string, val: any) => {
                  const newGroups = [...groups];
                  (newGroups[idx] as any)[field] = val;
                  setGroups(newGroups);
                };

                const fSubjects = subjects.filter(s => s.name.toLowerCase().includes(g.subjectText.toLowerCase()) || s.short_name.toLowerCase().includes(g.subjectText.toLowerCase()));
                const fFaculty = facultyList.filter(f => f.full_name.toLowerCase().includes(g.facultyText.toLowerCase()) || f.short_name.toLowerCase().includes(g.facultyText.toLowerCase()));
                const fRooms = rooms.filter(r => r.name.toLowerCase().includes(g.roomText.toLowerCase()) || r.short_name.toLowerCase().includes(g.roomText.toLowerCase()));

                return (
                  <div key={idx} style={{ padding: splitIntoGroups ? '16px' : 0, background: splitIntoGroups ? '#f8fafc' : 'transparent', borderRadius: 8, border: splitIntoGroups ? '1px solid #e2e8f0' : 'none', marginBottom: 16 }}>
                    {splitIntoGroups && <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 12, letterSpacing: '0.05em' }}>GROUP {idx + 1}</h4>}
                    
                    <div className="form-group mb-4" style={{ position: 'relative' }}>
                      <label className="form-label">Subject / Activity <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        type="text" 
                        className="modern-input" 
                        placeholder="Select from existing subjects or type a new name to create one" 
                        value={g.subjectText}
                        onChange={e => { updateGroup('subjectText', e.target.value); updateGroup('selectedSubjectId', null); setActiveDropdown({ type: 'subject', index: idx }); }}
                        onFocus={() => setActiveDropdown({ type: 'subject', index: idx })}
                        onBlur={() => setTimeout(() => { if (activeDropdown?.type === 'subject' && activeDropdown?.index === idx) setActiveDropdown(null) }, 200)}
                      />
                      {activeDropdown?.type === 'subject' && activeDropdown?.index === idx && (
                        <div className="modern-dropdown">
                          {fSubjects.map(s => (
                            <div key={s.id} className="dropdown-item" onMouseDown={e => e.preventDefault()} onClick={() => { updateGroup('subjectText', s.name); updateGroup('selectedSubjectId', s.id); setActiveDropdown(null); }}>
                              <div className="dropdown-item-title">{s.name}</div>
                            </div>
                          ))}
                          {g.subjectText && !fSubjects.find(s => s.name.toLowerCase() === g.subjectText.toLowerCase()) && (
                            <div className="dropdown-item create-item" onMouseDown={e => e.preventDefault()} onClick={() => setActiveDropdown(null)}>
                              <span style={{ color: 'var(--color-primary)' }}>+ Create "{g.subjectText}"</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="form-group mb-4" style={{ position: 'relative' }}>
                      <label className="form-label">Faculty <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        type="text" 
                        className="modern-input" 
                        placeholder="Search and select faculty" 
                        value={g.facultyText}
                        onChange={e => { updateGroup('facultyText', e.target.value); updateGroup('selectedFacultyId', null); setActiveDropdown({ type: 'faculty', index: idx }); }}
                        onFocus={() => setActiveDropdown({ type: 'faculty', index: idx })}
                        onBlur={() => setTimeout(() => { if (activeDropdown?.type === 'faculty' && activeDropdown?.index === idx) setActiveDropdown(null) }, 200)}
                      />
                      {activeDropdown?.type === 'faculty' && activeDropdown?.index === idx && (
                        <div className="modern-dropdown">
                          {fFaculty.map(f => (
                            <div key={f.id} className="dropdown-item" onMouseDown={e => e.preventDefault()} onClick={() => { updateGroup('facultyText', f.full_name); updateGroup('selectedFacultyId', f.id); setActiveDropdown(null); }}>
                              <div className="dropdown-item-title">{f.full_name}</div>
                              {f.designation && <div className="dropdown-item-sub">{f.designation}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ position: 'relative' }}>
                      <label className="form-label">Room <span className="text-muted font-normal">(Optional)</span></label>
                      <input 
                        type="text" 
                        className="modern-input" 
                        placeholder="Assign specific room" 
                        value={g.roomText}
                        onChange={e => { updateGroup('roomText', e.target.value); updateGroup('selectedRoomId', null); setActiveDropdown({ type: 'room', index: idx }); }}
                        onFocus={() => setActiveDropdown({ type: 'room', index: idx })}
                        onBlur={() => setTimeout(() => { if (activeDropdown?.type === 'room' && activeDropdown?.index === idx) setActiveDropdown(null) }, 200)}
                      />
                      {activeDropdown?.type === 'room' && activeDropdown?.index === idx && (
                        <div className="modern-dropdown">
                          {fRooms.map(r => (
                            <div key={r.id} className="dropdown-item" onMouseDown={e => e.preventDefault()} onClick={() => { updateGroup('roomText', r.name); updateGroup('selectedRoomId', r.id); setActiveDropdown(null); }}>
                              <div className="dropdown-item-title">{r.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="step-content fade-in">
              <h3 className="section-title">Frequency</h3>
              <p className="section-sub">Define how many times per week and duration</p>

              <div className="frequency-card mt-4">
                {configurations.map((conf, idx) => (
                  <div key={idx} className="frequency-row">
                    <div className="counter-controls">
                      <button className="counter-btn" onClick={() => updateConfig(idx, 'count', Math.max(1, conf.count - 1))}>−</button>
                      <div className="counter-val">{conf.count}</div>
                      <button className="counter-btn" onClick={() => updateConfig(idx, 'count', Math.min(10, conf.count + 1))}>+</button>
                    </div>
                    <div className="multiply-sym">×</div>
                    <select className="modern-select" value={conf.duration} onChange={e => updateConfig(idx, 'duration', e.target.value)}>
                      <option value="Single">Single</option>
                      <option value="Double">Double</option>
                    </select>
                    <div className="preview-val">= {conf.count * (conf.duration === 'Double' ? 2 : 1)}P</div>
                    <button className="remove-row-btn" onClick={() => removeConfig(idx)} disabled={configurations.length === 1}>×</button>
                  </div>
                ))}

                <button className="add-config-btn" onClick={addConfiguration}>+ Add another configuration</button>
              </div>

              <div className="preview-panel mt-4">
                <div className="preview-header">
                  <div className="preview-title">Preview</div>
                  <div className="preview-total">
                    {configurations.reduce((acc, c) => acc + (c.count * (c.duration === 'Double' ? 2 : 1)), 0)} periods / week
                  </div>
                </div>
                <div className="preview-blocks">
                  {configurations.map((c, i) => (
                    Array.from({ length: c.count }).map((_, j) => (
                      <div key={`${i}-${j}`} className={`preview-block ${c.duration === 'Double' ? 'double' : ''}`}>
                        {c.duration === 'Double' ? '2P' : '1P'}
                      </div>
                    ))
                  ))}
                </div>
              </div>

              <div className="info-card mt-4">
                <div className="info-icon">💡</div>
                <div>
                  <div className="font-semibold text-sm">Want to fix specific times?</div>
                  <div className="text-xs text-muted mt-1">You can fix lessons to specific days and periods later in the Timetable Editor.</div>
                  <div className="text-xs mt-2" style={{ color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>▶ Watch how to fix lessons</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div>
            {step > 1 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={saving}>← Back</button>}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            {step < 3 ? (
              <button className="btn btn-primary" onClick={handleNext}>Next</button>
            ) : (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Creating...' : 'Create Lesson'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
