import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { lessonApi, classroomApi, subjectApi, facultyApi, roomApi } from '../api';
import type { Classroom, Subject, Faculty, Room, Lesson } from '../types';

interface BulkImportLessonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  timetableId: string;
  classrooms: Classroom[];
  subjects: Subject[];
  facultyList: Faculty[];
  rooms: Room[];
  onImported: (importedLessons: Lesson[]) => void;
}

type CsvTable = {
  headers: string[];
  rows: Record<string, string>[];
};

function safeTrim(s: string) {
  return (s ?? '').toString().trim();
}

function normalizeHeader(h: string) {
  return safeTrim(h).toLowerCase();
}

function parseCsv(text: string): string[][] {
  // Small CSV parser that supports quotes and commas. Good enough for simple timetable CSV exports.
  const rows: string[][] = [];
  let i = 0;
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // Avoid adding trailing empty line
    if (row.some((c) => safeTrim(c) !== '') || rows.length === 0) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // flush tail
  pushField();
  if (row.length > 0) pushRow();
  return rows;
}

function parseListCell(cell: string): string[] {
  const v = safeTrim(cell);
  if (!v) return [];
  return v
    .split(/[;,&]/g)
    .map((x) => safeTrim(x))
    .filter(Boolean);
}

function generateShortName(name: string, maxLen: number) {
  const cleaned = safeTrim(name).replace(/\s+/g, ' ');
  const parts = cleaned.split(' ').filter(Boolean);
  const acronym = parts
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (acronym.length >= 2) return acronym.slice(0, maxLen);
  const fallback = cleaned.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return fallback.slice(0, maxLen) || 'ITEM';
}

function parseDoubleLength(lengthCell: string): boolean {
  const v = safeTrim(lengthCell).toLowerCase();
  if (!v) return false;
  if (v.includes('double')) return true;
  // Allow "2", "2P", "2 period", "2 periods"
  if (/^\s*2\s*(p(eriods?)?)?\s*$/.test(v)) return true;
  return false;
}

