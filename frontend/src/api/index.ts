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
    const detailStr = Array.isArray(err.detail)
      ? err.detail.map((e: any) => `${e.loc && e.loc.length > 0 ? e.loc[e.loc.length - 1] + ': ' : ''}${e.msg}`).join(', ')
      : err.detail || 'Request failed';
    throw new Error(detailStr);
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
  login: (username: string, password: string) =>
    post<import('../types').AuthTokens>('/auth/login', { username, password }),
  changeCredentials: (username: string, new_password: string) =>
    post<import('../types').AuthTokens>('/auth/change-credentials', { username, new_password }),
  me: () => get<import('../types').User>('/auth/me'),
};

export const usersApi = {
  getHierarchy: () => get<any[]>('/users/hierarchy'),
  createInstitution: (username: string, password: string, full_name: string, email?: string) =>
    post<import('../types').User>('/users/institution', { username, password, full_name, email: email || undefined }),
  createFaculty: (username: string, password: string, full_name: string, institution_id?: string, email?: string) => {
    const url = institution_id ? `/users/faculty?institution_id=${institution_id}` : '/users/faculty';
    return post<import('../types').User>(url, { username, password, full_name, email: email || undefined });
  },
  updateUser: (id: string, data: Partial<{ username: string; password?: string; full_name: string; email?: string }>) =>
    request<import('../types').User>('PUT', `/users/${id}`, data),
  deleteUser: (id: string) => del(`/users/${id}`),
};

// ---- Timetables ----
export const timetableApi = {
  list: (institutionId?: string) => get<import('../types').Timetable[]>(institutionId ? `/timetables?institution_id=${institutionId}` : '/timetables'),
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
  listGlobal: (institutionId?: string) => get<import('../types').Faculty[]>(institutionId ? `/faculty?institution_id=${institutionId}` : '/faculty'),
  createGlobal: (data: Partial<import('../types').Faculty>, institutionId?: string) =>
    post<import('../types').Faculty>(institutionId ? `/faculty?institution_id=${institutionId}` : '/faculty', data),
  updateGlobal: (id: string, data: Partial<import('../types').Faculty>) =>
    put<import('../types').Faculty>(`/faculty/${id}`, data),
  deleteGlobal: (id: string) => del(`/faculty/${id}`),
  bulkImportGlobal: (file: File, institutionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>(
      'POST', 
      institutionId ? `/faculty/bulk-import?institution_id=${institutionId}` : '/faculty/bulk-import', 
      formData, 
      true
    );
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
  listGlobal: (institutionId?: string) => get<import('../types').Classroom[]>(institutionId ? `/classrooms?institution_id=${institutionId}` : '/classrooms'),
  createGlobal: (data: Partial<import('../types').Classroom>, institutionId?: string) =>
    post<import('../types').Classroom>(institutionId ? `/classrooms?institution_id=${institutionId}` : '/classrooms', data),
  updateGlobal: (id: string, data: Partial<import('../types').Classroom>) =>
    put<import('../types').Classroom>(`/classrooms/${id}`, data),
  deleteGlobal: (id: string) => del(`/classrooms/${id}`),
  bulkImportGlobal: (file: File, institutionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>(
      'POST', 
      institutionId ? `/classrooms/bulk-import?institution_id=${institutionId}` : '/classrooms/bulk-import', 
      formData, 
      true
    );
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
  listGlobal: (institutionId?: string) => get<import('../types').Subject[]>(institutionId ? `/subjects?institution_id=${institutionId}` : '/subjects'),
  createGlobal: (data: Partial<import('../types').Subject>, institutionId?: string) =>
    post<import('../types').Subject>(institutionId ? `/subjects?institution_id=${institutionId}` : '/subjects', data),
  updateGlobal: (id: string, data: Partial<import('../types').Subject>) =>
    put<import('../types').Subject>(`/subjects/${id}`, data),
  deleteGlobal: (id: string) => del(`/subjects/${id}`),
  bulkImportGlobal: (file: File, institutionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>(
      'POST', 
      institutionId ? `/subjects/bulk-import?institution_id=${institutionId}` : '/subjects/bulk-import', 
      formData, 
      true
    );
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
  listGlobal: (institutionId?: string) => get<import('../types').Room[]>(institutionId ? `/rooms?institution_id=${institutionId}` : '/rooms'),
  createGlobal: (data: Partial<import('../types').Room>, institutionId?: string) =>
    post<import('../types').Room>(institutionId ? `/rooms?institution_id=${institutionId}` : '/rooms', data),
  updateGlobal: (id: string, data: Partial<import('../types').Room>) =>
    put<import('../types').Room>(`/rooms/${id}`, data),
  deleteGlobal: (id: string) => del(`/rooms/${id}`),
  bulkImportGlobal: (file: File, institutionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ imported: number; skipped: number }>(
      'POST', 
      institutionId ? `/rooms/bulk-import?institution_id=${institutionId}` : '/rooms/bulk-import', 
      formData, 
      true
    );
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
  create: (timetableId: string, data: Partial<import('../types').TimetableEntry>) =>
    post<import('../types').TimetableEntry>(`/timetables/${timetableId}/entries`, data),
  update: (timetableId: string, id: string, data: Partial<import('../types').TimetableEntry>) =>
    put<import('../types').TimetableEntry>(`/timetables/${timetableId}/entries/${id}`, data),
  delete: (timetableId: string, id: string) => del(`/timetables/${timetableId}/entries/${id}`),
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
