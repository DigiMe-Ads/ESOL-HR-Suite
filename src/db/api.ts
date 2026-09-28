import { supabase } from '@/db/supabase';
import type { Employee, SalaryRecord, LeaveRequest, LeaveTypeConfig, Profile, UserRole, LeaveType, Permission } from '@/types/types';
import { round2 } from '@/lib/salaryCalc';

// =================== PROFILES ===================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  return Array.isArray(data) ? data : [];
}

export async function updateProfile(userId: string, updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'phone'>>): Promise<void> {
  await supabase.from('profiles').update(updates).eq('id', userId);
}

export async function clearMustChangePassword(userId: string): Promise<void> {
  await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
}

// =================== USER ACCOUNT ADMIN (DB RPCs — see migration 00015) ===================
export interface CreateUserResult { user_id: string; temp_password: string; email_sent: boolean; }
export interface ResetPasswordResult { temp_password: string; email_sent: boolean; }

async function invokeAdminRpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

export function createUserAccount(params: {
  first_name: string; last_name: string; email: string; phone?: string; role: UserRole; permissions: Permission[];
}): Promise<{ data: CreateUserResult | null; error: string | null }> {
  return invokeAdminRpc<CreateUserResult>('admin_create_user', {
    p_first_name: params.first_name,
    p_last_name: params.last_name,
    p_email: params.email,
    p_phone: params.phone ?? null,
    p_role: params.role,
    p_permissions: params.permissions,
  });
}

export function updateUserPermissions(params: {
  user_id: string; permissions: Permission[]; role?: UserRole;
}): Promise<{ data: { ok: boolean } | null; error: string | null }> {
  return invokeAdminRpc<{ ok: boolean }>('admin_update_permissions', {
    p_user_id: params.user_id,
    p_permissions: params.permissions,
    p_role: params.role ?? null,
  });
}

export function resetUserPassword(userId: string): Promise<{ data: ResetPasswordResult | null; error: string | null }> {
  return invokeAdminRpc<ResetPasswordResult>('admin_reset_password', { p_user_id: userId });
}

export function setUserBan(userId: string, banned: boolean): Promise<{ data: { ok: boolean } | null; error: string | null }> {
  return invokeAdminRpc<{ ok: boolean }>('admin_set_ban', { p_user_id: userId, p_banned: banned });
}

// =================== SELF-SERVICE PASSWORD ===================
/** Reset a password with a one-time reset code — no confirmation email involved. */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('reset_password_with_code', {
    p_email: email, p_code: code, p_new_password: newPassword,
  });
  if (error) return error.message;
  const result = data as { ok: boolean; error?: string } | null;
  return result?.ok ? null : (result?.error ?? 'Invalid or expired reset code');
}

// =================== EMPLOYEES ===================
// Minimal read-only directory (id, employee_id, full_name, designation) —
// accessible to salary/leave viewers who lack full employee permission
export interface EmployeeDirectoryEntry {
  id: string;
  employee_id: string;
  full_name: string;
  designation: string;
  employment_status: string;
}

// Full employee record for salary slip generation — granted to salary_slips
// permission holders even without full employee management access
export async function getEmployeeForSlip(employeeId: string): Promise<Employee | null> {
  const { data, error } = await supabase.rpc('get_employee_for_slip', { emp_id: employeeId });
  if (error) {
    console.error('get_employee_for_slip error:', error.message);
    return null;
  }
  return (data as Employee) ?? null;
}

