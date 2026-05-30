// ============================================================
// ClassSync — API client
// Thin wrapper around fetch with auth token injection.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const headers: HeadersInit = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(Array.isArray(err.detail) ? err.detail.join(', ') : err.detail || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const del = (path: string) => request<void>('DELETE', path);

// ---- Auth ----
export const authApi = {
  register: (email: string, password: string, full_name: string) =>
    post<import('../types').AuthTokens>('/auth/register', { email, password, full_name }),
  login: (email: string, password: string) =>
    post<import('../types').AuthTokens>('/auth/login', { email, password }),
  me: () => get<import('../types').User>('/auth/me'),
};

// ---- Timetables ----
export const timetableApi = {
  list: () => get<import('../types').Timetable[]>('/timetables'),
  create: (data: Partial<import('../types').Timetable>) => post<import('../types').Timetable>('/timetables', data),
  get: (id: string) => get<import('../types').Timetable>(`/timetables/${id}`),
  update: (id: string, data: Partial<import('../types').Timetable>) =>
    patch<import('../types').Timetable>(`/timetables/${id}`, data),
  delete: (id: string) => del(`/timetables/${id}`),
  validate: (id: string) => get<import('../types').ValidationResult>(`/timetables/${id}/validate`),
  publish: (id: string) => post<import('../types').Timetable>(`/timetables/${id}/publish`),
};

// ---- Bell Schedule ----
export const bellScheduleApi = {
  get: (timetableId: string) => get<import('../types').BellSchedule>(`/timetables/${timetableId}/bell-schedule`),
  save: (timetableId: string, data: Partial<import('../types').BellSchedule>) =>
    request<import('../types').BellSchedule>('PUT', `/timetables/${timetableId}/bell-schedule`, data),
  delete: (timetableId: string) => del(`/timetables/${timetableId}/bell-schedule`),
};

// ---- Faculty ----
// Global catalog operations
export const facultyApi = {
  // --- Global catalog ---
  listGlobal: () => get<import('../types').Faculty[]>('/faculty'),
  createGlobal: (data: Partial<import('../types').Faculty>) =>
    post<import('../types').Faculty>('/faculty', data),
  updateGlobal: (id: string, data: Partial<import('../types').Faculty>) =>
    put<import('../types').Faculty>(`/faculty/${id}`, data),
  deleteGlobal: (id: string) => del(`/faculty/${id}`),
  bulkImportGlobal: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/faculty/bulk-import', formData, true);
  },

  // --- Timetable-scoped (attached list) ---
  list: (timetableId: string) => get<import('../types').Faculty[]>(`/timetables/${timetableId}/faculty`),
  attach: (timetableId: string, facultyId: string) =>
    post<import('../types').Faculty>(`/timetables/${timetableId}/faculty/${facultyId}`),
  detach: (timetableId: string, facultyId: string) =>
    del(`/timetables/${timetableId}/faculty/${facultyId}`),

  // Deprecated aliases kept for backward compat during transition
  create: (_timetableId: string, data: Partial<import('../types').Faculty>) =>
    post<import('../types').Faculty>('/faculty', data),
  update: (_timetableId: string, id: string, data: Partial<import('../types').Faculty>) =>
    put<import('../types').Faculty>(`/faculty/${id}`, data),
  delete: (_timetableId: string, id: string) => del(`/faculty/${id}`),
  bulkImport: (_timetableId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/faculty/bulk-import', formData, true);
  },
};

// ---- Classrooms (Grades & Divisions) ----
export const classroomApi = {
  // --- Global catalog ---
  listGlobal: () => get<import('../types').Classroom[]>('/classrooms'),
  createGlobal: (data: Partial<import('../types').Classroom>) =>
    post<import('../types').Classroom>('/classrooms', data),
  updateGlobal: (id: string, data: Partial<import('../types').Classroom>) =>
    put<import('../types').Classroom>(`/classrooms/${id}`, data),
  deleteGlobal: (id: string) => del(`/classrooms/${id}`),
  bulkImportGlobal: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/classrooms/bulk-import', formData, true);
  },

  // --- Timetable-scoped ---
  list: (timetableId: string) => get<import('../types').Classroom[]>(`/timetables/${timetableId}/classrooms`),
  attach: (timetableId: string, classroomId: string) =>
    post<import('../types').Classroom>(`/timetables/${timetableId}/classrooms/${classroomId}`),
  detach: (timetableId: string, classroomId: string) =>
    del(`/timetables/${timetableId}/classrooms/${classroomId}`),

  // Deprecated aliases
  create: (_timetableId: string, data: Partial<import('../types').Classroom>) =>
    post<import('../types').Classroom>('/classrooms', data),
  update: (_timetableId: string, id: string, data: Partial<import('../types').Classroom>) =>
    put<import('../types').Classroom>(`/classrooms/${id}`, data),
  delete: (_timetableId: string, id: string) => del(`/classrooms/${id}`),
  bulkImport: (_timetableId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/classrooms/bulk-import', formData, true);
  },
};

