import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { bellScheduleApi, timetableApi, facultyApi, classroomApi, subjectApi, lessonApi, roomApi, generationApi, timetableEntryApi } from '../api';
import type { Timetable, Classroom, Subject, Lesson, Faculty, Room, BellSchedule, TimetableEntry } from '../types';

interface EditorPageProps {
  timetableId: string;
  onBack: () => void;
}

type ViewMode = 'section' | 'faculty' | 'room';
type SectionLayoutMode = 'by_entity' | 'single_class';

export default function TimetableEditorPage({ timetableId, onBack }: EditorPageProps) {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [bellSchedule, setBellSchedule] = useState<BellSchedule | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('section');
  const [sectionLayoutMode, setSectionLayoutMode] = useState<SectionLayoutMode>('by_entity');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  const loadEditorData = async () => {
    const [t, bs, c, s, l, f, r, e] = await Promise.all([
      timetableApi.get(timetableId),
      bellScheduleApi.get(timetableId).catch(() => null),
      classroomApi.list(timetableId),
      subjectApi.list(timetableId),
      lessonApi.list(timetableId),
      facultyApi.list(timetableId),
      roomApi.list(timetableId),
      timetableEntryApi.list(timetableId),
    ]);
    setTimetable(t);
    setBellSchedule(bs);
    setClassrooms(c);
    setSubjects(s);
    setLessons(l);
    setFaculty(f);
    setRooms(r);
    setEntries(e);
  };

  useEffect(() => {
    loadEditorData().catch(() => {});
  }, [timetableId]);

  useEffect(() => {
    if (selectedClassroomId) return;
    if (classrooms.length > 0) setSelectedClassroomId(classrooms[0].id);
  }, [classrooms, selectedClassroomId]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const job = await generationApi.getStatus(timetableId, jobId);
        setJobStatus(job.status);
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          setGenerating(false);
          if (job.status === 'completed') {
            loadEditorData().catch(() => {});
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, timetableId]);

  const handleGenerate = async () => {
    setGenerating(true); setError(''); setJobStatus('pending');
    try {
      const job = await generationApi.start(timetableId);
      setJobId(job.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setGenerating(false);
    }
  };

  const getDurationMins = (start: string, end: string) => {
    if (!start || !end) return 15;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  const getEntryColor = (entry: TimetableEntry) => {
    const lesson = lessonById.get(entry.lesson_id);
    const explicitSubject = entry.subject_id ? subjectById.get(entry.subject_id) : undefined;
    const fallbackSubjectId = explicitSubject ? undefined : lesson?.subject_ids?.[0];
    const subject = explicitSubject ?? (fallbackSubjectId ? subjectById.get(fallbackSubjectId) : undefined);
    return subject?.display_color || 'var(--color-blue)';
  };

  const workingDays = bellSchedule?.working_days ?? [];
  const bellPeriods = (bellSchedule?.periods ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const getDayColumns = (day: string) => {
    const dayPeriods = bellPeriods.filter(p => !p.day_of_week || p.day_of_week === day);
    let nextNumber = 1;
    return dayPeriods.map((p) => {
      if (p.is_break) {
        return { type: 'break' as const, id: p.id, name: p.name, start: p.start_time, end: p.end_time };
      }
      return { type: 'period' as const, id: p.id, name: p.name, start: p.start_time, end: p.end_time, number: nextNumber++ };
    });
  };

  const hasAnyPeriods = bellPeriods.length > 0;

  const entities = viewMode === 'section' ? classrooms : viewMode === 'faculty' ? faculty : rooms;

  const entryLookup = new Map<string, TimetableEntry>();
  entries.forEach((entry) => {
    const ownerId = viewMode === 'section' ? entry.classroom_id : viewMode === 'faculty' ? entry.faculty_id : entry.room_id;
    if (!ownerId) return;
    const key = `${ownerId}-${entry.day_of_week}-${entry.period_number}`;
    if (!entryLookup.has(key)) entryLookup.set(key, entry);
  });

  const unscheduledLessons = lessons.filter((lesson) => {
    const allocated = entries.filter((entry) => entry.lesson_id === lesson.id).length;
    return allocated < lesson.periods_per_week;
  });

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const classroomById = new Map(classrooms.map((c) => [c.id, c]));
  const facultyById = new Map(faculty.map((f) => [f.id, f]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const renderEntryText = (entry: TimetableEntry) => {
    const lesson = lessonById.get(entry.lesson_id);
    const explicitSubject = entry.subject_id ? subjectById.get(entry.subject_id) : undefined;
    const fallbackSubjectId = explicitSubject ? undefined : lesson?.subject_ids?.[0];
    const subject = explicitSubject ?? (fallbackSubjectId ? subjectById.get(fallbackSubjectId) : undefined);
    const baseLabel = subject?.short_name ?? 'Lesson';

    if (viewMode === 'section') {
      const facultyId = entry.faculty_id ?? lesson?.faculty_ids?.[0];
      const fac = facultyId ? facultyById.get(facultyId) : undefined;
      return fac ? `${baseLabel} (${fac.short_name})` : baseLabel;
    }

    if (viewMode === 'faculty') {
      const classroomId = entry.classroom_id ?? lesson?.classroom_id;
      const cls = classroomId ? classroomById.get(classroomId) : undefined;
      return cls ? `${baseLabel} (${cls.short_name})` : baseLabel;
    }

    if (viewMode === 'room') {
      const roomId = entry.room_id;
      const room = roomId ? roomById.get(roomId) : undefined;
      return room ? `${baseLabel} (${room.short_name})` : baseLabel;
    }

    return baseLabel;
  };

  const entityName = (entity: Classroom | Faculty | Room) => {
    if ('full_name' in entity) return entity.full_name;
    return entity.name;
  };

  const handleDownloadPdf = async () => {
    const exportEl = tableRef.current ?? gridRef.current;
    if (!exportEl) return;
    try {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '0';
      wrapper.style.top = '0';
      wrapper.style.zIndex = '-1000';
      wrapper.style.background = 'var(--color-surface)';
      wrapper.style.padding = '16px';
      wrapper.style.overflow = 'visible';

      const clone = exportEl.cloneNode(true) as HTMLElement;
      clone.style.overflow = 'visible';
      clone.style.maxHeight = 'none';
      clone.style.maxWidth = 'none';

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const width = wrapper.scrollWidth;
      const height = wrapper.scrollHeight;

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#ffffff',
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      });
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const ratio = Math.min(pageWidth / imgWidthPx, pageHeight / imgHeightPx);
      const renderWidth = imgWidthPx * ratio;
      const renderHeight = imgHeightPx * ratio;
      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;

      // Use JPEG with 0.7 quality to reduce file size
      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight);
      const safeName = (timetable?.name || 'timetable').replace(/[^\w\-]+/g, '_');
      pdf.save(`${safeName}-${viewMode}.pdf`);

      document.body.removeChild(wrapper);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to export timetable PDF', err);
    }
  };

  const downloadDayByDayPdf = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    const safeName = (timetable?.name || 'timetable').replace(/[^\w\-]+/g, '_');

    workingDays.forEach((day, dayIdx) => {
      if (dayIdx > 0) {
        doc.addPage();
      }

      const cols = getDayColumns(day);
      const tableCols = [
        { header: viewMode === 'section' ? 'Classes' : viewMode === 'faculty' ? 'Faculty' : 'Rooms', dataKey: 'entity' },
        ...cols.map(c => ({
          header: c.type === 'break' ? '' : `Period ${c.number}\n${c.start}-${c.end}`,
          dataKey: c.id
        }))
      ];

      const tableBody = entities.map((entity) => {
        const rowData: Record<string, any> = { entity: entityName(entity) };
        cols.forEach(col => {
            if (col.type === 'break') {
              rowData[col.id] = { content: `${(col.name || 'Break').toUpperCase()}\n${col.start}-${col.end}`, styles: { halign: 'center', valign: 'middle', fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' } };
            } else {
            const entry = entryLookup.get(`${entity.id}-${day}-${col.number}`);
            rowData[col.id] = entry ? renderEntryText(entry) : '-';
          }
        });
        return rowData;
      });

      autoTable(doc, {
        columns: tableCols,
        body: tableBody,
        margin: { top: 40 },
        styles: { fontSize: 8, cellPadding: 4, halign: 'center', valign: 'middle', minCellHeight: 30 },
        columnStyles: { entity: { halign: 'left', fontStyle: 'bold' } },
        didDrawPage: (data) => {
          doc.setFontSize(14);
          const title = `${timetable?.name || 'Timetable'} - ${day}`;
          const subtitle = `View: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}`;
          doc.text(title, data.settings.margin.left || 40, 25);
          doc.setFontSize(10);
          doc.text(subtitle, data.settings.margin.left || 40, 35);
        }
      });
    });

    doc.save(`${safeName}-${viewMode}-day-by-day.pdf`);
    setShowDownloadMenu(false);
  };

  const downloadClasswisePdf = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    const safeName = (timetable?.name || 'timetable').replace(/[^\w\-]+/g, '_');

    const normalDays = workingDays.filter(d => d.toLowerCase() !== 'friday');
    const hasFriday = workingDays.some(d => d.toLowerCase() === 'friday');

    classrooms.forEach((classroom, classIdx) => {
      if (classIdx > 0) {
        doc.addPage();
      }

      doc.setFontSize(14);
      doc.text(`${timetable?.name || 'Timetable'} - Class: ${classroom.short_name || classroom.name}`, 40, 30);

      let startY = 45;

      if (normalDays.length > 0) {
        const normalCols = getDayColumns(normalDays[0]);
        
        const tableCols = [
          { header: 'Day', dataKey: 'day' },
          ...normalCols.map(c => ({
            header: c.type === 'break' ? '' : `Period ${c.number}\n${c.start}-${c.end}`,
            dataKey: c.id
          }))
        ];

        const tableBody = normalDays.map((day) => {
          const cols = getDayColumns(day);
          const rowData: Record<string, any> = { day };
          
          normalCols.forEach((col, i) => {
            const dayCol = cols.find(c => c.id === col.id) || cols[i] || col;
            if (dayCol.type === 'break') {
              rowData[col.id] = { content: `${(dayCol.name || 'Break').toUpperCase()}\n${dayCol.start}-${dayCol.end}`, styles: { halign: 'center', valign: 'middle', fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' } };
            } else {
              const entry = entryLookup.get(`${classroom.id}-${day}-${dayCol.number}`);
              rowData[col.id] = entry ? renderEntryText(entry) : '-';
            }
          });
          return rowData;
        });

        autoTable(doc, {
          columns: tableCols,
          body: tableBody,
          startY: startY,
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8, cellPadding: 6, halign: 'center', valign: 'middle', minCellHeight: 35 },
          columnStyles: { day: { halign: 'left', fontStyle: 'bold' } },
        });
        
        startY = (doc as any).lastAutoTable.finalY + 20;
      }

      if (hasFriday) {
        const friCols = getDayColumns('Friday');
        
        const tableCols = [
          { header: 'Friday', dataKey: 'day' },
          ...friCols.map(c => ({
            header: c.type === 'break' ? '' : `Period ${c.number}\n${c.start}-${c.end}`,
            dataKey: c.id
          }))
        ];

        const tableBody = [{
          day: 'Friday',
          ...Object.fromEntries(friCols.map(col => {
            if (col.type === 'break') {
              return [col.id, { content: `${(col.name || 'Break').toUpperCase()}\n${col.start}-${col.end}`, styles: { halign: 'center', valign: 'middle', fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' } }];
            } else {
              const entry = entryLookup.get(`${classroom.id}-Friday-${col.number}`);
              return [col.id, entry ? renderEntryText(entry) : '-'];
            }
          }))
        }];

        autoTable(doc, {
          columns: tableCols,
          body: tableBody,
          startY: startY,
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8, cellPadding: 6, halign: 'center', valign: 'middle', minCellHeight: 35 },
          columnStyles: { day: { halign: 'left', fontStyle: 'bold' } },
        });
      }
    });

    doc.save(`${safeName}-classwise.pdf`);
    setShowDownloadMenu(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>
      {/* Editor Top Bar */}
      <div style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <button id="editor-back-btn" className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <span className="font-bold" style={{ fontSize: 15 }}>{timetable?.name || 'Loading…'}</span>
        <div className="divider" style={{ width: 1, height: 24, margin: '0 4px' }} />

        {/* View toggles */}
        <div className="tabs" style={{ margin: 0 }}>
          {(['section', 'faculty', 'room'] as ViewMode[]).map(v => (
            <button key={v} id={`view-${v}`} className={`tab${viewMode === v ? ' active' : ''}`} onClick={() => setViewMode(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {viewMode === 'section' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 10 }}>
            <div className="tabs" style={{ margin: 0 }}>
              <button
                id="section-layout-entity"
                className={`tab${sectionLayoutMode === 'by_entity' ? ' active' : ''}`}
                onClick={() => setSectionLayoutMode('by_entity')}
              >
                By Class
              </button>
              <button
                id="section-layout-single"
                className={`tab${sectionLayoutMode === 'single_class' ? ' active' : ''}`}
                onClick={() => setSectionLayoutMode('single_class')}
              >
                Single Class
              </button>
            </div>

            {sectionLayoutMode === 'single_class' && (
              <select
                id="single-class-select"
                className="form-input"
                style={{ padding: '6px 10px', fontSize: 13, minWidth: 180 }}
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.short_name || c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative' }} ref={downloadMenuRef}>
          <button
            id="editor-download"
            className="btn btn-outline"
            title="Download PDF Options"
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
          >
            ⬇️ Download
          </button>
          {showDownloadMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 1000,
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 180,
              marginTop: '4px'
            }}>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ justifyContent: 'flex-start', fontWeight: 'normal' }}
                onClick={() => { setShowDownloadMenu(false); handleDownloadPdf(); }}
              >
                🖼️ Current View (Image PDF)
              </button>
              {!(viewMode === 'section' && sectionLayoutMode === 'single_class') && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ justifyContent: 'flex-start', fontWeight: 'normal' }}
                  onClick={downloadDayByDayPdf}
                >
                  📄 Day-by-Day (Text PDF)
                </button>
              )}
              {viewMode === 'section' && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  style={{ justifyContent: 'flex-start', fontWeight: 'normal' }}
                  onClick={downloadClasswisePdf}
                >
                  📄 Full Classwise (Text PDF)
                </button>
              )}
            </div>
          )}
        </div>
        <button
          id="generate-btn"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? `⚡ Generating… (${jobStatus})` : '⚡ Generate'}
        </button>
      </div>

      {error && (
        <div className="info-note info-note-amber" style={{ margin: '8px 20px 0', borderRadius: 'var(--radius-md)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Grid Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <div className="editor-grid" ref={gridRef}>
          <table className="grid-table" ref={tableRef}>
            {(() => {
              const noData = entities.length === 0 || workingDays.length === 0 || !hasAnyPeriods;

              // Single-class layout (days = rows, periods = columns)
              if (viewMode === 'section' && sectionLayoutMode === 'single_class') {
                const classroomId = selectedClassroomId || classrooms[0]?.id;
                const classroom = classroomId ? classroomById.get(classroomId) : undefined;
                
                const normalDays = workingDays.filter(d => d.toLowerCase() !== 'friday');
                const hasFriday = workingDays.some(d => d.toLowerCase() === 'friday');
                const normalCols = normalDays.length > 0 ? getDayColumns(normalDays[0]) : [];
                const friCols = hasFriday ? getDayColumns('Friday') : [];

                return (
                  <>
                    {normalDays.length > 0 && (
                      <>
                        <thead>
                          <tr>
                            <th className="grid-header-cell" style={{ minWidth: 160 }}>
                              {classroom ? `Class: ${classroom.short_name || classroom.name}` : 'Class'}
                            </th>
                            {normalCols.map((col, i) => (
                              <th key={`pcol-${i}`} className="grid-header-cell" style={col.type === 'break' ? { padding: 4, minWidth: 10 } : {}}>
                                {col.type === 'break' ? null : (
                                  <>
                                    <div>Period {col.number}</div>
                                    <div style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 11 }}>
                                      {col.start}–{col.end}
                                    </div>
                                  </>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {noData || !classroomId ? (
                            <tr>
                              <td colSpan={99} style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                                Add bell schedule and resources to render the timetable grid.
                              </td>
                            </tr>
                          ) : (
                            normalDays.map((day, dayIdx) => {
                              const cols = getDayColumns(day);
                              return (
                              <tr key={`day-row-${day}`}>
                                <td className="grid-label-cell">
                                  <div className="font-semibold">{day}</div>
                                </td>
                                {normalCols.map((col, idx) => {
                                  const dayCol = cols.find(c => c.id === col.id) || cols[idx] || col;
                                  if (!dayCol) return <td key={`empty-${day}-${idx}`} className="grid-slot" />;
                                  
                                  if (dayCol.type === 'break') {
                                    if (dayIdx > 0) return null;
                                    return (
                                      <td
                                        key={`${day}-${dayCol.id}`}
                                        className="grid-slot"
                                        rowSpan={normalDays.length}
                                        style={{ padding: 4, background: 'var(--color-bg)', width: Math.max(30, getDurationMins(dayCol.start, dayCol.end) * 1.2), minWidth: Math.max(30, getDurationMins(dayCol.start, dayCol.end) * 1.2) }}
                                        title={`${dayCol.name || 'Break'}\n${dayCol.start} - ${dayCol.end}`}
                                      >
                                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto', fontSize: 16, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontWeight: 700, letterSpacing: 1 }}>{(dayCol.name || 'Break').toUpperCase()}</span>
                                          <span style={{ fontSize: 13, opacity: 0.7 }}>{dayCol.start}-{dayCol.end}</span>
                                        </div>
                                      </td>
                                    );
                                  }

                                  const entry = entryLookup.get(`${classroomId}-${day}-${dayCol.number}`);
                                  return (
                                    <td
                                      key={`${day}-${dayCol.id}`}
                                      id={`slot-${classroomId}-${day}-${dayCol.id}`}
                                      className="grid-slot"
                                      title={entry ? 'Scheduled lesson' : 'Empty slot'}
                                    >
                                      {entry ? (
                                        <div className="lesson-card" style={{ background: getEntryColor(entry), color: 'white', margin: 0 }}>
                                          {renderEntryText(entry)}
                                        </div>
                                      ) : (
                                        <div style={{ color: 'var(--color-border)', fontSize: 20, textAlign: 'center', paddingTop: 12 }}>+</div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            )})
                          )}
                        </tbody>
                      </>
                    )}

                    {hasFriday && (
                      <>
                        <thead>
                          <tr>
                            <th className="grid-header-cell" style={{ minWidth: 160, paddingTop: 32 }}>
                              Friday Schedule
                            </th>
                            {friCols.map((col, i) => (
                              <th key={`pcol-fri-${i}`} className="grid-header-cell" style={col.type === 'break' ? { padding: 4, minWidth: 10, paddingTop: 32 } : { paddingTop: 32 }}>
                                {col.type === 'break' ? null : (
                                  <>
                                    <div>Period {col.number}</div>
                                    <div style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 11 }}>
                                      {col.start}–{col.end}
                                    </div>
                                  </>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {noData || !classroomId ? null : (
                            <tr>
                              <td className="grid-label-cell">
                                <div className="font-semibold">Friday</div>
                              </td>
                              {friCols.map((col) => {
                                if (col.type === 'break') {
                                  return (
                                    <td
                                      key={`Friday-${col.id}`}
                                      className="grid-slot"
                                      style={{ padding: 4, background: 'var(--color-bg)', width: Math.max(30, getDurationMins(col.start, col.end) * 1.2), minWidth: Math.max(30, getDurationMins(col.start, col.end) * 1.2) }}
                                      title={`${col.name || 'Break'}\n${col.start} - ${col.end}`}
                                    >
                                      <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto', fontSize: 16, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontWeight: 700, letterSpacing: 1 }}>{(col.name || 'Break').toUpperCase()}</span>
                                        <span style={{ fontSize: 13, opacity: 0.7 }}>{col.start}-{col.end}</span>
                                      </div>
                                    </td>
                                  );
                                }

                                const entry = entryLookup.get(`${classroomId}-Friday-${col.number}`);
                                return (
                                  <td
                                    key={`Friday-${col.id}`}
                                    id={`slot-${classroomId}-Friday-${col.id}`}
                                    className="grid-slot"
                                    title={entry ? 'Scheduled lesson' : 'Empty slot'}
                                  >
                                    {entry ? (
                                      <div className="lesson-card" style={{ background: getEntryColor(entry), color: 'white', margin: 0 }}>
                                        {renderEntryText(entry)}
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--color-border)', fontSize: 20, textAlign: 'center', paddingTop: 12 }}>+</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          )}
                        </tbody>
                      </>
                    )}
                  </>
                );
              }

                // Default layout (entities = rows, days grouped with gaps)
              return (
                <>
                  <thead>
                    <tr>
                      <th className="grid-header-cell" style={{ minWidth: 140 }}>
                        {viewMode === 'section' ? 'Classes' : viewMode === 'faculty' ? 'Faculty' : 'Rooms'}
                      </th>
                      {workingDays.map((day, dayIdx) => {
                        const cols = getDayColumns(day);
                        return (
                        <React.Fragment key={`day-head-${day}`}>
                          {cols.map((col) => (
                            <th
                              key={`${day}-${col.id}`}
                              className="grid-header-cell"
                              style={col.type === 'break' ? { padding: 4, width: Math.max(30, getDurationMins(col.start, col.end) * 1.2), minWidth: Math.max(30, getDurationMins(col.start, col.end) * 1.2), background: 'var(--color-bg)' } : {}}
                            >
                              {col.type === 'break' ? null : (
                                <>
                                  <div>{day}</div>
                                  <div style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 11 }}>
                                    {col.start}–{col.end}
                                  </div>
                                </>
                              )}
                            </th>
                          ))}
                          {dayIdx < workingDays.length - 1 && (
                            <th className="day-gap-cell" aria-hidden="true" />
                          )}
                        </React.Fragment>
                      )})}
                    </tr>
                  </thead>
                  <tbody>
                    {noData ? (
                      <tr>
                        <td colSpan={99} style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                          Add bell schedule and resources to render the timetable grid.
                        </td>
                      </tr>
                    ) : entities.map((entity, entityIdx) => (
                      <tr key={entity.id}>
                        <td className="grid-label-cell">
                          <div className="font-semibold">{entityName(entity)}</div>
                          <div className="text-xs text-muted">{entity.short_name}</div>
                        </td>
                        {workingDays.map((day, dayIdx) => {
                          const cols = getDayColumns(day);
                          return (
                          <React.Fragment key={`day-body-${entity.id}-${day}`}>
                            {cols.map((col) => {
                              if (col.type === 'break') {
                                if (entityIdx > 0) return null;
                                return (
                                  <td
                                    key={`${day}-${col.id}`}
                                    className="grid-slot"
                                    rowSpan={entities.length}
                                    style={{ padding: 4, background: 'var(--color-bg)', width: Math.max(30, getDurationMins(col.start, col.end) * 1.2), minWidth: Math.max(30, getDurationMins(col.start, col.end) * 1.2) }}
                                    title={`${col.name || 'Break'}\n${col.start} - ${col.end}`}
                                  >
                                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 auto', fontSize: 16, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%', whiteSpace: 'nowrap' }}>
                                      <span style={{ fontWeight: 700, letterSpacing: 1 }}>{(col.name || 'Break').toUpperCase()}</span>
                                      <span style={{ fontSize: 13, opacity: 0.7 }}>{col.start}-{col.end}</span>
                                    </div>
                                  </td>
                                );
                              }

                              const entry = entryLookup.get(`${entity.id}-${day}-${col.number}`);
                              return (
                                <td
                                  key={`${day}-${col.id}`}
                                  id={`slot-${entity.id}-${day}-${col.id}`}
                                  className="grid-slot"
                                  title={entry ? 'Scheduled lesson' : 'Empty slot'}
                                >
                                  {entry ? (
                                    <div className="lesson-card" style={{ background: getEntryColor(entry), color: 'white', margin: 0 }}>
                                      {renderEntryText(entry)}
                                    </div>
                                  ) : (
                                    <div style={{ color: 'var(--color-border)', fontSize: 20, textAlign: 'center', paddingTop: 12 }}>+</div>
                                  )}
                                </td>
                              );
                            })}
                            {dayIdx < workingDays.length - 1 && (
                              <td className="day-gap-cell" aria-hidden="true" />
                            )}
                          </React.Fragment>
                        )})}
                      </tr>
                    ))}
                  </tbody>
                </>
              );
            })()}
          </table>
        </div>
      </div>

      {/* Unscheduled Lessons Bar */}
      <div className="unscheduled-bar">
        <span className="font-semibold text-sm">
          Unscheduled Lessons ({unscheduledLessons.length})
        </span>
        {unscheduledLessons.map(lesson => {
          const subjectId = lesson.subject_ids?.[0];
          const sub = subjectId ? subjects.find(s => s.id === subjectId) : undefined;
          const warnings = timetable?.generation_warnings ?? [];
          const warning = warnings.find(w => w.lesson_id === lesson.id);

          return (
            <div
              key={lesson.id}
              id={`unscheduled-${lesson.id}`}
              className="lesson-card"
              style={{ background: sub?.display_color || 'var(--color-blue)', display: 'flex', flexDirection: 'column', gap: 4 }}
              draggable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{sub?.short_name || 'Lesson'}</span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.3)', color: 'white', fontSize: 10 }}>
                  = {lesson.periods_per_week}P
                </span>
              </div>
              {warning && (
                <div style={{ color: '#ffcccc', fontSize: 10, lineHeight: 1.2, padding: '2px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                  ⚠️ {warning.reason}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button id="add-lesson-editor" className="btn btn-outline btn-sm">+ Add Lesson</button>
          <button id="filter-lessons" className="btn btn-outline btn-sm">🔽 Filter</button>
        </div>
      </div>
    </div>
  );
}