export async function getEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('get_employee_directory');
  if (error) {
    console.error('get_employee_directory error:', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getEmployees(search?: string): Promise<Employee[]> {
  let query = supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%`);
  }
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function getEmployeeByProfileId(profileId: string): Promise<Employee | null> {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  return data;
}

export async function createEmployee(
  emp: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'resigned_at' | 'employment_status' | 'created_by'> & { created_by: string }
): Promise<void> {
  await supabase.from('employees').insert(emp);
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  await supabase.from('employees').update(updates).eq('id', id);
}

export async function deleteEmployee(id: string): Promise<void> {
  await supabase.from('employees').delete().eq('id', id);
}

// Mark an employee as resigned/reactivated and disable/enable their platform login
export async function setEmploymentStatus(
  employee: Pick<Employee, 'id' | 'profile_id'>,
  status: 'active' | 'resigned'
): Promise<{ error: string | null }> {
  await updateEmployee(employee.id, status === 'resigned'
    ? { employment_status: 'resigned', resigned_at: new Date().toISOString() }
    : { employment_status: 'active', resigned_at: null });
  if (employee.profile_id) {
    const res = await setUserBan(employee.profile_id, status === 'resigned');
    if (res.error) return { error: res.error };
  }
  return { error: null };
}

// =================== SALARY RECORDS ===================
export async function getSalaryRecords(employeeId?: string): Promise<SalaryRecord[]> {
  let query = supabase
    .from('salary_records')
    .select('*')
    .order('payroll_year', { ascending: false })
    .order('payroll_month_number', { ascending: false })
    .limit(500);
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function getSalaryRecord(id: string): Promise<SalaryRecord | null> {
  const { data } = await supabase
    .from('salary_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export interface SalaryRecordPayload {
  employee_id: string;
  payroll_month: string;
  payroll_period: string;
  payroll_year: number;
  payroll_month_number: number;
  basic_salary: number;
  transportation_allowance: number;
  education_allowance: number;
  attendance_allowance: number;
  // NOTE: total_pay and total_days_entitled are DB-generated columns — never sent by the client
  working_days_constant: number;
  actual_working_days: number;
  leave_entitlement_days: number;
  gross_earning: number;
  basic_salary_earned: number;
  total_allowance_earned: number;
  total_gross_earning: number;
  epf_employer: number;
  etf_payment: number;
  epf_employee: number;
  stamp_duty: number;
  total_deductions: number;
  net_pay: number;
  created_by: string;
}

export async function createSalaryRecord(payload: SalaryRecordPayload): Promise<{ error: string | null }> {
  const { error } = await supabase.from('salary_records').insert({
    ...payload,
    gross_earning: round2(payload.gross_earning),
    basic_salary_earned: round2(payload.basic_salary_earned),
    total_allowance_earned: round2(payload.total_allowance_earned),
    total_gross_earning: round2(payload.total_gross_earning),
    epf_employer: round2(payload.epf_employer),
    etf_payment: round2(payload.etf_payment),
    epf_employee: round2(payload.epf_employee),
    total_deductions: round2(payload.total_deductions),
    net_pay: round2(payload.net_pay),
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateSalaryRecord(id: string, payload: Partial<SalaryRecordPayload>): Promise<{ error: string | null }> {
  const rounded: Record<string, number | string> = {};
  const numFields = ['gross_earning','basic_salary_earned','total_allowance_earned','total_gross_earning','epf_employer','etf_payment','epf_employee','total_deductions','net_pay'] as const;
  for (const [k, v] of Object.entries(payload)) {
    rounded[k] = numFields.includes(k as typeof numFields[number]) && typeof v === 'number' ? round2(v) : v as number | string;
  }
  const { error } = await supabase.from('salary_records').update(rounded).eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteSalaryRecord(id: string): Promise<void> {
  await supabase.from('salary_records').delete().eq('id', id);
}

// =================== LEAVE TYPE CONFIG ===================
export async function getLeaveTypeConfigs(): Promise<LeaveTypeConfig[]> {
  const { data } = await supabase
    .from('leave_type_config')
    .select('*')
    .order('leave_type');
  return Array.isArray(data) ? data : [];
}

export async function updateLeaveTypeConfig(id: string, updates: Partial<LeaveTypeConfig>): Promise<void> {
  await supabase.from('leave_type_config').update(updates).eq('id', id);
}

// =================== LEAVE REQUESTS ===================
export async function getLeaveRequests(employeeId?: string, status?: string): Promise<LeaveRequest[]> {
  let query = supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (employeeId) query = query.eq('employee_id', employeeId);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function createLeaveRequest(req: {
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leave_requests').insert(req);
  if (error) return { error: error.message };
  return { error: null };
}

export async function reviewLeaveRequest(
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  reviewComment?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leave_requests').update({
    status,
    reviewed_by: reviewedBy,
    review_comment: reviewComment || null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// =================== USER MANAGEMENT ===================
// Role/permission changes go through the user-admin Edge Function (updateUserPermissions).

// =================== DASHBOARD STATS ===================
export async function getDashboardStats(): Promise<{
  totalEmployees: number;
  activeEmployees: number;
  resignedEmployees: number;
  pendingLeaves: number;
  totalSalaryRecords: number;
}> {
  const [empRes, resignedRes, leaveRes, salaryRes] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'resigned'),
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('salary_records').select('id', { count: 'exact', head: true }),
  ]);
  const total = empRes.count ?? 0;
  const resigned = resignedRes.count ?? 0;
  return {
    totalEmployees: total,
    activeEmployees: total - resigned,
    resignedEmployees: resigned,
    pendingLeaves: leaveRes.count ?? 0,
    totalSalaryRecords: salaryRes.count ?? 0,
  };
}
