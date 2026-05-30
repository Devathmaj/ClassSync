// Reports & Insights — fully data-driven, per-timetable analytics dashboard
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  timetableApi, lessonApi, subjectApi, facultyApi,
  bellScheduleApi, timetableEntryApi, classroomApi,
} from '../api';
import type {
  Timetable, Lesson, Subject, Faculty, BellSchedule,
  TimetableEntry, Classroom,
} from '../types';

// ─── Colour palette for charts ────────────────────────────────────────────────
const CHART_COLORS = [
  '#A3E635', '#22D3EE', '#F472B6', '#FB923C', '#A78BFA',
  '#FBBF24', '#34D399', '#60A5FA', '#E879F9', '#F87171',
];

// ─── Helper: parse "HH:MM" → total minutes ────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToHours(m: number): number {
  return Math.round((m / 60) * 10) / 10;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

// ─── Per-timetable computed data ──────────────────────────────────────────────
interface SubjectStat {
  id: string;
  name: string;
  color: string;
  classes: number;
  hours: number;
}

interface TeacherStat {
  id: string;
  name: string;
  classes: number;
  hours: number;
  subjects: string[];
}

interface DayStat {
  day: string;
  classes: number;
  hours: number;
}

interface ReportData {
  timetable: Timetable;
  lessons: Lesson[];
  subjects: Subject[];
  faculty: Faculty[];
  bellSchedule: BellSchedule | null;
  entries: TimetableEntry[];
  classrooms: Classroom[];
  // Computed
  totalClasses: number;
  totalTeachingHours: number;
  totalSubjects: number;
  totalTeachers: number;
  avgClassesPerDay: number;
  avgHoursPerDay: number;
  earliestClass: string | null;
  latestClass: string | null;
  subjectStats: SubjectStat[];
  teacherStats: TeacherStat[];
  dayStats: DayStat[];
  isGenerated: boolean;
}

// ─── Period duration in minutes (only non-break periods) ─────────────────────
function getPeriodMinutes(bell: BellSchedule | null): number {
  if (!bell || bell.periods.length === 0) return 0;
  const teaching = bell.periods.filter(p => !p.is_break);
  if (teaching.length === 0) return 0;
  const first = teaching[0];
  return timeToMinutes(first.end_time) - timeToMinutes(first.start_time);
}

function getPeriodDurationMap(bell: BellSchedule | null): Map<number, number> {
  const map = new Map<number, number>();
  if (!bell) return map;
  bell.periods.forEach(p => {
    if (!p.is_break) {
      const dur = timeToMinutes(p.end_time) - timeToMinutes(p.start_time);
      map.set(p.order, dur);
    }
  });
  return map;
}

// ─── Build subject lookup map ─────────────────────────────────────────────────
function subjectMap(subjects: Subject[]): Map<string, Subject> {
  return new Map(subjects.map(s => [s.id, s]));
}

function facultyMap(faculty: Faculty[]): Map<string, Faculty> {
  return new Map(faculty.map(f => [f.id, f]));
}

