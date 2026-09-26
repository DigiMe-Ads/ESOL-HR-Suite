export type UserRole = 'admin' | 'hr_admin' | 'manager' | 'staff';
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
