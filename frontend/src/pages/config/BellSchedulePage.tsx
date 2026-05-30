import { useEffect, useMemo, useState } from 'react';
import { bellScheduleApi } from '../../api';

interface BellSchedulePageProps {
  timetableId: string;
  onBack: () => void;
}

type ScheduleType = 'weekly' | 'fortnightly' | 'custom_cycle' | 'day_rotation';
type PeriodStyle = 'uniform' | 'custom_day';
type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

interface PeriodRow { name: string; start: string; end: string; isBreak?: boolean; }
interface RotationDay { id: string; name: string; short: string; }
interface DayConfig { id: string; name: string; days: string[]; periods: PeriodRow[]; }

const SCHEDULE_TYPES: { id: ScheduleType; label: string; desc: string }[] = [
  { id: 'weekly', label: 'Weekly', desc: 'Same schedule every week' },
  { id: 'fortnightly', label: 'Fortnightly', desc: '2-week alternating schedule' },
  { id: 'custom_cycle', label: 'Custom Cycle', desc: '3+ week schedule' },
  { id: 'day_rotation', label: 'Day Rotation', desc: 'Custom named days (A/B, 8-day...)' },
];

const CONFIG_STYLES: { id: PeriodStyle; label: string; desc: string }[] = [
  { id: 'uniform', label: 'Uniform Schedule', desc: 'Same periods every working day. Simple and straightforward.' },
  { id: 'custom_day', label: 'Custom Day Schedule', desc: 'Different periods for different days. E.g., shorter Fridays.' },
];

const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultPeriod = (n: number): PeriodRow => ({ name: `Period ${n}`, start: '09:00', end: '09:45', isBreak: false });
const makeRotationDay = (n: number): RotationDay => ({ id: `r${Date.now()}-${n}`, name: `Day ${n}`, short: `D${n}` });

function addPeriodAfter(rows: PeriodRow[]): PeriodRow[] {
  const last = rows[rows.length - 1];
  const [h, m] = last ? last.end.split(':').map(Number) : [9, 0];
  const startMins = h * 60 + m + (last ? 5 : 0);
  const endMins = startMins + 45;
  const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const nonBreakCount = rows.filter((p) => !p.isBreak).length;
  return [...rows, { name: `Period ${nonBreakCount + 1}`, start: fmt(startMins), end: fmt(endMins), isBreak: false }];
}

function TimeInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [h24, m] = value.split(':').map(Number);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;

  const handleHour = (e: React.ChangeEvent<HTMLSelectElement>) => {
    let newH = Number(e.target.value);
    if (ampm === 'PM' && newH !== 12) newH += 12;
    if (ampm === 'AM' && newH === 12) newH = 0;
    onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handleMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newM = parseInt(e.target.value || '0', 10);
    if (newM < 0) newM = 0;
    if (newM > 59) newM = 59;
    onChange(`${String(h24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const handleAmPm = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAmPm = e.target.value;
    if (newAmPm === ampm) return;
    let newH = h24;
    if (newAmPm === 'PM' && h24 < 12) newH += 12;
    if (newAmPm === 'AM' && h24 >= 12) newH -= 12;
    onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select className="form-input" style={{ padding: '6px', width: 55, textAlign: 'center' }} value={h12} onChange={handleHour}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ fontWeight: 600 }}>:</span>
      <input type="number" min="0" max="59" className="form-input" style={{ padding: '6px', width: 55, textAlign: 'center' }} value={String(m).padStart(2, '0')} onChange={handleMin} onBlur={(e) => {
        const val = parseInt(e.target.value || '0', 10);
        e.target.value = String(val).padStart(2, '0');
      }} />
      <select className="form-input" style={{ padding: '6px', width: 60 }} value={ampm} onChange={handleAmPm}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function BellSchedulePage({ timetableId, onBack }: BellSchedulePageProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [configStyle, setConfigStyle] = useState<PeriodStyle>('uniform');
  const [workingDaysByWeek, setWorkingDaysByWeek] = useState<string[][]>([['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']]);
  const [periods, setPeriods] = useState<PeriodRow[]>([defaultPeriod(1)]);
  const [periodConfigs, setPeriodConfigs] = useState<DayConfig[]>([]);
  const [rotationDays, setRotationDays] = useState<RotationDay[]>([1, 2, 3, 4, 5].map((i) => makeRotationDay(i)));
  const [fortnightlyStartDate, setFortnightlyStartDate] = useState('');
  const [customCycleWeeks, setCustomCycleWeeks] = useState(4);
  const [fixedDuration, setFixedDuration] = useState(false);
  const [programStartDate, setProgramStartDate] = useState('');
  const [programEndDate, setProgramEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [loading, setLoading] = useState(true);

  const weekCount = scheduleType === 'weekly' ? 1 : scheduleType === 'fortnightly' ? 2 : scheduleType === 'custom_cycle' ? Math.max(customCycleWeeks, 3) : 1;

  useEffect(() => {
    setWorkingDaysByWeek((prev) => {
      const next = Array.from({ length: weekCount }, (_, i) => prev[i] ?? []);
      return next;
    });
  }, [weekCount]);

  useEffect(() => {
    bellScheduleApi.get(timetableId)
      .then((res) => {
        if (!res) return;
        setScheduleType(res.schedule_type as ScheduleType);
        setConfigStyle(res.period_config_style as PeriodStyle);
        const incomingDays = res.working_days ?? [];
        setWorkingDaysByWeek(Array.from({ length: weekCount }, () => [...incomingDays]));
        if (res.periods?.length) {
          setPeriods(res.periods.filter((p) => !p.day_of_week).map((p) => ({
            name: p.name,
            start: p.start_time,
            end: p.end_time,
            isBreak: p.is_break,
          })) || [defaultPeriod(1)]);
          const byDay = new Map<string, PeriodRow[]>();
          res.periods.filter((p) => !!p.day_of_week).forEach((p) => {
            const day = p.day_of_week as string;
            const rows = byDay.get(day) ?? [];
            rows.push({ name: p.name, start: p.start_time, end: p.end_time, isBreak: p.is_break });
            byDay.set(day, rows);
          });
          if (byDay.size > 0) {
            setConfigStyle('custom_day');
            
            // Group days that have exactly the same periods into a single Config
            const configsByString = new Map<string, { days: string[], periods: PeriodRow[] }>();
            
            Array.from(byDay.entries()).forEach(([day, rows]) => {
              const hash = JSON.stringify(rows);
              if (!configsByString.has(hash)) {
                configsByString.set(hash, { days: [], periods: rows });
              }
              configsByString.get(hash)!.days.push(day);
            });
            
            setPeriodConfigs(Array.from(configsByString.values()).map((cfg, idx) => ({
              id: `cfg-${idx + 1}`,
              name: `Config ${idx + 1}`,
              days: cfg.days,
              periods: cfg.periods.length ? cfg.periods : [defaultPeriod(1)],
            })));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timetableId, weekCount]);

  useEffect(() => {
    if (!savedTick) return;
    const t = setTimeout(() => setSavedTick(false), 2500);
    return () => clearTimeout(t);
  }, [savedTick]);

  const allWorkingDayKeys = useMemo(() => {
    if (scheduleType === 'day_rotation') return rotationDays.map((d) => d.name).filter(Boolean);
    // Backend persists a single `working_days` list (shared across weeks),
    // so custom-day period assignment must also use the plain day names.
    const merged = new Set<string>(workingDaysByWeek.flat());
    return Array.from(merged);
  }, [rotationDays, scheduleType, weekCount, workingDaysByWeek]);

  const totalSelectedDays = useMemo(() => {
    if (scheduleType === 'day_rotation') return rotationDays.length;
    return workingDaysByWeek.reduce((sum, week) => sum + week.length, 0);
  }, [rotationDays.length, scheduleType, workingDaysByWeek]);

  const toggleDayForWeek = (weekIdx: number, day: DayName) => {
    setWorkingDaysByWeek((prev) => prev.map((week, idx) => {
      if (idx !== weekIdx) return week;
      return week.includes(day) ? week.filter((d) => d !== day) : [...week, day];
    }));
  };

  const setWeekdays = (weekIdx: number) => setWorkingDaysByWeek((prev) => prev.map((week, idx) => idx === weekIdx ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] : week));
  const clearWeek = (weekIdx: number) => setWorkingDaysByWeek((prev) => prev.map((week, idx) => idx === weekIdx ? [] : week));
  const copyWeek1 = (weekIdx: number) => setWorkingDaysByWeek((prev) => prev.map((week, idx) => idx === weekIdx ? [...(prev[0] ?? [])] : week));

  const addUniformPeriod = () => setPeriods((prev) => addPeriodAfter(prev));
  const addBreakAfter = (index: number) => {
    setPeriods((prev) => {
      const after = prev[index];
      const breakCount = prev.filter((p) => p.isBreak).length;
      const breakRow: PeriodRow = { name: `Break ${breakCount + 1}`, start: after.end, end: after.end, isBreak: true };
      const next = [...prev];
      next.splice(index + 1, 0, breakRow);
      return next;
    });
  };

  const addConfig = () => setPeriodConfigs((prev) => [...prev, { id: `cfg-${Date.now()}`, name: `Config ${prev.length + 1}`, days: [], periods: [defaultPeriod(1)] }]);
  const assignedDays = new Set(periodConfigs.flatMap((cfg) => cfg.days));
  const allDaysConfigured = allWorkingDayKeys.length > 0 && allWorkingDayKeys.every((d) => assignedDays.has(d));

  // In custom-day mode we want a working day to belong to only one configuration.
  // We use "earlier configuration wins" ordering: selecting a day in config N removes it from configs N+1+.
  const toggleConfigDay = (cfgIdx: number, day: string) => {
    setPeriodConfigs((prev) => {
      const next = prev.map((c) => ({ ...c, days: [...c.days] }));
      const cfg = next[cfgIdx];
      const isSelected = cfg.days.includes(day);

      if (isSelected) {
        cfg.days = cfg.days.filter((d) => d !== day);
        return next;
      }

      cfg.days = [...cfg.days, day];
      for (let i = cfgIdx + 1; i < next.length; i++) {
        if (next[i].days.includes(day)) {
          next[i].days = next[i].days.filter((d) => d !== day);
        }
      }
      return next;
    });
  };

  // Defensive normalization: if state ever contains overlaps, earlier configs win.
  useEffect(() => {
    setPeriodConfigs((prev) => {
      const used = new Set<string>();
      let changed = false;
      const next = prev.map((cfg) => {
        const filtered = cfg.days.filter((d) => {
          if (used.has(d)) {
            changed = true;
            return false;
          }
          used.add(d);
          return true;
        });
        if (filtered.length !== cfg.days.length) changed = true;
        return { ...cfg, days: filtered };
      });
      return changed ? next : prev;
    });
  }, [periodConfigs.length]);

  const payloadWorkingDays = useMemo(() => {
    if (scheduleType === 'day_rotation') return rotationDays.map((d) => d.name.trim()).filter(Boolean);
    const merged = new Set(workingDaysByWeek.flat());
    return Array.from(merged);
  }, [rotationDays, scheduleType, workingDaysByWeek]);

  const payloadPeriods = useMemo(() => {
    if (configStyle === 'uniform') {
      return periods.map((p, idx) => ({ name: p.name, start_time: p.start, end_time: p.end, is_break: !!p.isBreak, order: idx + 1 }));
    }
    let order = 1;
    return periodConfigs.flatMap((cfg) =>
      cfg.days.flatMap((day) =>
        cfg.periods.map((p) => ({
          name: p.name,
          start_time: p.start,
          end_time: p.end,
          is_break: !!p.isBreak,
          order: order++,
          day_of_week: day,
        })),
      ),
    );
  }, [configStyle, periodConfigs, periods]);

  const handleSave = async (goBackAfterSave: boolean) => {
    setSaving(true);
    try {
      await bellScheduleApi.save(timetableId, {
        schedule_type: scheduleType,
        period_config_style: configStyle,
        working_days: payloadWorkingDays,
        periods: payloadPeriods,
      } as any);
      localStorage.setItem(`bell-meta-${timetableId}`, JSON.stringify({
        fortnightlyStartDate, customCycleWeeks, fixedDuration, programStartDate, programEndDate, rotationDays,
      }));
      setSavedTick(true);
      if (goBackAfterSave) onBack();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem(`bell-meta-${timetableId}`);
    if (!raw) return;
    try {
      const meta = JSON.parse(raw);
      setFortnightlyStartDate(meta.fortnightlyStartDate ?? '');
      setCustomCycleWeeks(meta.customCycleWeeks ?? 4);
      setFixedDuration(!!meta.fixedDuration);
      setProgramStartDate(meta.programStartDate ?? '');
      setProgramEndDate(meta.programEndDate ?? '');
      if (Array.isArray(meta.rotationDays) && meta.rotationDays.length) setRotationDays(meta.rotationDays);
    } catch {}
  }, [timetableId]);

  if (loading) return <div className="fade-in"><div className="page-content text-center text-muted">Loading...</div></div>;

  return (
    <>
      <div className="fade-in" style={{ paddingBottom: 88 }}>
      <div className="top-header">
        <div>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Timetables</span>
            <span className="breadcrumb-sep">/</span>
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={onBack}>Overview</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Bell Schedule</span>
          </div>
          <h1 className="header-greeting">Bell Schedule</h1>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 1100 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Schedule Type</span></div>
          <div className="card-body">
            <div className="schedule-cards">
              {SCHEDULE_TYPES.map((st) => (
                <div key={st.id} id={`schedule-type-${st.id}`} className={`schedule-card${scheduleType === st.id ? ' selected' : ''}`} onClick={() => setScheduleType(st.id)}>
                  <div className="schedule-card-title">{st.label}</div>
                  <div className="schedule-card-desc">{st.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {scheduleType === 'fortnightly' && (
          <div className="card" style={{ marginBottom: 20, borderColor: '#C7D2FE', background: '#EEF2FF' }}>
            <div className="card-header"><span className="card-title">Fortnightly Configuration</span></div>
            <div className="card-body">
              <div className="text-sm text-muted" style={{ marginBottom: 10 }}>Set the Week 1 anchor date for publishing. Optional while drafting.</div>
              <label className="form-label">Week 1 Start Date <span className="text-muted">(Optional)</span></label>
              <input type="date" className="form-input" value={fortnightlyStartDate} onChange={(e) => setFortnightlyStartDate(e.target.value)} />
            </div>
          </div>
        )}

        {scheduleType === 'custom_cycle' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Custom Cycle Configuration</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>Number of Weeks</label>
                <input type="number" min={3} className="form-input" style={{ width: 80 }} value={customCycleWeeks}
                  onChange={(e) => setCustomCycleWeeks(Math.max(3, Number(e.target.value || 3)))} />
                <span className="text-sm text-muted">weeks</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <input type="checkbox" checked={fixedDuration} onChange={(e) => setFixedDuration(e.target.checked)} />
                <span>
                  <div style={{ fontWeight: 600 }}>Fixed duration (non-repeating)</div>
                  <div className="text-sm text-muted">Enable for programs that run once with a set start and end date.</div>
                </span>
              </label>
              {fixedDuration && (
                <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>{customCycleWeeks}-Week Program Configuration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label">Program Start Date *</label>
                      <input type="date" className="form-input" value={programStartDate} onChange={(e) => setProgramStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Program End Date *</label>
                      <input type="date" className="form-input" value={programEndDate} disabled={!programStartDate} onChange={(e) => setProgramEndDate(e.target.value)} />
                      {!programStartDate && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Select a start date first</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {scheduleType === 'day_rotation' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Rotation Days</span>
              <span className="badge badge-green">{rotationDays.length} days in rotation</span>
            </div>
            <div className="card-body">
              {rotationDays.map((day, idx) => (
                <div key={day.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <div className="text-muted">{idx + 1}.</div>
                  <input className="form-input" value={day.name} onChange={(e) => setRotationDays((prev) => prev.map((d) => d.id === day.id ? { ...d, name: e.target.value } : d))} />
                  <input className="form-input" value={day.short} onChange={(e) => setRotationDays((prev) => prev.map((d) => d.id === day.id ? { ...d, short: e.target.value } : d))} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setRotationDays((prev) => prev.filter((d) => d.id !== day.id))}>✕</button>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => setRotationDays((prev) => [...prev, makeRotationDay(prev.length + 1)])}>+ Add day</button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Default Schedule</span></div>
          <div className="card-body">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Period Configuration Style</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              {CONFIG_STYLES.map((cs) => (
                <label key={cs.id} className={`schedule-card${configStyle === cs.id ? ' selected' : ''}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input type="radio" checked={configStyle === cs.id} onChange={() => setConfigStyle(cs.id)} />
                  <span><div className="schedule-card-title">{cs.label}</div><div className="schedule-card-desc">{cs.desc}</div></span>
                </label>
              ))}
            </div>

            {scheduleType !== 'day_rotation' && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Working Days</div>
                {Array.from({ length: weekCount }).map((_, weekIdx) => (
                  <div key={`wk-${weekIdx}`} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div className="text-sm text-muted" style={{ minWidth: 58 }}>Week {weekIdx + 1}</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setWeekdays(weekIdx)}>Weekdays</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => clearWeek(weekIdx)}>Clear</button>
                      {weekIdx > 0 && <button className="btn btn-ghost btn-sm" onClick={() => copyWeek1(weekIdx)}>Copy W1</button>}
                    </div>
                    <div className="day-pills">
                      {DAYS.map((day) => (
                        <button key={`${weekIdx}-${day}`} className={`day-pill${workingDaysByWeek[weekIdx]?.includes(day) ? ' selected' : ''}`} onClick={() => toggleDayForWeek(weekIdx, day)}>
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="badge badge-green">{totalSelectedDays} day{totalSelectedDays !== 1 ? 's' : ''} selected across {weekCount} week{weekCount !== 1 ? 's' : ''}</div>
              </div>
            )}

            {configStyle === 'uniform' ? (
              <div style={{ marginTop: 6 }}>
                <div className="card-header" style={{ padding: 0, border: 'none', marginBottom: 8 }}>
                  <span className="card-title">Periods & Breaks</span>
                  <button className="btn btn-outline btn-sm" onClick={addUniformPeriod}>+ Add Period</button>
                </div>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
                  <tbody>
                    {periods.map((p, idx) => (
                      <tr key={`u-${idx}`} style={{ background: p.isBreak ? '#F8FAFC' : undefined }}>
                        <td><input className="form-input" value={p.name} onChange={(e) => setPeriods((prev) => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} /></td>
                        <td><TimeInput value={p.start} onChange={(val) => setPeriods((prev) => prev.map((r, i) => i === idx ? { ...r, start: val } : r))} /></td>
                        <td><TimeInput value={p.end} onChange={(val) => setPeriods((prev) => prev.map((r, i) => i === idx ? { ...r, end: val } : r))} /></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setPeriods((prev) => prev.filter((_, i) => i !== idx))} disabled={periods.length <= 1}>🗑</button>
                          {!p.isBreak && idx < periods.length - 1 && <button className="btn btn-ghost btn-sm" onClick={() => addBreakAfter(idx)}>+ Break</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-sm text-muted" style={{ marginTop: 8 }}>✓ {totalSelectedDays} working days • {periods.filter((p) => !p.isBreak).length} periods</div>
              </div>
            ) : (
              <div>
                <div className="card-header" style={{ padding: 0, border: 'none', marginBottom: 8 }}>
                  <span className="card-title">Period Configurations</span>
                  <button className="btn btn-outline btn-sm" onClick={addConfig}>+ Add Configuration</button>
                </div>
                {periodConfigs.map((cfg, cfgIdx) => (
                  <div key={cfg.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <input className="form-input" style={{ maxWidth: 240 }} value={cfg.name} onChange={(e) => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, name: e.target.value } : c))} />
                      <button className="btn btn-ghost btn-sm" onClick={() => setPeriodConfigs((prev) => prev.filter((c) => c.id !== cfg.id))}>🗑</button>
                    </div>
                    <div className="text-sm text-muted" style={{ marginBottom: 8 }}>Assign days</div>
                    <div className="day-pills" style={{ marginBottom: 10 }}>
                      {(() => {
                        const assignedInPrev = new Set(periodConfigs.slice(0, cfgIdx).flatMap((c) => c.days));
                        const visibleDays = allWorkingDayKeys.filter((day) => !assignedInPrev.has(day) || cfg.days.includes(day));
                        return visibleDays.map((day) => (
                          <button
                            key={`${cfg.id}-${day}`}
                            className={`day-pill${cfg.days.includes(day) ? ' selected' : ''}`}
                            onClick={() => toggleConfigDay(cfgIdx, day)}
                          >
                            {day}
                          </button>
                        ));
                      })()}
                    </div>
                    <table className="data-table">
                      <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
                      <tbody>
                        {cfg.periods.map((p, idx) => (
                          <tr key={`${cfg.id}-p-${idx}`} style={{ background: p.isBreak ? '#F8FAFC' : undefined }}>
                            <td><input className="form-input" value={p.name} onChange={(e) => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, periods: c.periods.map((r, i) => i === idx ? { ...r, name: e.target.value } : r) } : c))} /></td>
                            <td><TimeInput value={p.start} onChange={(val) => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, periods: c.periods.map((r, i) => i === idx ? { ...r, start: val } : r) } : c))} /></td>
                            <td><TimeInput value={p.end} onChange={(val) => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, periods: c.periods.map((r, i) => i === idx ? { ...r, end: val } : r) } : c))} /></td>
                            <td style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, periods: c.periods.filter((_, i) => i !== idx) } : c))} disabled={cfg.periods.length <= 1}>🗑</button>
                              {!p.isBreak && idx < cfg.periods.length - 1 && <button className="btn btn-ghost btn-sm" onClick={() => setPeriodConfigs((prev) => prev.map((c) => {
                                if (c.id !== cfg.id) return c;
                                const next = [...c.periods];
                                const breakCount = c.periods.filter((x) => x.isBreak).length;
                                next.splice(idx + 1, 0, { name: `Break ${breakCount + 1}`, start: p.end, end: p.end, isBreak: true });
                                return { ...c, periods: next };
                              }))}>+ Break</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setPeriodConfigs((prev) => prev.map((c) => c.id === cfg.id ? { ...c, periods: addPeriodAfter(c.periods) } : c))}>+ Add Period</button>
                    <div className="text-xs text-muted" style={{ marginTop: 8 }}>{cfg.days.length} days • {cfg.periods.filter((p) => !p.isBreak).length} periods</div>
                  </div>
                ))}
                {allDaysConfigured && <div className="badge badge-green">✓ All days configured</div>}
                <div className="text-sm text-muted" style={{ marginTop: 8 }}>✓ {totalSelectedDays} working days • {periodConfigs.length} configurations</div>
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
      <div style={{ position: 'fixed', left: 'var(--sidebar-width)', right: 0, bottom: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', height: 64, padding: '0 24px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', zIndex: 20 }}>
        <button className="btn btn-outline" onClick={onBack}>← Back to Overview</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          {savedTick && <span className="badge badge-green">✓ Saved</span>}
        </div>
        <button id="bell-save-continue" className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Continue →'}
        </button>
      </div>
    </>
  );
}