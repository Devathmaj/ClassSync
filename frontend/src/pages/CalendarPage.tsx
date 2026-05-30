// Calendar — real timetable data, session-bounded, lessons fallback

import { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import {
  timetableApi, timetableEntryApi, bellScheduleApi,
  subjectApi, facultyApi, classroomApi, lessonApi,
} from '../api';
import type { Timetable, Subject, Faculty, Classroom, BellSchedule, Lesson } from '../types';
// ─── Day-of-week → FullCalendar index (0=Sunday) ────────────────────────────
const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};
// ─── Timetable colour palette (one per timetable) ───────────────────────────
const TT_COLORS = [
  '#A3E635', '#22D3EE', '#F472B6', '#FB923C', '#A78BFA',
  '#FBBF24', '#34D399', '#60A5FA', '#E879F9', '#F87171',
];
// ─── Extended event props ────────────────────────────────────────────────────
interface CalEventMeta {
  timetableName: string;
  timetableId: string;
  subjectName: string;
  teacherNames: string[];
  classroomName: string;
  periodName: string;
  isFromEntries: boolean;  // true = generated schedule, false = lesson-based
}
// ─── Per-timetable loaded data bundle ────────────────────────────────────────
interface TimetableBundle {
  timetable: Timetable;
  subjects: Map<string, Subject>;
  faculty: Map<string, Faculty>;
  classrooms: Map<string, Classroom>;
  bellSchedule: BellSchedule | null;
  lessons: Lesson[];
  color: string;
  hasSession: boolean;
}
// ─── Helper: FullCalendar endRecur is exclusive, so add 1 day to make session_end inclusive ───
// ─── Helper: FullCalendar endRecur is exclusive, so add 1 day to make session_end inclusive ───
function safeDateStr(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().split('T')[0];
  } catch { return undefined; }
}

function addOneDay(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  } catch { return undefined; }
}

