import type { LeaveRequest, LeaveType, LeaveTypeConfig } from '@/types/types';

// Sri Lankan statutory leave policy (Shop and Office Employees Act)
export const ANNUAL_ENTITLEMENT = 14;
export const CASUAL_ENTITLEMENT = 7;
export const MATERNITY_ENTITLEMENT = 84;
export const MATERNITY_MISCARRIAGE_DAYS = 42;
export const PATERNITY_ENTITLEMENT = 3;
export const OTHER_ENTITLEMENT = 3;
export const ANNUAL_MIN_CONSECUTIVE = 7;

/** Leave types an admin enables per employee (Leave Configuration → Employee entitlements) */
export const GRANTED_LEAVE_TYPES: LeaveType[] = ['maternity', 'paternity'];

/** Leave types this employee may apply for: everything active, except maternity/paternity unless granted */
export function availableLeaveTypes(all: LeaveType[], policy: LeavePolicy, grantedTypes: LeaveType[]): LeaveType[] {
  return all.filter(t => !policy.inactive.includes(t) && (!GRANTED_LEAVE_TYPES.includes(t) || grantedTypes.includes(t)));
}

/** "Year 1", "Year 2"… of service, as used by the annual/casual rules */
export function serviceYearLabel(commencement: string, asOf: Date = new Date()): string {
  return `Year ${completedYears(commencement, asOf) + 1}`;
}

/** Full-year entitlements and active leave types, maintained on the Leave Configuration page */
export interface LeavePolicy {
  annual: number;
  casual: number;
  maternity: number;
  paternity: number;
  other: number;
  inactive: LeaveType[];
}

export const DEFAULT_POLICY: LeavePolicy = {
  annual: ANNUAL_ENTITLEMENT,
  casual: CASUAL_ENTITLEMENT,
  maternity: MATERNITY_ENTITLEMENT,
  paternity: PATERNITY_ENTITLEMENT,
  other: OTHER_ENTITLEMENT,
  inactive: [],
};

// Sick leave has no allocation of its own (it shares the casual pool), so its row is only used for is_active
export function policyFromConfig(configs: LeaveTypeConfig[]): LeavePolicy {
  const days = (type: LeaveType, fallback: number) => configs.find(c => c.leave_type === type)?.annual_entitlement_days ?? fallback;
  return {
    annual: days('annual', ANNUAL_ENTITLEMENT),
    casual: days('casual', CASUAL_ENTITLEMENT),
    maternity: days('maternity', MATERNITY_ENTITLEMENT),
    paternity: days('paternity', PATERNITY_ENTITLEMENT),
    other: days('other', OTHER_ENTITLEMENT),
    inactive: configs.filter(c => !c.is_active).map(c => c.leave_type),
  };
}

// Date-only strings ("YYYY-MM-DD") parsed as local dates, so time zones never shift a day
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Inclusive calendar-day count between two date-only strings (0 when end is before start) */
export function countLeaveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

export function completedYears(commencement: string, asOf: Date = new Date()): number {
  const start = parseLocalDate(commencement);
  if (Number.isNaN(start.getTime())) return 0;
  let years = asOf.getFullYear() - start.getFullYear();
  const anniversary = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  if (asOf < anniversary) years -= 1;
  return Math.max(years, 0);
}

