import { useEffect, useState } from 'react';
import { timetableApi, facultyApi, classroomApi, subjectApi, lessonApi, roomApi, constraintApi } from '../api';
import type { Timetable, ValidationResult } from '../types';

interface OverviewPageProps {
  timetableId: string;
  onNavigate: (page: string, id?: string) => void;
}

type ConfigSection = 'details' | 'bell-schedule' | 'faculty' | 'classrooms' | 'rooms' | 'subjects' | 'lessons' | 'settings' | 'constraints';

const SECTIONS = [
  {
    group: '1. Basic Information',
    items: [
      { id: 'details' as ConfigSection, label: 'Timetable Details', desc: 'Name, description, and session info' },
      { id: 'bell-schedule' as ConfigSection, label: 'Bell Schedule', desc: 'Working days, periods and breaks' },
    ],
  },
  {
    group: '2. Institute Data',
    items: [
      { id: 'faculty' as ConfigSection, label: 'Faculty', desc: 'Add teachers, instructors, and other teaching staff' },
      { id: 'classrooms' as ConfigSection, label: 'Grades & Divisions', desc: 'Define grade levels and their divisions' },
      { id: 'rooms' as ConfigSection, label: 'Rooms (Optional)', desc: 'Add classrooms, labs, and other teaching spaces' },
    ],
  },
  {
    group: '3. Lessons Configuration',
    items: [
      { id: 'subjects' as ConfigSection, label: 'Subjects & Activities', desc: 'Define subjects like Math, Science, and activities' },
      { id: 'lessons' as ConfigSection, label: 'Lessons', desc: 'Assign subjects to grades with faculty and period counts' },
    ],
  },
  {
    group: '4. Settings & Conditions',
    items: [
      { id: 'settings' as ConfigSection, label: 'System Settings', desc: 'Faculty constraints, optimization weights, execution time' },
      { id: 'constraints' as ConfigSection, label: 'Conditions & Constraints', desc: 'Subject sequencing rules and same-day exclusions' },
    ],
    amber: true,
  },
];

