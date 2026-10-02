export type UserRole = 'admin' | 'hr_admin' | 'manager' | 'staff' | 'finance';

// Granular module-level access permissions
export type Permission =
  | 'dashboard'
  | 'employees'
  | 'leaves'
  | 'salary_management'
  | 'salary_slips'
  | 'user_management';

export const PERMISSION_MODULES: Array<{ key: Permission; label: string; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', description: 'Overview dashboard with company statistics' },
  { key: 'employees', label: 'Employee Management', description: 'Employee list, profiles, and records' },
  { key: 'leaves', label: 'Leave Management', description: 'Leave requests, approvals, and balances' },
  { key: 'salary_management', label: 'Salary Management', description: 'Create, edit, and view salary entries' },
  { key: 'salary_slips', label: 'Salary Slips', description: 'Generate, view, and download salary slips' },
  { key: 'user_management', label: 'User Management', description: 'User accounts, roles, and access control' },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.map(m => m.key);

// Default module presets applied when a base role is selected
export const ROLE_PERMISSION_PRESETS: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  hr_admin: ['dashboard', 'employees', 'leaves', 'salary_management', 'salary_slips'],
  manager: ['dashboard', 'leaves'],
  finance: ['salary_management', 'salary_slips'],
  staff: ['dashboard', 'leaves', 'salary_slips'],
};
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'annual' | 'sick' | 'casual' | 'maternity' | 'paternity' | 'other';
export type EmploymentStatus = 'active' | 'resigned';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: UserRole;
  permissions: Permission[];
  avatar_url: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  employment_commencement: string;
  designation: string;
  bank: string;
  bank_branch: string;
  bank_account_number: string;
  /** Sri Lankan NIC (old 9 digits + V/X, or new 12 digits) */
  nic_number: string | null;
  /** Storage path in the private employee-files bucket */
  photo_path: string | null;
  employment_status: EmploymentStatus;
  resigned_at: string | null;
  profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryRecord {
  id: string;
  employee_id: string;
  payroll_month: string;
  payroll_period: string;
  payroll_year: number;
  payroll_month_number: number;
  basic_salary: number;
  transportation_allowance: number;
  education_allowance: number;
  attendance_allowance: number;
  total_pay: number;
  working_days_constant: number;
  actual_working_days: number;
  leave_entitlement_days: number;
  total_days_entitled: number;
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
  created_at: string;
  updated_at: string;
}

export interface LeaveTypeConfig {
  id: string;
  leave_type: LeaveType;
  label: string;
  annual_entitlement_days: number;
  is_active: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryCalcInputs {
  basicSalary: number;
  transportationAllowance: number;
  educationAllowance: number;
  attendanceAllowance: number;
  actualWorkingDays: number;
  leaveEntitlementDays: number;
  stampDuty: number;
}

export interface SalaryCalcResult {
  totalPay: number;
  perDayBasic: number;
  perDayTransportation: number;
  perDayEducation: number;
  perDayAttendance: number;
  perDayTotal: number;
  totalDaysEntitled: number;
  grossEarning: number;
  basicSalaryEarned: number;
  totalAllowanceEarned: number;
  totalGrossEarning: number;
  epfEmployer: number;
  etfPayment: number;
  totalStatutory: number;
  epfEmployee: number;
  stampDuty: number;
  totalDeductions: number;
  netPay: number;
}

export type EmployeeDocumentType = 'education' | 'service_letter' | 'other';

export const DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  education: 'Educational certificate',
  service_letter: 'Service letter',
  other: 'Other document',
};

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: EmployeeDocumentType;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type SlipRequestStatus = 'pending' | 'ready' | 'collected' | 'declined';

export const SLIP_REQUEST_LABELS: Record<SlipRequestStatus, string> = {
  pending: 'Requested',
  ready: 'Ready for pickup',
  collected: 'Collected',
  declined: 'Declined',
};

export interface SalarySlipRequest {
  id: string;
  employee_id: string;
  salary_record_id: string;
  payroll_month: string;
  note: string | null;
  status: SlipRequestStatus;
  admin_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  profile_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Leave types that are only available to employees an admin has selected */
export type GrantedLeaveType = 'maternity' | 'paternity';

export interface EmployeeLeaveGrant {
  employee_id: string;
  leave_type: GrantedLeaveType;
  granted_by: string | null;
  created_at: string;
}
