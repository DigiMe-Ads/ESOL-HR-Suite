import { supabase } from '@/db/supabase';
import type {
  Employee, SalaryRecord, LeaveRequest, LeaveTypeConfig, Profile, UserRole, LeaveType, Permission, EmployeeDocument, EmployeeDocumentType,
  SalarySlipRequest, SlipRequestStatus, AppNotification, EmployeeLeaveGrant, GrantedLeaveType, AuditLogEntry,
} from '@/types/types';
import { round2 } from '@/lib/salaryCalc';

type DbError = { code?: string; message: string } | null;

// True when an RPC from a newer migration has not been applied to the database yet
function isMissingFunction(error: DbError): boolean {
  return !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message));
}

// Translate constraint violations into messages people can act on
export function friendlyDbError(error: DbError): string | null {
  if (!error) return null;
  const msg = error.message ?? '';
  if (error.code === '23505') {
    if (msg.includes('employee_id_key')) return 'An employee with this Employee ID already exists.';
    if (msg.includes('profile_id')) return 'This user account is already linked to another employee.';
    if (msg.includes('payroll')) return 'A salary record for this employee and month already exists. Edit the existing record instead.';
    return 'This record already exists.';
  }
  if (error.code === '23514') return 'Some values are out of the allowed range. Please check the dates, days and amounts.';
  if (error.code === '42501' || /row-level security/i.test(msg)) return 'You do not have permission to make this change.';
  return msg || 'Something went wrong. Please try again.';
}

// =================== PROFILES ===================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

/** Like getProfile, but distinguishes "no profile" from a failed request (so callers can retry) */
export async function fetchProfileResult(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return { profile: data, failed: !!error };
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  return Array.isArray(data) ? data : [];
}

export async function updateProfile(userId: string, updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'phone'>>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  return { error: friendlyDbError(error) };
}

/**
 * Sets the new password and clears the temporary-password flag server-side.
 * `missing` is true while the database has not been migrated yet (caller falls back).
 */
export async function completeForcedPasswordChange(newPassword: string): Promise<{ error: string | null; missing: boolean }> {
  const { error } = await supabase.rpc('complete_forced_password_change', { p_new_password: newPassword });
  if (isMissingFunction(error)) return { error: null, missing: true };
  return { error: error ? error.message : null, missing: false };
}

