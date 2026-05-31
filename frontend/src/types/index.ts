// ============================================================
// ClassSync — Shared TypeScript Types
// ============================================================

export type PlanType = 'free' | 'pro' | 'max';
export type TimetableStatus = 'draft' | 'published' | 'archived';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScheduleType = 'weekly' | 'fortnightly' | 'custom_cycle' | 'day_rotation';
export type PeriodConfigStyle = 'uniform' | 'custom_day';
export type ConstraintType = 'subject_sequence' | 'same_day_exclusion' | 'faculty_constraint' | 'room_constraint' | 'first_period_class_teacher' | 'specific_days_subject' | 'max_one_per_day';
export type ConstraintScope = 'institute' | 'class';

export interface User {
  id: string;
  username: string;
  email?: string;
  full_name: string;
  role: string;
  must_change_password: boolean;
  plan: PlanType;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Timetable {
  id: string;
  name: string;
  description?: string | null;
  status: TimetableStatus;
  session_name?: string | null;
  session_start?: string | null;
  session_end?: string | null;
  generation_warnings?: Array<{ lesson_id: string; reason: string }> | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Faculty {
  id: string;
  user_id?: string;
  full_name: string;
  short_name: string;
  email?: string;
  phone?: string;
  designation?: string;
  role: string;
  availability: number;
  created_at: string;
}

export interface Classroom {
  id: string;
  name: string;
  short_name: string;
  class_teacher_id?: string;
  student_count?: number;
  display_color: string;
  availability: number;
}

export interface Room {
  id: string;
  name: string;
  short_name: string;
  building_name?: string;
  room_group?: string;
  capacity?: number;
  display_color: string;
}

export interface Subject {
  id: string;
  name: string;
  short_name: string;
  description?: string;
  display_color: string;
  availability: number;
}

export interface Lesson {
  id: string;
  timetable_id: string;
  classroom_id?: string;
  subject_ids: string[];
  faculty_ids: string[];
  periods_per_week: number;
  sequence: number;
  double_periods: boolean;
  is_faculty_only: boolean;
  split_into_groups: boolean;
  shared_group_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Period {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  order: number;
  day_of_week?: string;
}

export interface BellSchedule {
  id: string;
  timetable_id: string;
  schedule_type: ScheduleType;
  period_config_style: PeriodConfigStyle;
  working_days: string[];
  periods: Period[];
}

export interface TimetableEntry {
  id: string;
  timetable_id: string;
  lesson_id: string;
  classroom_id?: string;
  faculty_id?: string;
  subject_id?: string;
  room_id?: string;
  day_of_week: string;
  period_number: number;
  week_number: number;
}

export interface GenerationJob {
  id: string;
  timetable_id: string;
  status: JobStatus;
  progress: number;
  score?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
}

export interface DashboardStats {
  total_timetables: number;
  published: number;
  drafts: number;
  plan: PlanType;
}

export interface Constraint {
  id: string;
  constraint_type: ConstraintType;
  scope: ConstraintScope;
  subject_a_id?: string;
  subject_b_id?: string;
  classroom_id?: string;
  description?: string;
  days_of_week?: string[] | null;
}