// ---- Subjects (& Activities) ----
export const subjectApi = {
  // --- Global catalog ---
  listGlobal: () => get<import('../types').Subject[]>('/subjects'),
  createGlobal: (data: Partial<import('../types').Subject>) =>
    post<import('../types').Subject>('/subjects', data),
  updateGlobal: (id: string, data: Partial<import('../types').Subject>) =>
    put<import('../types').Subject>(`/subjects/${id}`, data),
  deleteGlobal: (id: string) => del(`/subjects/${id}`),
  bulkImportGlobal: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/subjects/bulk-import', formData, true);
  },

  // --- Timetable-scoped ---
  list: (timetableId: string) => get<import('../types').Subject[]>(`/timetables/${timetableId}/subjects`),
  attach: (timetableId: string, subjectId: string) =>
    post<import('../types').Subject>(`/timetables/${timetableId}/subjects/${subjectId}`),
  detach: (timetableId: string, subjectId: string) =>
    del(`/timetables/${timetableId}/subjects/${subjectId}`),

  // Deprecated aliases
  create: (_timetableId: string, data: Partial<import('../types').Subject>) =>
    post<import('../types').Subject>('/subjects', data),
  update: (_timetableId: string, id: string, data: Partial<import('../types').Subject>) =>
    put<import('../types').Subject>(`/subjects/${id}`, data),
  delete: (_timetableId: string, id: string) => del(`/subjects/${id}`),
  bulkImport: (_timetableId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/subjects/bulk-import', formData, true);
  },
};

// ---- Rooms ----
export const roomApi = {
  // --- Global catalog ---
  listGlobal: () => get<import('../types').Room[]>('/rooms'),
  createGlobal: (data: Partial<import('../types').Room>) =>
    post<import('../types').Room>('/rooms', data),
  updateGlobal: (id: string, data: Partial<import('../types').Room>) =>
    put<import('../types').Room>(`/rooms/${id}`, data),
  deleteGlobal: (id: string) => del(`/rooms/${id}`),
  bulkImportGlobal: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/rooms/bulk-import', formData, true);
  },

  // --- Timetable-scoped ---
  list: (timetableId: string) => get<import('../types').Room[]>(`/timetables/${timetableId}/rooms`),
  attach: (timetableId: string, roomId: string) =>
    post<import('../types').Room>(`/timetables/${timetableId}/rooms/${roomId}`),
  detach: (timetableId: string, roomId: string) =>
    del(`/timetables/${timetableId}/rooms/${roomId}`),

  // Deprecated aliases
  create: (_timetableId: string, data: Partial<import('../types').Room>) =>
    post<import('../types').Room>('/rooms', data),
  update: (_timetableId: string, id: string, data: Partial<import('../types').Room>) =>
    put<import('../types').Room>(`/rooms/${id}`, data),
  delete: (_timetableId: string, id: string) => del(`/rooms/${id}`),
  bulkImport: (_timetableId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>('POST', '/rooms/bulk-import', formData, true);
  },
};

// ---- Lessons ----
export const lessonApi = {
  list: (timetableId: string) => get<import('../types').Lesson[]>(`/timetables/${timetableId}/lessons`),
  create: (timetableId: string, data: unknown) =>
    post<import('../types').Lesson>(`/timetables/${timetableId}/lessons`, data),
  update: (timetableId: string, id: string, data: unknown) =>
    patch<import('../types').Lesson>(`/timetables/${timetableId}/lessons/${id}`, data),
  delete: (timetableId: string, id: string) => del(`/timetables/${timetableId}/lessons/${id}`),
};

// ---- Generation ----
export const generationApi = {
  start: (timetableId: string) =>
    post<import('../types').GenerationJob>(`/timetables/${timetableId}/generate`),
  getStatus: (timetableId: string, jobId: string) =>
    get<import('../types').GenerationJob>(`/timetables/${timetableId}/generate/${jobId}`),
};

// ---- Timetable Entries ----
export const timetableEntryApi = {
  list: (timetableId: string) =>
    get<import('../types').TimetableEntry[]>(`/timetables/${timetableId}/entries`),
};

// ---- Constraints ----
export const constraintApi = {
  list: (timetableId: string) => get<import('../types').Constraint[]>(`/timetables/${timetableId}/constraints`),
  create: (timetableId: string, data: Partial<import('../types').Constraint>) =>
    post<import('../types').Constraint>(`/timetables/${timetableId}/constraints`, data),
  update: (timetableId: string, id: string, data: Partial<import('../types').Constraint>) =>
    request<import('../types').Constraint>('PUT', `/timetables/${timetableId}/constraints/${id}`, data),
  delete: (timetableId: string, id: string) => del(`/timetables/${timetableId}/constraints/${id}`),
};

// ---- Analytics ----
export const analyticsApi = {
  dashboard: () => get<import('../types').DashboardStats>('/analytics/dashboard'),
};
