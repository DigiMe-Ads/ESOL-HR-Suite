import type { LeaveRequest, LeaveType } from '@/types/types';

// Sri Lankan statutory leave policy (Shop and Office Employees Act)
export const ANNUAL_ENTITLEMENT = 14;
export const CASUAL_ENTITLEMENT = 7;
export const MATERNITY_ENTITLEMENT = 84;
export const MATERNITY_MISCARRIAGE_DAYS = 42;
export const PATERNITY_ENTITLEMENT = 3;
export const ANNUAL_MIN_CONSECUTIVE = 7;

export function completedYears(commencement: string, asOf: Date = new Date()): number {
  const start = new Date(commencement);
  if (Number.isNaN(start.getTime())) return 0;
  let years = asOf.getFullYear() - start.getFullYear();
  const anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  if (asOf < anniversary) years -= 1;
  return Math.max(years, 0);
}

export function completedMonths(commencement: string, asOf: Date = new Date()): number {
  const start = new Date(commencement);
  if (Number.isNaN(start.getTime())) return 0;
  let months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

// Annual: Year 1 none; Year 2 pro-rated by start quarter; Year 3+ full
export function annualEntitlement(commencement: string, asOf: Date = new Date()): number {
  const years = completedYears(commencement, asOf);
  if (years < 1) return 0;
  if (years === 1) {
    const start = new Date(commencement);
    const quarter = Math.floor(start.getMonth() / 3); // 0=Jan-Mar ... 3=Oct-Dec
    return [14, 10, 7, 4][quarter];
  }
  return ANNUAL_ENTITLEMENT;
}

// Casual: Year 1 accrues 1 day per 2 completed months; Year 2+ full 7 at start of calendar year
export function casualEntitlement(commencement: string, asOf: Date = new Date()): number {
  const years = completedYears(commencement, asOf);
  if (years < 1) return Math.floor(completedMonths(commencement, asOf) / 2);
  return CASUAL_ENTITLEMENT;
}

export function entitlementFor(type: LeaveType, commencement: string, asOf: Date = new Date()): number {
  switch (type) {
    case 'annual': return annualEntitlement(commencement, asOf);
    case 'casual':
    case 'sick': return casualEntitlement(commencement, asOf);
    case 'maternity': return MATERNITY_ENTITLEMENT;
    case 'paternity': return PATERNITY_ENTITLEMENT;
    default: return 0;
  }
}

export function usedDays(leaves: LeaveRequest[], type: LeaveType, year: number): number {
  return leaves
    .filter(l => l.status === 'approved' && l.leave_type === type && new Date(l.start_date).getFullYear() === year)
    .reduce((sum, l) => sum + l.total_days, 0);
}

// Sick leave draws from the casual pool (no separate statutory allocation)
export function casualUsedDays(leaves: LeaveRequest[], year: number): number {
  return usedDays(leaves, 'casual', year) + usedDays(leaves, 'sick', year);
}

export function remainingDays(type: LeaveType, commencement: string, leaves: LeaveRequest[], year: number = new Date().getFullYear()): number {
  const entitled = entitlementFor(type, commencement);
  const used = type === 'casual' || type === 'sick' ? casualUsedDays(leaves, year) : usedDays(leaves, type, year);
  return Math.max(entitled - used, 0);
}

export function validateLeaveRequest(params: {
  type: LeaveType;
  totalDays: number;
  commencement: string;
  leaves: LeaveRequest[];
}): { ok: boolean; error?: string } {
  const { type, totalDays, commencement, leaves } = params;
  const year = new Date().getFullYear();
  if (totalDays <= 0) return { ok: false, error: 'End date must be on or after start date' };

  if (type === 'annual') {
    const years = completedYears(commencement);
    if (years < 1) return { ok: false, error: 'Annual leave entitlement begins in Year 2 of service (no entitlement in Year 1).' };
    if (totalDays < ANNUAL_MIN_CONSECUTIVE) {
      return { ok: false, error: 'Annual leave must be taken as at least 7 consecutive days.' };
    }
    const entitled = annualEntitlement(commencement);
    const used = usedDays(leaves, 'annual', year);
    if (used + totalDays > entitled) {
      return { ok: false, error: `Insufficient annual leave balance. Entitled: ${entitled}, used: ${used}, available: ${Math.max(entitled - used, 0)} day(s).` };
    }
  }

  if (type === 'casual' || type === 'sick') {
    const entitled = casualEntitlement(commencement);
    const used = casualUsedDays(leaves, year);
    if (used + totalDays > entitled) {
      return { ok: false, error: `Insufficient casual leave balance (sick leave is covered by the casual allocation). Entitled: ${entitled}, used: ${used}, available: ${Math.max(entitled - used, 0)} day(s).` };
    }
  }

  if (type === 'maternity' && totalDays > MATERNITY_ENTITLEMENT) {
    return { ok: false, error: 'Maternity leave cannot exceed 84 days (42 days for a non-live birth or miscarriage).' };
  }

  if (type === 'paternity' && totalDays > PATERNITY_ENTITLEMENT) {
    return { ok: false, error: 'Paternity leave is limited to 3 days under company policy.' };
  }

  return { ok: true };
}