export function completedMonths(commencement: string, asOf: Date = new Date()): number {
  const start = parseLocalDate(commencement);
  if (Number.isNaN(start.getTime())) return 0;
  let months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

// Annual: Year 1 none; Year 2 pro-rated by start quarter; Year 3+ full
export function annualEntitlement(commencement: string, asOf: Date = new Date(), policy: LeavePolicy = DEFAULT_POLICY): number {
  const years = completedYears(commencement, asOf);
  if (years < 1) return 0;
  if (years === 1) {
    const quarter = Math.floor(parseLocalDate(commencement).getMonth() / 3); // 0=Jan-Mar ... 3=Oct-Dec
    // Statutory Year-2 scale (14/10/7/4), scaled when the company grants a different full entitlement
    return Math.round([14, 10, 7, 4][quarter] * policy.annual / ANNUAL_ENTITLEMENT);
  }
  return policy.annual;
}

// Casual: Year 1 accrues 1 day per 2 completed months; Year 2+ full allocation at start of calendar year
export function casualEntitlement(commencement: string, asOf: Date = new Date(), policy: LeavePolicy = DEFAULT_POLICY): number {
  const years = completedYears(commencement, asOf);
  if (years < 1) return Math.min(Math.floor(completedMonths(commencement, asOf) / 2), policy.casual);
  return policy.casual;
}

export function entitlementFor(type: LeaveType, commencement: string, asOf: Date = new Date(), policy: LeavePolicy = DEFAULT_POLICY): number {
  switch (type) {
    case 'annual': return annualEntitlement(commencement, asOf, policy);
    case 'casual':
    case 'sick': return casualEntitlement(commencement, asOf, policy);
    case 'maternity': return policy.maternity;
    case 'paternity': return policy.paternity;
    case 'other': return policy.other;
    default: return 0;
  }
}

const inYear = (l: LeaveRequest, year: number) => parseLocalDate(l.start_date).getFullYear() === year;

export function usedDays(leaves: LeaveRequest[], type: LeaveType, year: number): number {
  return leaves
    .filter(l => l.status === 'approved' && l.leave_type === type && inYear(l, year))
    .reduce((sum, l) => sum + l.total_days, 0);
}

// Sick leave draws from the casual pool (no separate statutory allocation)
export function casualUsedDays(leaves: LeaveRequest[], year: number): number {
  return usedDays(leaves, 'casual', year) + usedDays(leaves, 'sick', year);
}

export function remainingDays(
  type: LeaveType, commencement: string, leaves: LeaveRequest[], year: number = new Date().getFullYear(), policy: LeavePolicy = DEFAULT_POLICY,
): number {
  const entitled = entitlementFor(type, commencement, new Date(), policy);
  const used = type === 'casual' || type === 'sick' ? casualUsedDays(leaves, year) : usedDays(leaves, type, year);
  return Math.max(entitled - used, 0);
}

// Days already committed (approved or still pending) for the balance check, so pending requests can't overbook
function committedDays(leaves: LeaveRequest[], types: LeaveType[], year: number): number {
  return leaves
    .filter(l => l.status !== 'rejected' && types.includes(l.leave_type) && inYear(l, year))
    .reduce((sum, l) => sum + l.total_days, 0);
}

export function validateLeaveRequest(params: {
  type: LeaveType;
  totalDays: number;
  commencement: string;
  leaves: LeaveRequest[];
  startDate?: string;
  endDate?: string;
  policy?: LeavePolicy;
  /** Maternity/paternity grants for this employee; when given, ungranted types are rejected */
  grantedTypes?: LeaveType[];
}): { ok: boolean; error?: string } {
  const { type, totalDays, commencement, leaves, startDate, endDate, policy = DEFAULT_POLICY, grantedTypes } = params;
  // Balances belong to the calendar year the leave starts in
  const year = startDate ? parseLocalDate(startDate).getFullYear() : new Date().getFullYear();
  if (totalDays <= 0) return { ok: false, error: 'End date must be on or after start date' };
  if (policy.inactive.includes(type)) return { ok: false, error: 'This leave type is currently not available. Contact HR.' };
  if (grantedTypes && GRANTED_LEAVE_TYPES.includes(type) && !grantedTypes.includes(type)) {
    return { ok: false, error: `${type === 'maternity' ? 'Maternity' : 'Paternity'} leave has not been enabled for you. Please contact HR.` };
  }

  if (startDate && endDate) {
    const clash = leaves.find(l => l.status !== 'rejected' && l.start_date <= endDate && l.end_date >= startDate);
    if (clash) {
      return { ok: false, error: `These dates overlap your ${clash.status} ${clash.leave_type} leave (${clash.start_date} to ${clash.end_date}).` };
    }
  }

  if (type === 'annual') {
    const years = completedYears(commencement);
    if (years < 1) return { ok: false, error: 'Annual leave entitlement begins in Year 2 of service (no entitlement in Year 1).' };
    const entitled = annualEntitlement(commencement, new Date(), policy);
    const committed = committedDays(leaves, ['annual'], year);
    if (committed + totalDays > entitled) {
      return { ok: false, error: `Insufficient annual leave balance. Entitled: ${entitled}, already taken or requested: ${committed}, available: ${Math.max(entitled - committed, 0)} day(s).` };
    }
    // At least one block of 7+ consecutive days per year, when the entitlement allows it.
    // A shorter request is fine as long as enough balance stays free for that block (or it was already taken).
    const hasBlock = leaves.some(l => l.status !== 'rejected' && l.leave_type === 'annual' && inYear(l, year) && l.total_days >= ANNUAL_MIN_CONSECUTIVE);
    const leftAfter = entitled - committed - totalDays;
    if (totalDays < ANNUAL_MIN_CONSECUTIVE && entitled >= ANNUAL_MIN_CONSECUTIVE && !hasBlock && leftAfter < ANNUAL_MIN_CONSECUTIVE) {
      return { ok: false, error: `Annual leave must include one block of at least ${ANNUAL_MIN_CONSECUTIVE} consecutive days. Take that block first, or keep ${ANNUAL_MIN_CONSECUTIVE} days free for it.` };
    }
  }

  if (type === 'casual' || type === 'sick') {
    const entitled = casualEntitlement(commencement, new Date(), policy);
    const committed = committedDays(leaves, ['casual', 'sick'], year);
    if (committed + totalDays > entitled) {
      return { ok: false, error: `Insufficient casual leave balance (sick leave is covered by the casual allocation). Entitled: ${entitled}, already taken or requested: ${committed}, available: ${Math.max(entitled - committed, 0)} day(s).` };
    }
  }

  if (type === 'maternity' && totalDays > policy.maternity) {
    return { ok: false, error: `Maternity leave cannot exceed ${policy.maternity} days (${MATERNITY_MISCARRIAGE_DAYS} days for a non-live birth or miscarriage).` };
  }

  if (type === 'paternity' && totalDays > policy.paternity) {
    return { ok: false, error: `Paternity leave is limited to ${policy.paternity} days under company policy.` };
  }

  if (type === 'other') {
    const committed = committedDays(leaves, ['other'], year);
    if (committed + totalDays > policy.other) {
      return { ok: false, error: `Other leave is limited to ${policy.other} days per year. Available: ${Math.max(policy.other - committed, 0)} day(s).` };
    }
  }

  return { ok: true };
}