// ─── Compute all stats for a single timetable ─────────────────────────────────
function computeReport(
  timetable: Timetable,
  lessons: Lesson[],
  subjects: Subject[],
  faculty: Faculty[],
  bell: BellSchedule | null,
  entries: TimetableEntry[],
  classrooms: Classroom[],
): ReportData {
  const sMap = subjectMap(subjects);
  const fMap = facultyMap(faculty);
  const isGenerated = entries.length > 0;
  const workingDays = bell?.working_days ?? [];
  const numDays = workingDays.length || 5;

  // ── Subject stats ────────────────────────────────────────────────────────
  const subjectClasses = new Map<string, number>();
  const subjectMinutes = new Map<string, number>();

  if (isGenerated) {
    // Use actual entries
    const periodDurMap = getPeriodDurationMap(bell);
    entries.forEach(e => {
      if (!e.subject_id) return;
      const prev = subjectClasses.get(e.subject_id) ?? 0;
      subjectClasses.set(e.subject_id, prev + 1);
      const dur = periodDurMap.get(e.period_number) ?? getPeriodMinutes(bell);
      subjectMinutes.set(e.subject_id, (subjectMinutes.get(e.subject_id) ?? 0) + dur);
    });
  } else {
    // Use lessons × periods_per_week
    const periodMin = getPeriodMinutes(bell);
    lessons.forEach(l => {
      l.subject_ids.forEach(sid => {
        subjectClasses.set(sid, (subjectClasses.get(sid) ?? 0) + l.periods_per_week);
        subjectMinutes.set(sid, (subjectMinutes.get(sid) ?? 0) + l.periods_per_week * periodMin);
      });
    });
  }

  const subjectStats: SubjectStat[] = Array.from(subjectClasses.entries())
    .map(([id, classes], i) => ({
      id,
      name: sMap.get(id)?.name ?? 'Unknown',
      color: sMap.get(id)?.display_color ?? CHART_COLORS[i % CHART_COLORS.length],
      classes,
      hours: minutesToHours(subjectMinutes.get(id) ?? 0),
    }))
    .sort((a, b) => b.classes - a.classes);

  // ── Teacher stats ─────────────────────────────────────────────────────────
  const teacherClasses = new Map<string, number>();
  const teacherMinutes = new Map<string, number>();
  const teacherSubjects = new Map<string, Set<string>>();

  if (isGenerated) {
    const periodDurMap = getPeriodDurationMap(bell);
    entries.forEach(e => {
      if (!e.faculty_id) return;
      teacherClasses.set(e.faculty_id, (teacherClasses.get(e.faculty_id) ?? 0) + 1);
      const dur = periodDurMap.get(e.period_number) ?? getPeriodMinutes(bell);
      teacherMinutes.set(e.faculty_id, (teacherMinutes.get(e.faculty_id) ?? 0) + dur);
      if (e.subject_id) {
        if (!teacherSubjects.has(e.faculty_id)) teacherSubjects.set(e.faculty_id, new Set());
        teacherSubjects.get(e.faculty_id)!.add(e.subject_id);
      }
    });
  } else {
    const periodMin = getPeriodMinutes(bell);
    lessons.forEach(l => {
      l.faculty_ids.forEach(fid => {
        teacherClasses.set(fid, (teacherClasses.get(fid) ?? 0) + l.periods_per_week);
        teacherMinutes.set(fid, (teacherMinutes.get(fid) ?? 0) + l.periods_per_week * periodMin);
        if (!teacherSubjects.has(fid)) teacherSubjects.set(fid, new Set());
        l.subject_ids.forEach(sid => teacherSubjects.get(fid)!.add(sid));
      });
    });
  }

  const teacherStats: TeacherStat[] = Array.from(teacherClasses.entries())
    .map(([id, classes]) => ({
      id,
      name: fMap.get(id)?.full_name ?? 'Unknown',
      classes,
      hours: minutesToHours(teacherMinutes.get(id) ?? 0),
      subjects: Array.from(teacherSubjects.get(id) ?? [])
        .map(sid => sMap.get(sid)?.name ?? 'Unknown'),
    }))
    .sort((a, b) => b.classes - a.classes);

  // ── Day stats ─────────────────────────────────────────────────────────────
  const dayClasses = new Map<string, number>();
  const dayMinutes = new Map<string, number>();

  if (isGenerated) {
    const periodDurMap = getPeriodDurationMap(bell);
    entries.forEach(e => {
      dayClasses.set(e.day_of_week, (dayClasses.get(e.day_of_week) ?? 0) + 1);
      const dur = periodDurMap.get(e.period_number) ?? getPeriodMinutes(bell);
      dayMinutes.set(e.day_of_week, (dayMinutes.get(e.day_of_week) ?? 0) + dur);
    });
  }

  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayStats: DayStat[] = (isGenerated
    ? Array.from(new Set([...workingDays, ...Array.from(dayClasses.keys())]))
    : workingDays
  )
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    .map(day => ({
      day: day.slice(0, 3),
      classes: dayClasses.get(day) ?? 0,
      hours: minutesToHours(dayMinutes.get(day) ?? 0),
    }));

  // ── Earliest / Latest class ───────────────────────────────────────────────
  let earliestClass: string | null = null;
  let latestClass: string | null = null;

  if (isGenerated && bell) {
    const periodDurMap = getPeriodDurationMap(bell);
    const usedPeriods = new Set(entries.map(e => e.period_number));
    bell.periods
      .filter(p => !p.is_break && usedPeriods.has(p.order))
      .forEach(p => {
        if (!earliestClass || timeToMinutes(p.start_time) < timeToMinutes(earliestClass)) earliestClass = p.start_time;
        if (!latestClass || timeToMinutes(p.end_time) > timeToMinutes(latestClass)) latestClass = p.end_time;
      });
    // fallback: also check entries that have no period match
    if (!earliestClass && periodDurMap.size === 0 && bell.periods.length > 0) {
      const teaching = bell.periods.filter(p => !p.is_break);
      if (teaching.length) {
        earliestClass = teaching[0].start_time;
        latestClass = teaching[teaching.length - 1].end_time;
      }
    }
  } else if (bell && bell.periods.length > 0) {
    const teaching = bell.periods.filter(p => !p.is_break);
    if (teaching.length) {
      earliestClass = teaching[0].start_time;
      latestClass = teaching[teaching.length - 1].end_time;
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalClasses = isGenerated
    ? entries.length
    : lessons.reduce((s, l) => s + l.periods_per_week, 0);

  const totalTeachingMinutes = isGenerated
    ? (() => {
        const pdm = getPeriodDurationMap(bell);
        return entries.reduce((s, e) => s + (pdm.get(e.period_number) ?? getPeriodMinutes(bell)), 0);
      })()
    : lessons.reduce((s, l) => s + l.periods_per_week * getPeriodMinutes(bell), 0);

  const avgClassesPerDay = numDays > 0 ? Math.round((totalClasses / numDays) * 10) / 10 : 0;
  const avgHoursPerDay = numDays > 0 ? minutesToHours(totalTeachingMinutes / numDays) : 0;

  return {
    timetable,
    lessons,
    subjects,
    faculty,
    bellSchedule: bell,
    entries,
    classrooms,
    totalClasses,
    totalTeachingHours: minutesToHours(totalTeachingMinutes),
    totalSubjects: subjects.length,
    totalTeachers: faculty.length,
    avgClassesPerDay,
    avgHoursPerDay,
    earliestClass,
    latestClass,
    subjectStats,
    teacherStats,
    dayStats,
    isGenerated,
  };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-md)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px',
      boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color ? `${color}18` : 'var(--color-primary-light)',
        flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--color-primary)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Section card with collapse ───────────────────────────────────────────────
function SectionCard({ title, children, defaultOpen = true }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'var(--color-bg)', border: 'none',
          cursor: 'pointer', fontWeight: 600, fontSize: 13.5, textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && <div style={{ background: 'var(--color-surface)' }}>{children}</div>}
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 'var(--radius-md)',
      background: `${color}12`, border: `1px solid ${color}30`,
      fontSize: 13,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ─── Per-timetable report section ─────────────────────────────────────────────
function TimetableReport({ data }: { data: ReportData }) {
  const [collapsed, setCollapsed] = useState(false);
  const { timetable, subjectStats, teacherStats, dayStats } = data;

  const mostTaughtSubject = subjectStats[0];
  const leastTaughtSubject = subjectStats[subjectStats.length - 1];
  const mostActiveTeacher = teacherStats[0];
  const leastActiveTeacher = teacherStats[teacherStats.length - 1];
  const busiestDay = [...dayStats].sort((a, b) => b.classes - a.classes)[0];
  const leastBusyDay = [...dayStats].sort((a, b) => a.classes - b.classes)[0];
  const longestDay = [...dayStats].sort((a, b) => b.hours - a.hours)[0];
  const shortestDay = [...dayStats].sort((a, b) => a.hours - b.hours)[0];

  // Insights generation
  const insights: { icon: string; text: string; color: string }[] = [];

  if (busiestDay && busiestDay.classes > 0)
    insights.push({ icon: '📅', text: `${busiestDay.day} is the busiest day with ${busiestDay.classes} class${busiestDay.classes !== 1 ? 'es' : ''}.`, color: '#7C3AED' });

  if (mostTaughtSubject && subjectStats.length > 0) {
    const pct = data.totalClasses > 0 ? Math.round((mostTaughtSubject.classes / data.totalClasses) * 100) : 0;
    if (pct > 0)
      insights.push({ icon: '📚', text: `${mostTaughtSubject.name} occupies ${pct}% of this timetable (${mostTaughtSubject.classes} classes).`, color: '#3B82F6' });
  }

  if (mostActiveTeacher && mostActiveTeacher.classes > 0)
    insights.push({ icon: '👨‍🏫', text: `${mostActiveTeacher.name} is the most active teacher with ${mostActiveTeacher.classes} classes across ${mostActiveTeacher.subjects.length} subject${mostActiveTeacher.subjects.length !== 1 ? 's' : ''}.`, color: '#10B981' });

  if (data.earliestClass && data.latestClass)
    insights.push({ icon: '⏰', text: `Classes run from ${formatTime(data.earliestClass)} to ${formatTime(data.latestClass)}.`, color: '#F59E0B' });

  if (leastBusyDay && leastBusyDay !== busiestDay && dayStats.length > 1)
    insights.push({ icon: '🌤️', text: `${leastBusyDay.day} is the least busy day with ${leastBusyDay.classes} class${leastBusyDay.classes !== 1 ? 'es' : ''}.`, color: '#14B8A6' });

  if (mostTaughtSubject && mostTaughtSubject.hours > 0)
    insights.push({ icon: '⏱️', text: `${mostTaughtSubject.name} accounts for ${mostTaughtSubject.hours}h — the highest teaching duration.`, color: '#EC4899' });

  if (longestDay && longestDay.hours > 0)
    insights.push({ icon: '📊', text: `${longestDay.day} has the longest teaching day at ${longestDay.hours}h.`, color: '#6366F1' });

  if (data.isGenerated)
    insights.push({ icon: '✅', text: `This timetable has been generated with ${data.entries.length} scheduled entries.`, color: '#10B981' });

  // Subject pie chart data
  const subjectPieData = subjectStats.slice(0, 8).map((s, i) => ({
    name: s.name, value: s.classes,
    fill: s.color && s.color !== '#FFFFFF' ? s.color : CHART_COLORS[i % CHART_COLORS.length],
  }));

  const subjectBarData = subjectStats.map((s, i) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    Classes: s.classes,
    Hours: s.hours,
    fill: s.color && s.color !== '#FFFFFF' ? s.color : CHART_COLORS[i % CHART_COLORS.length],
  }));

  const teacherBarData = teacherStats.map((t, i) => ({
    name: t.name.split(' ').slice(-1)[0], // last name for chart
    fullName: t.name,
    Classes: t.classes,
    Hours: t.hours,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Timetable section header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'linear-gradient(135deg, var(--color-primary-light), #f0f4ff)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
          cursor: 'pointer', marginBottom: collapsed ? 0 : 16,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-surface)', fontSize: 18,
          }}>📋</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{timetable.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {data.isGenerated ? `${data.entries.length} entries` : `${data.lessons.length} lessons configured`}
              {' · '}
              {data.totalSubjects} subjects · {data.totalTeachers} teachers
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${timetable.status === 'published' ? 'badge-green' : 'badge-amber'}`}>
            {timetable.status.charAt(0).toUpperCase() + timetable.status.slice(1)}
          </span>
          {data.isGenerated && <span className="badge badge-purple">Generated</span>}
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {!collapsed && (
        <div className="fade-in">

          {/* ── SUMMARY ── */}
          <SectionCard title="📊 Summary">
            <div style={{ padding: '16px 16px 8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              <StatTile icon="🏫" label="Total Classes" value={data.totalClasses} />
              <StatTile icon="⏱️" label="Teaching Hours" value={`${data.totalTeachingHours}h`} color="#3B82F6" />
              <StatTile icon="📚" label="Subjects" value={data.totalSubjects} color="#10B981" />
              <StatTile icon="👨‍🏫" label="Teachers" value={data.totalTeachers} color="#F59E0B" />
              <StatTile icon="📅" label="Avg Classes/Day" value={data.avgClassesPerDay} color="#EC4899" />
              <StatTile icon="⏰" label="Avg Hours/Day" value={`${data.avgHoursPerDay}h`} color="#14B8A6" />
              {data.earliestClass && <StatTile icon="🌅" label="Earliest Class" value={formatTime(data.earliestClass)} color="#6366F1" />}
              {data.latestClass && <StatTile icon="🌆" label="Latest Class" value={formatTime(data.latestClass)} color="#F97316" />}
            </div>
            {!data.bellSchedule && (
              <div style={{ padding: '0 16px 12px' }}>
                <div className="info-note info-note-amber" style={{ fontSize: 12 }}>
                  ⚠️ No bell schedule configured — hour calculations are estimated.
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── SUBJECT REPORT ── */}
          {subjectStats.length > 0 && (
            <SectionCard title="📚 Subject Report">
              <div style={{ padding: 16 }}>
                {/* Key metrics */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {mostTaughtSubject && (
                    <div style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#065F46', marginBottom: 4 }}>MOST TAUGHT</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{mostTaughtSubject.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{mostTaughtSubject.classes} classes · {mostTaughtSubject.hours}h</div>
                    </div>
                  )}
                  {leastTaughtSubject && leastTaughtSubject !== mostTaughtSubject && (
                    <div style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9A3412', marginBottom: 4 }}>LEAST TAUGHT</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{leastTaughtSubject.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{leastTaughtSubject.classes} classes · {leastTaughtSubject.hours}h</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  {/* Bar chart: classes per subject */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classes per Subject</div>
                    <ResponsiveContainer width="100%" height={Math.max(160, subjectBarData.length * 32)}>
                      <BarChart data={subjectBarData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="Classes" radius={[0, 4, 4, 0]}>
                          {subjectBarData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie chart: subject distribution */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject Distribution</div>
                    <ResponsiveContainer width="100%" height={Math.max(160, subjectBarData.length * 32)}>
                      <PieChart>
                        <Pie
                          data={subjectPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {subjectPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Subject table */}
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Classes</th>
                      <th>Hours</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectStats.map((s, i) => {
                      const pct = data.totalClasses > 0 ? Math.round((s.classes / data.totalClasses) * 100) : 0;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color && s.color !== '#FFFFFF' ? s.color : CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                              <span className="font-semibold">{s.name}</span>
                            </div>
                          </td>
                          <td>{s.classes}</td>
                          <td>{s.hours}h</td>
                          <td>
                            <span className="badge badge-purple">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── TEACHER REPORT ── */}
          {teacherStats.length > 0 && (
            <SectionCard title="👨‍🏫 Teacher Report">
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {mostActiveTeacher && (
                    <div style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', marginBottom: 4 }}>MOST ACTIVE</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{mostActiveTeacher.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{mostActiveTeacher.classes} classes · {mostActiveTeacher.hours}h · {mostActiveTeacher.subjects.length} subject{mostActiveTeacher.subjects.length !== 1 ? 's' : ''}</div>
                    </div>
                  )}
                  {leastActiveTeacher && leastActiveTeacher !== mostActiveTeacher && (
                    <div style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#5B21B6', marginBottom: 4 }}>LEAST ACTIVE</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{leastActiveTeacher.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{leastActiveTeacher.classes} classes · {leastActiveTeacher.hours}h</div>
                    </div>
                  )}
                </div>

                {/* Teacher workload bar chart */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teacher Workload Distribution</div>
                  <ResponsiveContainer width="100%" height={Math.max(180, teacherBarData.length * 36)}>
                    <BarChart data={teacherBarData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const teacher = teacherBarData.find(t => t.name === label);
                        return (
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{teacher?.fullName ?? label}</div>
                            {payload.map((p: any) => (
                              <div key={p.dataKey} style={{ color: p.color }}>
                                {p.name}: <strong>{p.value}</strong>
                              </div>
                            ))}
                          </div>
                        );
                      }} />
                      <Bar dataKey="Classes" radius={[0, 4, 4, 0]}>
                        {teacherBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Teacher table */}
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Classes</th>
                      <th>Hours</th>
                      <th>Subjects Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherStats.map((t, i) => (
                      <tr key={t.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                              background: CHART_COLORS[i % CHART_COLORS.length] + '20',
                              color: CHART_COLORS[i % CHART_COLORS.length],
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              {t.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span className="font-semibold">{t.name}</span>
                          </div>
                        </td>
                        <td>{t.classes}</td>
                        <td>{t.hours}h</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {t.subjects.slice(0, 4).map(s => (
                              <span key={s} className="badge badge-gray" style={{ fontSize: 10.5 }}>{s}</span>
                            ))}
                            {t.subjects.length > 4 && (
                              <span className="badge badge-purple" style={{ fontSize: 10.5 }}>+{t.subjects.length - 4} more</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── SCHEDULE REPORT ── */}
          {(dayStats.length > 0 && (data.isGenerated || data.bellSchedule)) && (
            <SectionCard title="🗓️ Schedule Report">
              <div style={{ padding: 16 }}>
                {data.isGenerated ? (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                      {busiestDay && (
                        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#9F1239', marginBottom: 4 }}>BUSIEST DAY</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{busiestDay.day}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{busiestDay.classes} classes · {busiestDay.hours}h</div>
                        </div>
                      )}
                      {leastBusyDay && leastBusyDay !== busiestDay && (
                        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#065F46', marginBottom: 4 }}>LEAST BUSY</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{leastBusyDay.day}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{leastBusyDay.classes} classes · {leastBusyDay.hours}h</div>
                        </div>
                      )}
                      {longestDay && (
                        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF', marginBottom: 4 }}>LONGEST DAY</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{longestDay.day}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{longestDay.hours}h teaching</div>
                        </div>
                      )}
                      {shortestDay && shortestDay !== longestDay && (
                        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#713F12', marginBottom: 4 }}>SHORTEST DAY</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{shortestDay.day}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{shortestDay.hours}h teaching</div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                      {/* Classes per day chart */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classes per Day</div>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={dayStats} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="classes" name="Classes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Hours per day chart */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours per Day</div>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={dayStats} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="hours" name="Hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    <div className="info-note info-note-blue" style={{ fontSize: 12, marginBottom: 12 }}>
                      ℹ️ Schedule analysis is based on configured working days. Generate the timetable to see actual day-by-day distribution.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(data.bellSchedule?.working_days ?? []).map(day => (
                        <span key={day} className="badge badge-blue">{day}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day table (only for generated) */}
                {data.isGenerated && dayStats.some(d => d.classes > 0) && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Classes</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayStats.map(d => (
                        <tr key={d.day}>
                          <td className="font-semibold">{d.day}</td>
                          <td>{d.classes}</td>
                          <td>{d.hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </SectionCard>
          )}

          {/* ── INSIGHTS ── */}
          {insights.length > 0 && (
            <SectionCard title="💡 Insights">
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                {insights.map((ins, i) => (
                  <InsightCard key={i} icon={ins.icon} text={ins.text} color={ins.color} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Empty state when no lessons at all */}
          {data.lessons.length === 0 && !data.isGenerated && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No lessons configured yet</div>
              <div style={{ fontSize: 13 }}>Add lessons to this timetable to see reports.</div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const timetables = await timetableApi.list();
        if (cancelled) return;
        if (timetables.length === 0) { setLoading(false); return; }

        // Fetch all data for each timetable in parallel
        const results = await Promise.all(
          timetables.map(async (tt) => {
            const [lessons, subjects, faculty, classrooms, entries, bell] = await Promise.all([
              lessonApi.list(tt.id).catch(() => [] as Lesson[]),
              subjectApi.list(tt.id).catch(() => [] as Subject[]),
              facultyApi.list(tt.id).catch(() => [] as Faculty[]),
              classroomApi.list(tt.id).catch(() => [] as Classroom[]),
              timetableEntryApi.list(tt.id).catch(() => [] as TimetableEntry[]),
              bellScheduleApi.get(tt.id).catch(() => null as BellSchedule | null),
            ]);
            return computeReport(tt, lessons, subjects, faculty, bell, entries, classrooms);
          })
        );

        if (!cancelled) {
          setReports(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Global stats ────────────────────────────────────────────────────────────
  const globalTotalClasses = reports.reduce((s, r) => s + r.totalClasses, 0);
  const globalTotalHours = Math.round(reports.reduce((s, r) => s + r.totalTeachingHours, 0) * 10) / 10;
  const globalSubjects = new Set(reports.flatMap(r => r.subjects.map(s => s.id))).size;
  const globalTeachers = new Set(reports.flatMap(r => r.faculty.map(f => f.id))).size;
  const avgClassesPerTimetable = reports.length > 0
    ? Math.round((globalTotalClasses / reports.length) * 10) / 10
    : 0;

  return (
    <div className="fade-in">
      {/* Top header */}
      <div className="top-header">
        <div>
          <h1 className="header-greeting">Reports &amp; Insights</h1>
          <p className="header-sub">Detailed analytics for every timetable — all data is live and accurate</p>
        </div>
        {loading && <span className="text-sm text-muted pulse">Loading data…</span>}
      </div>

      <div className="page-content" style={{ maxWidth: 1200 }}>
        {error && (
          <div className="info-note info-note-amber" style={{ marginBottom: 20 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 80, background: 'var(--color-border-light)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '56px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
              <h2 style={{ marginBottom: 8 }}>No Timetables Found</h2>
              <p className="text-muted">Create a timetable to start seeing reports and insights here.</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── GLOBAL OVERVIEW ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-surface)', fontSize: 15,
                }}>🌐</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>Global Overview</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Aggregated stats across all {reports.length} timetable{reports.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                <StatTile icon="📋" label="Total Timetables" value={reports.length} />
                <StatTile icon="🏫" label="Total Classes" value={globalTotalClasses} color="#3B82F6" />
                <StatTile icon="📚" label="Total Subjects" value={globalSubjects} color="#10B981" />
                <StatTile icon="👨‍🏫" label="Total Teachers" value={globalTeachers} color="#F59E0B" />
                <StatTile icon="⏱️" label="Scheduled Hours" value={`${globalTotalHours}h`} color="#EC4899" />
                <StatTile icon="📊" label="Avg Classes/Timetable" value={avgClassesPerTimetable} color="#6366F1" />
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timetable Reports</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>

            {/* ── PER-TIMETABLE REPORTS ── */}
            {reports.map(r => (
              <TimetableReport key={r.timetable.id} data={r} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
