import type { SalaryCalcInputs, SalaryCalcResult } from '@/types/types';

export const STAMP_DUTY_AMOUNT = 25;

export function calculateSalary(inputs: SalaryCalcInputs): SalaryCalcResult {
  const {
    basicSalary, transportationAllowance, educationAllowance, attendanceAllowance,
    actualWorkingDays, leaveEntitlementDays, stampDuty,
  } = inputs;
  const CONSTANT_DAYS = 30;

  const totalPay = basicSalary + transportationAllowance + educationAllowance + attendanceAllowance;
  const perDayBasic = basicSalary / CONSTANT_DAYS;
  const perDayTransportation = transportationAllowance / CONSTANT_DAYS;
  const perDayEducation = educationAllowance / CONSTANT_DAYS;
  const perDayAttendance = attendanceAllowance / CONSTANT_DAYS;
  const perDayTotal = totalPay / CONSTANT_DAYS;

  const totalDaysEntitled = actualWorkingDays + leaveEntitlementDays;
  const grossEarning = totalDaysEntitled * perDayTotal;
  const basicSalaryEarned = perDayBasic * totalDaysEntitled;
  const totalAllowanceEarned = (perDayTransportation + perDayEducation + perDayAttendance) * totalDaysEntitled;
  const totalGrossEarning = basicSalaryEarned + totalAllowanceEarned;

  const epfEmployer = basicSalaryEarned * 0.12;
  const etfPayment = basicSalaryEarned * 0.03;
  const totalStatutory = epfEmployer + etfPayment;

  const epfEmployee = basicSalaryEarned * 0.08;
  const stampDutyAmount = stampDuty > 0 ? stampDuty : 0;
  const totalDeductions = epfEmployee + stampDutyAmount;
  const netPay = totalGrossEarning - totalDeductions;

  return {
    totalPay,
    perDayBasic,
    perDayTransportation,
    perDayEducation,
    perDayAttendance,
    perDayTotal,
    totalDaysEntitled,
    grossEarning,
    basicSalaryEarned,
    totalAllowanceEarned,
    totalGrossEarning,
    epfEmployer,
    etfPayment,
    totalStatutory,
    epfEmployee,
    stampDuty: stampDutyAmount,
    totalDeductions,
    netPay,
  };
}

export function formatLKR(amount: number): string {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