// ─── Build recurring events from generated entries ────────────────────────────
function buildEventsFromEntries(
  bundle: TimetableBundle,
  rawEntries: import('../types').TimetableEntry[],
): EventInput[] {
  const { timetable, subjects, faculty, classrooms, bellSchedule, color } = bundle;
  const periodMap = new Map(
    (bellSchedule?.periods ?? []).map(p => [p.order, p])
  );
  return rawEntries.flatMap(entry => {
    const period = periodMap.get(entry.period_number);
    if (!period || period.is_break) return [];
    const dayIdx = DAY_MAP[entry.day_of_week];
    if (dayIdx === undefined) return [];
    const subject = entry.subject_id ? subjects.get(entry.subject_id) : null;
    const classroom = entry.classroom_id ? classrooms.get(entry.classroom_id) : null;
    const teacher = entry.faculty_id ? faculty.get(entry.faculty_id) : null;
    const subjectName = subject?.name ?? 'Class';
    const classroomName = classroom?.name ?? '';
    const bgColor = subject?.display_color && subject.display_color !== '#FFFFFF'
      ? subject.display_color
      : color;
    const meta: CalEventMeta = {
      timetableName: timetable.name,
      timetableId: timetable.id,
      subjectName,
      teacherNames: teacher ? [teacher.full_name] : [],
      classroomName,
      periodName: period.name,
      isFromEntries: true,
    };
    return [{
      id: `entry-${entry.id}`,
      title: subjectName,
      daysOfWeek: [dayIdx],
      startTime: period.start_time,
      endTime: period.end_time,
      startRecur: safeDateStr(timetable.session_start),
      endRecur: addOneDay(timetable.session_end),
      backgroundColor: bgColor,
      borderColor: bgColor,
      textColor: '#fff',
      extendedProps: meta,
    }];
  });
}
// ─── Build recurring events from lessons (not yet generated) ─────────────────
// Each lesson has periods_per_week — we spread them evenly across working days
function buildEventsFromLessons(bundle: TimetableBundle): EventInput[] {
  const { timetable, subjects, faculty, classrooms, bellSchedule, lessons, color } = bundle;
  if (!bellSchedule || bellSchedule.working_days.length === 0) return [];
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const workingDays = [...bellSchedule.working_days].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
  );
  const teachingPeriods = bellSchedule.periods
    .filter(p => !p.is_break)
    .sort((a, b) => a.order - b.order);
  if (teachingPeriods.length === 0) return [];
  const events: EventInput[] = [];
  lessons.forEach(lesson => {
    // Gather subject/faculty/classroom info for this lesson
    const lessonSubjects = lesson.subject_ids
      .map(sid => subjects.get(sid))
      .filter(Boolean) as Subject[];
    const lessonFaculty = lesson.faculty_ids
      .map(fid => faculty.get(fid))
      .filter(Boolean) as Faculty[];
    const classroom = lesson.classroom_id ? classrooms.get(lesson.classroom_id) : null;
    const subjectName = lessonSubjects.map(s => s.name).join(', ') || 'Class';
    const bgColor = lessonSubjects[0]?.display_color && lessonSubjects[0].display_color !== '#FFFFFF'
      ? lessonSubjects[0].display_color
      : color;
    // Distribute periods_per_week across days evenly (round-robin across working days & periods)
    let daySlot = 0;
    let periodSlot = 0;
    for (let i = 0; i < lesson.periods_per_week; i++) {
      const day = workingDays[daySlot % workingDays.length];
      const period = teachingPeriods[periodSlot % teachingPeriods.length];
      const dayIdx = DAY_MAP[day];
      if (dayIdx !== undefined) {
        const meta: CalEventMeta = {
          timetableName: timetable.name,
          timetableId: timetable.id,
          subjectName,
          teacherNames: lessonFaculty.map(f => f.full_name),
          classroomName: classroom?.name ?? '',
          periodName: period.name,
          isFromEntries: false,
        };
        events.push({
          id: `lesson-${lesson.id}-${i}`,
          title: subjectName,
          daysOfWeek: [dayIdx],
          startTime: period.start_time,
          endTime: period.end_time,
          startRecur: safeDateStr(timetable.session_start),
          endRecur: addOneDay(timetable.session_end),
          backgroundColor: bgColor,
          borderColor: bgColor,
          textColor: '#fff',
          extendedProps: meta,
        });
      }
      // Advance slots — fill each day once before repeating
      daySlot++;
      if (daySlot % workingDays.length === 0) periodSlot++;
    }
  });
  return events;
}
// ─── Event detail popup ──────────────────────────────────────────────────────
function EventPopup({ meta, onClose, position }: {
  meta: CalEventMeta;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  // Keep popup inside viewport
  const popupWidth = 280;
  const left = Math.min(position.x, window.innerWidth - popupWidth - 16);
  const top = position.y + 8;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
      />
      {/* Popup */}
      <div style={{
        position: 'fixed',
        left,
        top,
        zIndex: 1000,
        width: popupWidth,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px',
          background: 'var(--color-primary-light)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>
              {meta.subjectName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {meta.timetableName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-muted)', lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {meta.periodName && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ fontSize: 14 }}>🕐</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>Period:</span>
              <span style={{ fontWeight: 600 }}>{meta.periodName}</span>
            </div>
          )}
          {meta.teacherNames.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>👨‍🏫</span>
              <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>Teacher{meta.teacherNames.length > 1 ? 's' : ''}:</span>
              <span style={{ fontWeight: 600 }}>{meta.teacherNames.join(', ')}</span>
            </div>
          )}
          {meta.classroomName && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ fontSize: 14 }}>🏫</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>Class:</span>
              <span style={{ fontWeight: 600 }}>{meta.classroomName}</span>
            </div>
          )}
          {!meta.isFromEntries && (
            <div style={{ marginTop: 4, padding: '5px 8px', background: 'var(--color-amber-light)', borderRadius: 6, fontSize: 11.5, color: '#78350F' }}>
              ⚠️ Estimated placement — generate timetable for exact schedule
            </div>
          )}
        </div>
      </div>
    </>
  );
}
// ─── Sidebar timetable legend chip ────────────────────────────────────────────
function TimetableLegendItem({
  timetable, color, hasSession, isGenerated, active, onToggle,
}: {
  timetable: Timetable;
  color: string;
  hasSession: boolean;
  isGenerated: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 'var(--radius-md)',
        border: `1px solid ${active ? color + '60' : 'var(--color-border)'}`,
        background: active ? color + '0C' : 'var(--color-bg)',
        cursor: 'pointer', transition: 'all 0.15s', marginBottom: 6,
        opacity: active ? 1 : 0.5,
      }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: 3, background: color,
        flexShrink: 0, marginTop: 3,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {timetable.name}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          <span className={`badge ${timetable.status === 'published' ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: 10 }}>
            {timetable.status}
          </span>
          {isGenerated && <span className="badge badge-purple" style={{ fontSize: 10 }}>Generated</span>}
          {!isGenerated && <span className="badge badge-gray" style={{ fontSize: 10 }}>Estimated</span>}
          {hasSession && (
            <span className="badge badge-blue" style={{ fontSize: 10 }}>Session</span>
          )}
        </div>
        {hasSession && timetable.session_start && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
            {new Date(timetable.session_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            {timetable.session_end ? ` → ${new Date(timetable.session_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}` : ' → ongoing'}
          </div>
        )}
        {!hasSession && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>No session set — repeating weekly</div>
        )}
      </div>
    </div>
  );
}
// ─── Main page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [allEvents, setAllEvents] = useState<EventInput[]>([]);
  const [bundles, setBundles] = useState<TimetableBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [popup, setPopup] = useState<{ meta: CalEventMeta; x: number; y: number } | null>(null);
  const calRef = useRef<FullCalendar>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const timetables = await timetableApi.list();
        if (cancelled) return;
        const loaded: TimetableBundle[] = [];
        const evts: EventInput[] = [];
        await Promise.all(timetables.map(async (tt, idx) => {
          const color = TT_COLORS[idx % TT_COLORS.length];
          try {
            const [entries, bell, subjectsArr, facultyArr, classroomsArr, lessonsArr] = await Promise.all([
              timetableEntryApi.list(tt.id).catch(() => []),
              bellScheduleApi.get(tt.id).catch(() => null),
              subjectApi.list(tt.id).catch(() => []),
              facultyApi.list(tt.id).catch(() => []),
              classroomApi.list(tt.id).catch(() => []),
              lessonApi.list(tt.id).catch(() => []),
            ]);
            const bundle: TimetableBundle = {
              timetable: tt,
              subjects: new Map(subjectsArr.map(s => [s.id, s])),
              faculty: new Map(facultyArr.map(f => [f.id, f])),
              classrooms: new Map(classroomsArr.map(c => [c.id, c])),
              bellSchedule: bell,
              lessons: lessonsArr,
              color,
              hasSession: !!tt.session_start,
            };
            // Prefer entries (generated), else fall back to lessons
            let ttEvents: EventInput[];
            if (entries.length > 0) {
              ttEvents = buildEventsFromEntries(bundle, entries);
            } else {
              ttEvents = buildEventsFromLessons(bundle);
            }

            if (!cancelled) {
              loaded.push(bundle);
              evts.push(...ttEvents);
            }
          } catch (e) {
            console.error(`Failed loading timetable ${tt.id}`, e);
          }
        }));
        if (!cancelled) {
          setBundles(loaded);
          setAllEvents(evts);
          setActiveIds(new Set(loaded.map(b => b.timetable.id)));
          setLoading(false);
          // Jump calendar to the earliest academic session start
          const sessions = loaded
            .filter(b => b.timetable.session_start)
            .map(b => b.timetable.session_start as string)
            .sort();
          if (sessions.length > 0) {
            setTimeout(() => calRef.current?.getApi().gotoDate(sessions[0]), 0);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load timetable data');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  // Filtered events — only from active (ticked) timetables
  const visibleEvents = allEvents.filter(
    e => activeIds.has((e.extendedProps as CalEventMeta)?.timetableId)
  );
  const handleEventClick = useCallback((arg: EventClickArg) => {
    const meta = arg.event.extendedProps as CalEventMeta;
    const rect = arg.el.getBoundingClientRect();
    setPopup({ meta, x: rect.left, y: rect.bottom });
  }, []);

  // Click on a day cell background in month view → expand to week view
  const handleDateClick = useCallback((info: DateClickArg) => {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (api.view.type === 'dayGridMonth') {
      api.changeView('timeGridWeek', info.date);
    }
  }, []);
  const toggleTimetable = (id: string) => {
    setActiveIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const hasNoSessionTimetables = bundles.some(b => !b.hasSession);
  const hasSessionTimetables = bundles.some(b => b.hasSession);
  return (
    <div className="fade-in">
      <div className="top-header">
        <div>
          <h1 className="header-greeting">Calendar</h1>
          <p className="header-sub">
            All timetables displayed as recurring events — session-bounded where configured
          </p>
        </div>
        {loading && <span className="text-sm text-muted pulse">Loading…</span>}
      </div>

      <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 73px)' }}>
        {/* ── Sidebar ── */}
        <div style={{
          width: 260, flexShrink: 0, borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)', padding: '20px 14px', overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Timetables
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 64, background: 'var(--color-bg)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              No timetables found
            </div>
          ) : (
            <>
              {/* Batch toggles */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, fontSize: 11 }}
                  onClick={() => setActiveIds(new Set(bundles.map(b => b.timetable.id)))}
                >
                  All
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, fontSize: 11 }}
                  onClick={() => setActiveIds(new Set())}
                >
                  None
                </button>
              </div>
              {bundles.map(b => (
                <TimetableLegendItem
                  key={b.timetable.id}
                  timetable={b.timetable}
                  color={b.color}
                  hasSession={b.hasSession}
                  isGenerated={allEvents.some(
                    e => (e.extendedProps as CalEventMeta)?.timetableId === b.timetable.id
                      && (e.extendedProps as CalEventMeta)?.isFromEntries
                  )}
                  active={activeIds.has(b.timetable.id)}
                  onToggle={() => toggleTimetable(b.timetable.id)}
                />
              ))}
              {/* Legend notes */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Legend</div>
                  {hasSessionTimetables && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span className="badge badge-blue" style={{ fontSize: 9 }}>Session</span>
                      <span>Events bounded to academic session</span>
                    </div>
                  )}
                  {hasNoSessionTimetables && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span className="badge badge-gray" style={{ fontSize: 9 }}>No session</span>
                      <span>Repeats every week indefinitely</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span className="badge badge-purple" style={{ fontSize: 9 }}>Generated</span>
                    <span>Actual scheduled positions</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="badge badge-gray" style={{ fontSize: 9 }}>Estimated</span>
                    <span>Approximate placement from lessons</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* ── Calendar area ── */}
        <div style={{ flex: 1, padding: '20px 24px', background: 'var(--color-bg)', minWidth: 0 }}>
          {error && (
            <div className="info-note info-note-amber" style={{ marginBottom: 16 }}>
              ⚠️ {error}
            </div>
          )}
          {!loading && bundles.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
              <h2 style={{ marginBottom: 8 }}>No Timetables Yet</h2>
              <p className="text-muted">Create and configure timetables to see them appear here.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <style>{`
                /* FullCalendar custom theming */
                .fc { font-family: 'Inter', sans-serif; font-size: 13px; }
                .fc .fc-toolbar-title { font-size: 17px; font-weight: 700; color: var(--color-text-primary); }
                .fc .fc-button { 
                  font-family: 'Inter', sans-serif;
                  font-size: 12.5px; font-weight: 600;
                  background: var(--color-surface) !important;
                  border: 1px solid var(--color-border) !important;
                  color: var(--color-text-secondary) !important;
                  border-radius: 6px !important;
                  padding: 5px 12px !important;
                  box-shadow: none !important;
                }
                .fc .fc-button:hover { 
                  background: var(--color-bg) !important;
                  border-color: var(--color-primary) !important;
                  color: var(--color-primary) !important;
                }
                .fc .fc-button-active, .fc .fc-button-primary:not(:disabled).fc-button-active { 
                  background: var(--color-primary) !important;
                  border-color: var(--color-primary) !important;
                  color: white !important;
                }
                .fc .fc-toolbar { padding: 14px 18px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
                .fc .fc-col-header-cell { background: var(--color-bg); font-weight: 600; font-size: 12px; letter-spacing: 0.03em; }
                .fc .fc-timegrid-slot { height: 36px; }
                .fc .fc-event { border-radius: 5px !important; border: none !important; cursor: pointer; }
                .fc .fc-event:hover { filter: brightness(0.92); }
                .fc .fc-daygrid-event { border-radius: 4px !important; }
                .fc .fc-scrollgrid { border-radius: 0 !important; border: none !important; }
                .fc .fc-scrollgrid-section-header th { border-radius: 0 !important; }
                .fc .fc-timegrid-axis { font-size: 11px; color: var(--color-text-muted); }
                .fc .fc-day-today { background: #f5f3ff !important; }
                .fc .fc-day-today .fc-col-header-cell-cushion { color: var(--color-primary); }
              `}</style>
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={visibleEvents}
                eventClick={handleEventClick}
                dayHeaderContent={(args) => {
                  // Make day column headers (Mon, Tue…) clickable
                  return (
                    <a
                      className="fc-col-header-cell-cushion"
                      style={{ cursor: 'pointer', display: 'inline-block', width: '100%', textDecoration: 'none' }}
                      onClick={(e) => {
                        e.preventDefault();
                        const api = calRef.current?.getApi();
                        if (!api) return;
                        
                        if (api.view.type === 'dayGridMonth') {
                          // In month view, args.date is a 1970 dummy date representing just the weekday.
                          // Calculate the first occurrence of this weekday in the current visible month.
                          const viewStart = new Date(api.view.currentStart);
                          const targetDow = args.date.getDay();
                          const startDow = viewStart.getDay();
                          const daysToAdd = (targetDow - startDow + 7) % 7;
                          viewStart.setDate(viewStart.getDate() + daysToAdd);
                          api.changeView('timeGridWeek', viewStart);
                        } else if (api.view.type === 'timeGridWeek') {
                          // In week view, args.date is the actual real date for that column.
                          api.changeView('timeGridDay', args.date);
                        }
                      }}
                      title="Click to zoom in"
                    >
                      {args.text}
                    </a>
                  );
                }}
                eventContent={(arg) => {
                  const meta = arg.event.extendedProps as CalEventMeta;
                  return (
                    <div style={{
                      padding: '2px 5px',
                      overflow: 'hidden',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                    }}>
                      <div style={{
                        fontWeight: 700, fontSize: 11.5,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}>
                        {arg.event.title}
                      </div>
                      {meta.classroomName && (
                        <div style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.2, marginTop: 1 }}>
                          {meta.classroomName}
                        </div>
                      )}
                      {meta.teacherNames.length > 0 && (
                        <div style={{ fontSize: 10, opacity: 0.8, lineHeight: 1.2 }}>
                          {meta.teacherNames[0]}
                        </div>
                      )}
                      {!meta.isFromEntries && (
                        <div style={{ fontSize: 9, opacity: 0.75, lineHeight: 1.2, marginTop: 1, fontStyle: 'italic' }}>
                          est.
                        </div>
                      )}
                    </div>
                  );
                }}
                editable={false}
                selectable={false}
                navLinks={true}
                locale="en-GB"
                slotLabelFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short'
                }}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short'
                }}
                navLinkDayClick={(date) => {
                  // In month view: day number click → week view
                  // In week/day view: day number click → day view
                  const api = calRef.current?.getApi();
                  if (!api) return;
                  if (api.view.type === 'dayGridMonth') {
                    api.changeView('timeGridWeek', date);
                  } else {
                    api.changeView('timeGridDay', date);
                  }
                }}
                dateClick={handleDateClick}
                dayMaxEvents={1}
                moreLinkClick="popover"
                height="calc(100vh - 120px)"
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                nowIndicator={true}
                weekends={true}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: '08:00',
                  endTime: '18:00',
                }}
              />
            </div>
          )}
        </div>
      </div>
      {/* Event popup */}
      {popup && (
        <EventPopup
          meta={popup.meta}
          position={{ x: popup.x, y: popup.y }}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}