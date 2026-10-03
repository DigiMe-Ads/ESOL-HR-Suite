import type { LeaveRequest } from '@/types/types';
import { parseLocalDate } from '@/lib/leavePolicy';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ordinal = (n: number) => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface PayrollPeriod {
  label: string;
  start: Date;
  end: Date;
  /** YYYY-MM-DD, for database queries */
  startIso: string;
  endIso: string;
  /** Calendar days in the period (28–31) */
  days: number;
}

// Payroll period: 25th of previous month → 24th of selected month
export function buildPayrollPeriod(monthName: string, yearStr: string): PayrollPeriod | null {
  const m = MONTHS.indexOf(monthName);
  const y = parseInt(yearStr);
  if (m < 0 || Number.isNaN(y)) return null;
  const start = new Date(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 25);
  const end = new Date(y, m, 24);
  const fmt = (d: Date) => `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return {
    label: `${fmt(start)} to ${fmt(end)}`,
    start, end,
    startIso: isoDate(start), endIso: isoDate(end),
    days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
  };
}

// Approved leave days falling inside the period (inclusive; dates compared as local calendar days)
export function leaveDaysInPeriod(
  leaves: Array<Pick<LeaveRequest, 'start_date' | 'end_date'> & { status?: LeaveRequest['status'] }>,
  start: Date,
  end: Date,
): number {
  const msDay = 86400000;
  return leaves.reduce((sum, l) => {
    if (l.status && l.status !== 'approved') return sum;
    const s = parseLocalDate(l.start_date);
    const e = parseLocalDate(l.end_date);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return sum;
    const overlapStart = Math.max(s.getTime(), start.getTime());
    const overlapEnd = Math.min(e.getTime(), end.getTime());
    const days = Math.round((overlapEnd - overlapStart) / msDay) + 1;
    return sum + (days > 0 ? days : 0);
  }, 0);
}

/**
 * Approved leave in the period, split into paid leave and unpaid ("No Pay") leave.
 * Paid leave counts towards paid days; no-pay days are deducted (not paid).
 */
export function splitLeaveDays(
  leaves: Array<Pick<LeaveRequest, 'start_date' | 'end_date'> & { leave_type?: string; status?: LeaveRequest['status'] }>,
  start: Date,
  end: Date,
): { paid: number; noPay: number } {
  return {
    paid: leaveDaysInPeriod(leaves.filter(l => l.leave_type !== 'no_pay'), start, end),
    noPay: leaveDaysInPeriod(leaves.filter(l => l.leave_type === 'no_pay'), start, end),
  };
}

/** Salary is calculated on a fixed 30-day month, so a full month is 30 days even in a 28/29-day period */
export const PAYROLL_BASIS_DAYS = 30;

/** Paid days (working + leave) may not exceed the larger of the 30-day basis and the calendar days in the period */
export function validatePayrollDays(workingDays: number, leaveDays: number, periodDays: number): string | null {
  if (workingDays < 0 || leaveDays < 0) return 'Working days and leave days cannot be negative.';
  const limit = Math.max(PAYROLL_BASIS_DAYS, periodDays);
  if (workingDays + leaveDays > limit) {
    return `Working days + leave days (${workingDays + leaveDays}) cannot exceed ${limit} days for this payroll period.`;
  }
  return null;
}