export default function BulkImportLessonsModal({
  isOpen,
  onClose,
  timetableId,
  classrooms,
  subjects,
  facultyList,
  rooms,
  onImported,
}: BulkImportLessonsModalProps) {
  const [fileName, setFileName] = useState<string>('');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importCount, setImportCount] = useState(0);

  const normalized = useMemo(() => {
    if (!table) return null;
    const byNormHeader = new Map<string, string>();
    table.headers.forEach((h) => byNormHeader.set(normalizeHeader(h), h));
    return byNormHeader;
  }, [table]);

  const requiredHeaders = useMemo(
    () => [
      'teacher names',
      'class names',
      'subject names',
      'room names',
      'no. of lessons',
      'length',
    ],
    []
  );

  const previewColumns = table?.headers ?? [];
  const previewRows = table?.rows ?? [];

  if (!isOpen) return null;

  const handleFileSelected = async (file: File) => {
    setFileName(file.name);
    setErrors([]);
    setImportCount(0);
    setTable(null);

    const text = await file.text();
    const rawRows = parseCsv(text);
    if (rawRows.length < 2) {
      setErrors([{ row: 0, message: 'CSV must include a header row and at least one data row.' }]);
      return;
    }

    const headers = rawRows[0].map((h) => safeTrim(h).replace(/^\uFEFF/, '')); // BOM safe
    const headerSet = new Set(headers.map(normalizeHeader));
    const dataRows = rawRows.slice(1).filter((r) => r.some((c) => safeTrim(c) !== ''));

    const rowObjects = dataRows.map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = safeTrim(cells[idx] ?? '');
      });
      return obj;
    });

    // Quick header validation
    const missing = requiredHeaders.filter((rh) => !headerSet.has(normalizeHeader(rh)));
    if (missing.length) {
      setErrors([{ row: 0, message: `CSV missing required columns: ${missing.join(', ')}` }]);
      return;
    }

    setTable({ headers, rows: rowObjects });
  };

  const handleUpload = async () => {
    if (!table || !normalized) return;
    setUploading(true);
    setErrors([]);
    setImportCount(0);

    try {
      const localErrors: Array<{ row: number; message: string }> = [];
      const caches = {
        facultyByName: new Map<string, Faculty>(),
        classroomsByName: new Map<string, Classroom>(),
        subjectsByName: new Map<string, Subject>(),
        roomsByName: new Map<string, Room>(),
      };
      const upsertInto = <T extends { id: string; name?: string; short_name?: string; full_name?: string }>(
        map: Map<string, T>,
        item: T,
        getNames: Array<(x: T) => string | undefined>
      ) => {
        getNames.forEach((fn) => {
          const n = safeTrim(fn(item) ?? '');
          if (!n) return;
          map.set(n.toLowerCase(), item);
        });
      };

      try {
        const [gClassrooms, gSubjects, gFaculty, gRooms] = await Promise.all([
          classroomApi.listGlobal(),
          subjectApi.listGlobal(),
          facultyApi.listGlobal(),
          roomApi.listGlobal()
        ]);
        
        gFaculty.forEach((f) => {
          upsertInto(caches.facultyByName, f, [(x) => (x as any).full_name, (x) => x.short_name]);
        });
        gClassrooms.forEach((c) => {
          upsertInto(caches.classroomsByName, c, [(x) => x.name, (x) => x.short_name]);
        });
        gSubjects.forEach((s) => {
          upsertInto(caches.subjectsByName, s, [(x) => x.name, (x) => x.short_name]);
        });
        gRooms.forEach((r) => {
          upsertInto(caches.roomsByName, r, [(x) => x.name, (x) => x.short_name]);
        });
      } catch (err) {
        console.warn("Failed to fetch global lists for bulk import caching", err);
      }

      facultyList.forEach((f) => {
        upsertInto(caches.facultyByName, f, [(x) => (x as any).full_name, (x) => x.short_name]);
      });
      classrooms.forEach((c) => {
        upsertInto(caches.classroomsByName, c, [(x) => x.name, (x) => x.short_name]);
      });
      subjects.forEach((s) => {
        upsertInto(caches.subjectsByName, s, [(x) => x.name, (x) => x.short_name]);
      });
      rooms.forEach((r) => {
        upsertInto(caches.roomsByName, r, [(x) => x.name, (x) => x.short_name]);
      });

      const findOrCreateFaculty = async (fullName: string): Promise<Faculty> => {
        const key = fullName.toLowerCase();
        const existing = caches.facultyByName.get(key);
        if (existing) return existing;
        const short_name = generateShortName(fullName, 20);
        const created = await facultyApi.create(timetableId, { full_name: fullName, short_name } as any);
        caches.facultyByName.set(fullName.toLowerCase(), created);
        caches.facultyByName.set(created.short_name.toLowerCase(), created);
        return created;
      };

      const findOrCreateClassroom = async (name: string): Promise<Classroom> => {
        const key = name.toLowerCase();
        const existing = caches.classroomsByName.get(key);
        if (existing) return existing;
        const short_name = generateShortName(name, 20);
        const created = await classroomApi.create(timetableId, { name, short_name } as any);
        caches.classroomsByName.set(name.toLowerCase(), created);
        caches.classroomsByName.set(created.short_name.toLowerCase(), created);
        return created;
      };

      const findOrCreateSubject = async (name: string): Promise<Subject> => {
        const key = name.toLowerCase();
        const existing = caches.subjectsByName.get(key);
        if (existing) return existing;
        const short_name = generateShortName(name, 20);
        const created = await subjectApi.create(timetableId, { name, short_name } as any);
        caches.subjectsByName.set(name.toLowerCase(), created);
        caches.subjectsByName.set(created.short_name.toLowerCase(), created);
        return created;
      };

      const findOrCreateRoom = async (name: string): Promise<Room> => {
        const key = name.toLowerCase();
        const existing = caches.roomsByName.get(key);
        if (existing) return existing;
        const short_name = generateShortName(name, 20);
        const created = await roomApi.create(timetableId, { name, short_name } as any);
        caches.roomsByName.set(name.toLowerCase(), created);
        caches.roomsByName.set(created.short_name.toLowerCase(), created);
        return created;
      };

      const createdLessons: Lesson[] = [];
      const rowsToImport = table.rows.filter((r) => Object.values(r).some((v) => safeTrim(v) !== ''));
      const getCell = (row: Record<string, string>, headerLabel: string) => row[headerLabel] ?? '';

      const hTeacher = normalized.get('teacher names')!;
      const hClass = normalized.get('class names')!;
      const hSubject = normalized.get('subject names')!;
      const hRoom = normalized.get('room names')!;
      const hLessons = normalized.get('no. of lessons')!;
      const hLength = normalized.get('length')!;

      for (let idx = 0; idx < rowsToImport.length; idx++) {
        const row = rowsToImport[idx];
        const csvRowNum = idx + 2; // 1 header row

        try {
          const teacherNames = parseListCell(getCell(row, hTeacher));
          const classNames = parseListCell(getCell(row, hClass));
          const subjectNames = parseListCell(getCell(row, hSubject));
          const roomName = safeTrim(getCell(row, hRoom));
          const noLessons = parseInt(safeTrim(getCell(row, hLessons)), 10);
          const isDouble = parseDoubleLength(getCell(row, hLength));

          if (teacherNames.length === 0) throw new Error('Teacher Names is required');
          if (classNames.length === 0) throw new Error('Class Names is required');
          if (subjectNames.length === 0) throw new Error('Subject Names is required');
          if (!Number.isFinite(noLessons) || noLessons <= 0) throw new Error('No. of Lessons must be a positive integer');

          const facultyIds: string[] = [];
          for (const tName of teacherNames) {
            const fac = await findOrCreateFaculty(tName);
            facultyIds.push(fac.id);
          }

          const subjectIds: string[] = [];
          for (const sName of subjectNames) {
            const sub = await findOrCreateSubject(sName);
            subjectIds.push(sub.id);
          }

          const roomId = roomName ? (await findOrCreateRoom(roomName)).id : undefined;

          for (const className of classNames) {
            const classroom = await findOrCreateClassroom(className);
            const created = await lessonApi.create(timetableId, {
              classroom_id: classroom.id,
              subject_ids: subjectIds,
              faculty_ids: facultyIds,
              room_id: roomId,
              periods_per_week: noLessons,
              sequence: 1,
              double_periods: isDouble,
              is_faculty_only: false,
              split_into_groups: false,
            } as any);

            createdLessons.push(created as any);
            setImportCount((c) => c + 1);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Import failed';
          localErrors.push({ row: csvRowNum, message });
        }
      }

      setErrors(localErrors);

      // Only close the modal after completion + no errors
      if (createdLessons.length > 0 && localErrors.length === 0) {
        onImported(createdLessons);
        onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  // NOTE: We intentionally keep the modal open if any row errors occurred.
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container" style={{ maxWidth: 920 }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              Bulk Import Lessons (CSV)
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => {
                  const headers = ['Teacher Names', 'Class Names', 'Subject Names', 'Room Names', 'No. of Lessons', 'Length'];
                  const row = ['John Doe', '10A; 10B', 'Mathematics', 'Room 101', '4', 'Single'];
                  const csvContent = [headers.join(','), row.join(',')].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'lessons_template.csv');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                ⬇ Download Template
              </button>
            </div>
            <div className="text-sm text-muted" style={{ marginTop: 6 }}>
              Expected columns: Teacher Names, Class Names, Subject Names, Room Names, No. of Lessons, Length
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={uploading}>
            ×
          </button>
        </div>

        <div className="modal-body" style={{ padding: '0 32px 20px' }}>
          {errors.length > 0 && (
            <div className="info-note info-note-amber" style={{ marginBottom: 16 }}>
              <div className="font-bold" style={{ marginBottom: 6 }}>Import errors</div>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {errors.slice(0, 30).map((e, i) => (
                  <div key={`${e.row}-${i}`} className="text-sm text-muted" style={{ marginBottom: 6 }}>
                    Row {e.row}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="form-label">Select CSV file</div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileSelected(f);
                }}
                disabled={uploading}
              />
              {fileName && <div className="text-sm text-muted" style={{ marginTop: 6 }}>File: {fileName}</div>}
            </div>
          </div>

          {table && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="font-bold">Preview</div>
                <div className="text-sm text-muted">{previewRows.length} row(s)</div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {previewColumns.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        {previewColumns.map((h) => (
                          <td key={h}>{r[h] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 100 && (
                <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                  Showing first 100 rows only.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '12px 32px 24px' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={uploading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => void handleUpload()}
            disabled={uploading || !table || previewRows.length === 0}
          >
            {uploading ? `Importing… (${importCount})` : 'Upload'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