export default function TimetableOverviewPage({ timetableId, onNavigate }: OverviewPageProps) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [counts, setCounts] = useState({ faculty: 0, classrooms: 0, rooms: 0, subjects: 0, lessons: 0, constraints: 0 });

  useEffect(() => {
    timetableApi.get(timetableId).then(setTimetable).catch(() => {});
    timetableApi.validate(timetableId).then(setValidation).catch(() => {});
    Promise.all([
      facultyApi.list(timetableId),
      classroomApi.list(timetableId),
      roomApi.list(timetableId),
      subjectApi.list(timetableId),
      lessonApi.list(timetableId),
      constraintApi.list(timetableId),
    ]).then(([f, c, r, s, l, con]) =>
      setCounts({ faculty: f.length, classrooms: c.length, rooms: r.length, subjects: s.length, lessons: l.length, constraints: con.length })
    ).catch(() => {});
  }, [timetableId]);

  const getCount = (section: ConfigSection) => {
    if (section === 'faculty') return counts.faculty;
    if (section === 'classrooms') return counts.classrooms;
    if (section === 'rooms') return counts.rooms;
    if (section === 'subjects') return counts.subjects;
    if (section === 'lessons') return counts.lessons;
    if (section === 'constraints') return counts.constraints;
    return null;
  };

  return (
    <div className="fade-in">
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => onNavigate('timetables')}>
              Timetables
            </span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Overview</span>
          </div>
          <h1 className="header-greeting">{timetable?.name || 'Loading…'}</h1>
          <p className="header-sub">Configure your timetable before generating the schedule</p>
        </div>
        <button
          id="open-editor-btn"
          className="btn btn-primary btn-lg"
          onClick={() => onNavigate('timetable-editor', timetableId)}
        >
          Open Timetable →
        </button>
      </div>

      <div className="page-content" style={{ display: 'flex', gap: 20 }}>
        {/* Config sections */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
          {SECTIONS.map(section => (
            <div
              key={section.group}
              className="overview-section"
              style={{
                background: section.amber ? 'rgba(244, 114, 182, 0.05)' : 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                border: section.amber ? '1px solid var(--color-note-border-green)' : '1px solid var(--color-border)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: section.amber ? 'var(--color-primary)' : 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {section.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                {section.items.map(item => {
                  const count = getCount(item.id);
                  const done = count !== null ? count > 0 : item.id === 'details' || item.id === 'bell-schedule' || item.id === 'settings';
                  return (
                    <div
                      key={item.id}
                      id={`overview-item-${item.id}`}
                      className="card"
                      style={{ 
                        cursor: 'pointer', 
                        transition: 'var(--transition)',
                        background: done ? 'rgba(163, 230, 53, 0.05)' : 'var(--color-bg)',
                        border: done ? '1px solid var(--color-note-border-green)' : '1px solid var(--color-border)',
                        padding: 14
                      }}
                      onClick={() => onNavigate(`config-${item.id}`, timetableId)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div className="overview-item-label" style={{ color: done ? 'var(--color-primary)' : 'var(--color-text-primary)', marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div className="overview-item-desc" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</div>
                          {count !== null && count > 0 && (
                            <div className="text-xs font-semibold" style={{ color: 'var(--color-primary)', marginTop: 8 }}>
                              {count} {item.id} configured
                            </div>
                          )}
                        </div>
                        <div className="overview-item-status" style={{ flexShrink: 0, marginLeft: 12 }}>
                          {done ? <span className="checkmark" style={{ color: 'var(--color-primary)' }}>✓</span> : <span style={{ color: 'var(--color-text-muted)' }}>→</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Info notes */}
          <div className="info-note info-note-blue mt-2" style={{ marginTop: 12 }}>
            ℹ️ You can manage subjects in two ways: add them upfront in the Subjects section, or create them on-the-fly while adding lessons.
          </div>
        </div>

        {/* Right sidebar — validation + schedule card */}
        <div style={{ width: 280, flexShrink: 0 }}>
          {/* Validation */}
          {validation && (
            <div
              className="card mb-4"
              style={{
                marginBottom: 16,
                border: validation.passed ? '1px solid var(--color-note-border-green)' : '1px solid var(--color-note-border-red)',
                background: validation.passed ? 'var(--color-note-bg-green)' : 'var(--color-note-bg-red)',
              }}
            >
              <div className="card-body">
                {validation.passed ? (
                  <>
                    <div className="font-bold" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>✅ All validations passed!</div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Your timetable configuration looks good and is ready for generation.</p>
                  </>
                ) : (
                  <>
                    <div className="font-bold" style={{ color: '#F87171', marginBottom: 8 }}>⚠️ Issues found</div>
                    <ul style={{ paddingLeft: 16 }}>
                      {validation.errors.map((e, i) => (
                        <li key={i} className="text-sm" style={{ color: '#FCA5A5', marginBottom: 4 }}>{e}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Ready card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Your Timetable</span></div>
            <div className="card-body">
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
                <div className="font-bold" style={{ fontSize: 15, marginBottom: 4 }}>Ready to Schedule</div>
                <div className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Last updated: {timetable ? new Date(timetable.updated_at).toLocaleDateString('en-GB') : '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: 'var(--color-bg)', padding: '10px', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div className="font-bold" style={{ fontSize: 20 }}>0</div>
                    <div className="text-xs text-muted">Scheduled</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--color-note-bg-red)', padding: '10px', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--color-note-border-red)' }}>
                    <div className="font-bold" style={{ fontSize: 20, color: 'var(--color-primary)' }}>{counts.lessons}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-primary)' }}>Unscheduled</div>
                  </div>
                </div>
                <button
                  id="open-editor-main"
                  className="btn btn-green w-full"
                  style={{ width: '100%' }}
                  onClick={() => onNavigate('timetable-editor', timetableId)}
                >
                  Open Timetable →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