// Legacy path (before migration 00016): the profile flag is cleared from the client
export async function clearMustChangePassword(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
  return { error: friendlyDbError(error) };
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
  const term = search?.trim();
  if (term) {
    // Double-quote the value so commas/parentheses in the search text don't break the filter
    const pattern = `"%${term.replace(/[\\"]/g, c => `\\${c}`)}%"`;
    query = query.or(`full_name.ilike.${pattern},employee_id.ilike.${pattern}`);
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
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('employees').insert(emp).select('id').single();
  return { id: data?.id ?? null, error: friendlyDbError(error) };
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employees').update(updates).eq('id', id);
  return { error: friendlyDbError(error) };
}

export async function deleteEmployee(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  return { error: friendlyDbError(error) };
}

export interface LinkableProfile { id: string; full_name: string | null; email: string | null; role: string }

// Accounts an Admin/HR user may link to an employee record (HR cannot read profiles directly)
export async function getLinkableProfiles(): Promise<LinkableProfile[]> {
  const { data, error } = await supabase.rpc('get_linkable_profiles');
  if (!error && Array.isArray(data)) return data as LinkableProfile[];
  // Before migration 00016 only admins can list profiles
  const profiles = await getAllProfiles();
  return profiles.filter(p => p.role !== 'admin').map(p => ({ id: p.id, full_name: p.full_name, email: p.email, role: p.role }));
}

// =================== EMPLOYEE FILES (private bucket: <employee_id>/photo|docs/...) ===================
export const EMPLOYEE_FILES_BUCKET = 'employee-files';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MIME_TYPES = [
  ...PHOTO_MIME_TYPES, 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const safeFileName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file';

export function validateUpload(file: File, allowed: string[]): string | null {
  if (!allowed.includes(file.type)) return 'This file type is not allowed.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Files must be 10 MB or smaller.';
  return null;
}

async function uploadEmployeeFile(path: string, file: File): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(EMPLOYEE_FILES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return { error: error ? error.message : null };
}

/** Uploads a profile photo and returns its storage path (the caller saves it on the employee) */
export async function uploadEmployeePhoto(employeeId: string, file: File): Promise<{ path: string | null; error: string | null }> {
  const invalid = validateUpload(file, PHOTO_MIME_TYPES);
  if (invalid) return { path: null, error: invalid };
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${employeeId}/photo/${crypto.randomUUID()}.${ext}`;
  const { error } = await uploadEmployeeFile(path, file);
  return error ? { path: null, error } : { path, error: null };
}

/** Short-lived signed URLs for private files, keyed by path */
export async function getEmployeeFileUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase.storage.from(EMPLOYEE_FILES_BUCKET).createSignedUrls(unique, expiresIn);
  return Object.fromEntries((data ?? []).filter(d => d.signedUrl && d.path).map(d => [d.path as string, d.signedUrl]));
}

export async function removeEmployeeFiles(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(EMPLOYEE_FILES_BUCKET).remove(paths);
}

export async function listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
  const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
  return Array.isArray(data) ? data : [];
}

export async function uploadEmployeeDocument(
  employeeId: string, file: File, docType: EmployeeDocumentType, title: string,
): Promise<{ error: string | null }> {
  const invalid = validateUpload(file, DOCUMENT_MIME_TYPES);
  if (invalid) return { error: invalid };
  const path = `${employeeId}/docs/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const up = await uploadEmployeeFile(path, file);
  if (up.error) return up;
  const { error } = await supabase.from('employee_documents').insert({
    employee_id: employeeId, doc_type: docType, title: title.trim() || file.name,
    file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
  });
  if (error) {
    await removeEmployeeFiles([path]); // don't leave an orphaned file behind
    return { error: friendlyDbError(error) };
  }
  return { error: null };
}

export async function deleteEmployeeDocument(doc: EmployeeDocument): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
  if (error) return { error: friendlyDbError(error) };
  await removeEmployeeFiles([doc.file_path]);
  return { error: null };
}

/** Employee self-service: phone/photo any time; NIC and bank details only while missing (enforced server-side) */
export async function updateMyEmployeeProfile(fields: {
  phone?: string; nic_number?: string; bank?: string; bank_branch?: string; bank_account_number?: string; photo_path?: string;
}): Promise<{ data: Employee | null; error: string | null }> {
  const { data, error } = await supabase.rpc('update_my_employee_profile', {
    p_phone: fields.phone ?? null,
    p_nic_number: fields.nic_number ?? null,
    p_bank: fields.bank ?? null,
    p_bank_branch: fields.bank_branch ?? null,
    p_bank_account_number: fields.bank_account_number ?? null,
    p_photo_path: fields.photo_path ?? null,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as Employee, error: null };
}

/** Details an employee should complete themselves */
export function missingProfileFields(emp: Employee): string[] {
  const missing: string[] = [];
  if (!emp.photo_path) missing.push('Profile photo');
  if (!emp.nic_number) missing.push('NIC number');
  if (!emp.phone) missing.push('Phone number');
  if (!emp.bank || !emp.bank_branch || !emp.bank_account_number) missing.push('Bank details');
  return missing;
}

/** Admin only: removes the employee (salary, leave and documents cascade) and optionally their login */
export async function adminDeleteEmployee(
  employeeId: string, deleteLogin: boolean,
): Promise<{ login: 'deleted' | 'disabled' | 'kept' | 'none' | null; error: string | null }> {
  // Collect file paths first — after the delete the rows are gone
  const docs = await listEmployeeDocuments(employeeId);
  const emp = await getEmployee(employeeId);
  const { data, error } = await supabase.rpc('admin_delete_employee', { p_employee_id: employeeId, p_delete_login: deleteLogin });
  if (error) return { login: null, error: error.message };
  await removeEmployeeFiles([...docs.map(d => d.file_path), ...(emp?.photo_path ? [emp.photo_path] : [])]);
  return { login: (data as { login: 'deleted' | 'disabled' | 'kept' | 'none' }).login, error: null };
}

/**
 * Emails the user a secure link to set their password (Supabase Auth "Reset password" email).
 * Delivery needs SMTP configured in Supabase → Authentication → Emails.
 */
export async function sendLoginEmail(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/change-password`,
  });
  return { error: error ? error.message : null };
}

// Mark an employee as resigned/reactivated and disable/enable their platform login
export async function setEmploymentStatus(
  employee: Pick<Employee, 'id' | 'profile_id'>,
  status: 'active' | 'resigned'
): Promise<{ error: string | null }> {
  const upd = await updateEmployee(employee.id, status === 'resigned'
    ? { employment_status: 'resigned', resigned_at: new Date().toISOString() }
    : { employment_status: 'active', resigned_at: null });
  if (upd.error) return upd;
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
  return { error: friendlyDbError(error) };
}

export async function updateSalaryRecord(id: string, payload: Partial<SalaryRecordPayload>): Promise<{ error: string | null }> {
  const rounded: Record<string, number | string> = {};
  const numFields = ['gross_earning','basic_salary_earned','total_allowance_earned','total_gross_earning','epf_employer','etf_payment','epf_employee','total_deductions','net_pay'] as const;
  for (const [k, v] of Object.entries(payload)) {
    rounded[k] = numFields.includes(k as typeof numFields[number]) && typeof v === 'number' ? round2(v) : v as number | string;
  }
  const { error } = await supabase.from('salary_records').update(rounded).eq('id', id);
  return { error: friendlyDbError(error) };
}

export async function deleteSalaryRecord(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('salary_records').delete().eq('id', id);
  return { error: friendlyDbError(error) };
}

// Approved leave overlapping a payroll period (works for salary preparers without leave access)
export async function getApprovedLeavesForPayroll(
  employeeId: string, start: string, end: string
): Promise<Array<Pick<LeaveRequest, 'start_date' | 'end_date' | 'leave_type'>>> {
  const { data, error } = await supabase.rpc('get_approved_leaves_for_payroll', { p_employee_id: employeeId, p_start: start, p_end: end });
  if (!error && Array.isArray(data)) return data;
  const all = await getLeaveRequests(employeeId, 'approved');
  return all.filter(l => l.start_date <= end && l.end_date >= start);
}

// =================== LEAVE TYPE CONFIG ===================
export async function getLeaveTypeConfigs(): Promise<LeaveTypeConfig[]> {
  const { data } = await supabase
    .from('leave_type_config')
    .select('*')
    .order('leave_type');
  return Array.isArray(data) ? data : [];
}

export async function updateLeaveTypeConfig(id: string, updates: Partial<LeaveTypeConfig>): Promise<{ error: string | null }> {
  // select() so an RLS-blocked update (0 rows) is reported instead of silently ignored
  const { data, error } = await supabase.from('leave_type_config').update(updates).eq('id', id).select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'You do not have permission to change leave configuration.' };
  return { error: null };
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
  return { error: friendlyDbError(error) };
}

// Employees may withdraw their own request while it is still pending
export async function withdrawLeaveRequest(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from('leave_requests').delete().eq('id', id).eq('status', 'pending').select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'This request can no longer be withdrawn (already reviewed, or withdrawal is not enabled yet).' };
  return { error: null };
}

export async function reviewLeaveRequest(
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string,
  reviewComment?: string
): Promise<{ error: string | null }> {
  // Server-side review: blocks reviewing your own request and already-reviewed requests
  const { error } = await supabase.rpc('review_leave_request', { p_leave_id: id, p_status: status, p_comment: reviewComment || null });
  if (!isMissingFunction(error)) return { error: error ? error.message : null };
  // Before migration 00016: direct update
  const { error: legacyErr } = await supabase.from('leave_requests').update({
    status,
    reviewed_by: reviewedBy,
    review_comment: reviewComment || null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending');
  return { error: friendlyDbError(legacyErr) };
}

// =================== SALARY SLIP REQUESTS ===================
// Employees request a printed slip; payroll staff mark it ready for pickup (the employee is notified)
export async function requestSalarySlip(salaryRecordId: string, note?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_salary_slip', { p_salary_record_id: salaryRecordId, p_note: note?.trim() || null });
  return { error: error ? error.message : null };
}

export async function getSlipRequests(employeeId?: string): Promise<SalarySlipRequest[]> {
  let query = supabase.from('salary_slip_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function updateSlipRequest(id: string, status: Exclude<SlipRequestStatus, 'pending'>, adminNote?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_salary_slip_request', { p_request_id: id, p_status: status, p_admin_note: adminNote?.trim() || null });
  return { error: error ? error.message : null };
}

export async function cancelSlipRequest(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from('salary_slip_requests').delete().eq('id', id).eq('status', 'pending').select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'This request can no longer be cancelled.' };
  return { error: null };
}

// =================== NOTIFICATIONS ===================
export async function getNotifications(limit = 30): Promise<AppNotification[]> {
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  return Array.isArray(data) ? data : [];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
}

export async function dismissNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

// =================== LEAVE GRANTS (maternity / paternity per employee) ===================
export async function getLeaveGrants(employeeId?: string): Promise<EmployeeLeaveGrant[]> {
  let query = supabase.from('employee_leave_grants').select('*');
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
}

export async function setLeaveGrant(employeeId: string, leaveType: GrantedLeaveType, granted: boolean): Promise<{ error: string | null }> {
  const { error } = granted
    ? await supabase.from('employee_leave_grants').upsert({ employee_id: employeeId, leave_type: leaveType }, { onConflict: 'employee_id,leave_type', ignoreDuplicates: true })
    : await supabase.from('employee_leave_grants').delete().eq('employee_id', employeeId).eq('leave_type', leaveType);
  return { error: friendlyDbError(error) };
}

// =================== ACTIVITY LOG (admin only, written by database triggers) ===================
export async function getAuditLog(filters: {
  table?: string; action?: string; from?: string; to?: string; limit?: number;
} = {}): Promise<AuditLogEntry[]> {
  let query = supabase.from('audit_log').select('*').order('occurred_at', { ascending: false }).limit(filters.limit ?? 300);
  if (filters.table) query = query.eq('table_name', filters.table);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.from) query = query.gte('occurred_at', `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte('occurred_at', `${filters.to}T23:59:59.999`);
  const { data } = await query;
  return Array.isArray(data) ? data : [];
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
