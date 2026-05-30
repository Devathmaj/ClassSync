import { useEffect, useState } from 'react';
import { lessonApi, classroomApi, subjectApi, facultyApi, roomApi } from '../../api';
import type { Lesson, Classroom, Subject, Faculty, Room } from '../../types';
import AddLessonModal from '../../components/AddLessonModal';
import BulkImportLessonsModal from '../../components/BulkImportLessonsModal';

interface LessonsPageProps {
  timetableId: string;
  onBack: () => void;
}

const TIPS = [
  { color: 'yellow', title: 'What is a Lesson?', body: 'A lesson is a requirement like "10th Grade needs 5 periods of Math taught by Mr. Smith".' },
  { color: 'blue', title: 'Multiple Subjects / Faculty', body: 'You can assign multiple subjects (e.g. Physics + Chem Lab) or co-teachers to a single lesson.' },
  { color: 'purple', title: 'Shared Lessons', body: 'Select two or more lessons and link them. They will be scheduled simultaneously in the same room. Ideal for shared subjects or shared class teachers.' },
];

export default function LessonsPage({ timetableId, onBack }: LessonsPageProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  
  useEffect(() => {
    Promise.all([
      lessonApi.list(timetableId),
      classroomApi.list(timetableId),
      subjectApi.list(timetableId),
      facultyApi.list(timetableId),
      roomApi.list(timetableId).catch(() => []) // Optional, ignore errors if rooms aren't setup
    ]).then(([l, c, s, f, r]) => {
      setLessons(l);
      setClassrooms(c);
      setSubjects(s);
      setFacultyList(f);
      setRooms(r);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [timetableId]);

  const handleSaveMultiple = async (payloads: any[]) => {
    try {
      const createdLessons: Lesson[] = [];
      for (const payload of payloads) {
        // If subject was newly created by typing, we would normally intercept and create it first.
        // For simplicity, we assume subjects exist or the backend handles custom strings (or we skip it if not implemented).
        // Let's strip the _customSubjectName and rely on standard creation for now.
        delete payload._customSubjectName;
        const created = await lessonApi.create(timetableId, payload);
        createdLessons.push(created);
      }
      setLessons(prev => [...prev, ...createdLessons]);
      setShowForm(false);
    } catch (err: unknown) {
      throw err; // Let the modal catch and display it
    }
  };

  const handleDelete = async (id: string) => {
    await lessonApi.delete(timetableId, id);
    setLessons(prev => prev.filter(l => l.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL lessons? This cannot be undone.')) return;
    setLoading(true);
    try {
      await Promise.all(lessons.map(l => lessonApi.delete(timetableId, l.id)));
      setLessons([]);
      setSelectedLessons([]);
    } catch (err) {
      console.error('Failed to clear all lessons', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkLessons = async () => {
    if (selectedLessons.length < 2) {
      alert("Please select at least 2 lessons to link.");
      return;
    }
    const groupId = crypto.randomUUID();
    setLoading(true);
    try {
      await Promise.all(selectedLessons.map(id => lessonApi.update(timetableId, id, { shared_group_id: groupId })));
      setLessons(prev => prev.map(l => selectedLessons.includes(l.id) ? { ...l, shared_group_id: groupId } : l));
      setSelectedLessons([]);
    } catch (err) {
      console.error('Failed to link lessons', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkLesson = async (id: string) => {
    if (!window.confirm('Are you sure you want to unlink this lesson?')) return;
    setLoading(true);
    try {
      await lessonApi.update(timetableId, id, { shared_group_id: null as any });
      setLessons(prev => prev.map(l => l.id === id ? { ...l, shared_group_id: undefined } : l));
    } catch (err) {
      console.error('Failed to unlink lesson', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (list: string[], id: string) => 
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const getSubjectNames = (lesson: any) => {
    const ids = lesson.subject_ids || [];
    if (ids.length === 0) return '-';
    return ids.map((id: string) => subjects.find(s => s.id === id)?.short_name || 'Unknown').join(', ');
  };

  const getFacultyNames = (lesson: any) => {
    const ids = lesson.faculty_ids || [];
    if (ids.length === 0) return '-';
    return ids.map((id: string) => facultyList.find(f => f.id === id)?.short_name || 'Unknown').join(', ');
  };

  const sharedGroups = Array.from(new Set(lessons.map(l => l.shared_group_id).filter(Boolean)));

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Lessons</span>
          </div>
          <h1 className="header-greeting">Lessons Configuration</h1>
          <p className="header-sub">Define requirements: who teaches what to whom, and how often.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {lessons.length > 0 && (
            <button className="btn btn-outline" style={{ color: 'var(--color-red)' }} onClick={handleClearAll} disabled={loading}>
              🗑️ Clear All
            </button>
          )}
          {selectedLessons.length > 0 && (
            <button className="btn btn-primary" onClick={handleLinkLessons} disabled={loading}>
              🔗 Link Selected ({selectedLessons.length})
            </button>
          )}
          <button className="btn btn-outline" onClick={() => setBulkOpen(true)} disabled={loading}>
            + Bulk Import Lessons (CSV)
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} disabled={loading}>
            + Add Lesson Requirement
          </button>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <AddLessonModal 
            isOpen={showForm}
            onClose={() => setShowForm(false)}
            onSave={handleSaveMultiple}
            classrooms={classrooms}
            subjects={subjects}
            facultyList={facultyList}
            rooms={rooms}
          />

          <BulkImportLessonsModal
            isOpen={bulkOpen}
            onClose={() => setBulkOpen(false)}
            timetableId={timetableId}
            classrooms={classrooms}
            subjects={subjects}
            facultyList={facultyList}
            rooms={rooms}
            onImported={(newLessons) => setLessons((prev) => [...prev, ...newLessons])}
          />

          <div className="card">
            <div className="card-header">
              <span className="card-title">All Lesson Requirements</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedLessons.length === lessons.length && lessons.length > 0}
                        onChange={(e) => setSelectedLessons(e.target.checked ? lessons.map(l => l.id) : [])}
                      />
                    </th>
                    <th>Classroom</th>
                    <th>Subjects</th>
                    <th>Faculty</th>
                    <th>Periods/Wk</th>
                    <th>Seq.</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 30 }}>Loading...</td></tr>
                  ) : lessons.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 30 }}>No lessons added yet.</td></tr>
                  ) : (
                    lessons.map(l => {
                      const cName = l.is_faculty_only ? 'Faculty Only' : (classrooms.find(c => c.id === l.classroom_id)?.name || 'Unknown');
                      const groupIndex = l.shared_group_id ? sharedGroups.indexOf(l.shared_group_id) + 1 : 0;
                      return (
                        <tr key={l.id} style={{ background: l.shared_group_id ? 'var(--color-bg)' : undefined }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedLessons.includes(l.id)}
                              onChange={() => setSelectedLessons(prev => toggleSelection(prev, l.id))}
                            />
                          </td>
                          <td className="font-bold">
                            {cName}
                            {l.shared_group_id && <span className="badge badge-purple" style={{ marginLeft: 8 }} title="Shared Lesson">Link {groupIndex}</span>}
                          </td>
                          <td>{getSubjectNames(l)}</td>
                          <td>{getFacultyNames(l)}</td>
                          <td>
                            {l.periods_per_week}
                            {l.double_periods && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--color-primary)' }}>(Double)</span>}
                          </td>
                          <td>
                            <span className="badge badge-gray">Seq: {l.sequence}</span>
                          </td>
                          <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {l.shared_group_id && (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUnlinkLesson(l.id)} title="Unlink">🔗✕</button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l.id)} title="Delete">🗑️</button>
                          </td>
                        </tr>
                      );
                    })
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