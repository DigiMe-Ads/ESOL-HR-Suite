import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getEmployeeDirectory, createSalaryRecord, updateSalaryRecord, getSalaryRecord, getApprovedLeavesForPayroll, getSalaryRecords } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import { calculateSalary, formatLKR, STAMP_DUTY_AMOUNT } from '@/lib/salaryCalc';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveRequest, SalaryRecord } from '@/types/types';
import { MONTHS, PAYROLL_BASIS_DAYS, buildPayrollPeriod, splitLeaveDays, validatePayrollDays } from '@/lib/payroll';
import { toast } from 'sonner';
import { ArrowLeft, Calculator, Wand2, Plus, Trash2 } from 'lucide-react';

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

type AllowanceType = 'transport' | 'education' | 'attendance';
const ALLOWANCE_TYPES: { value: AllowanceType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'education', label: 'Education' },
  { value: 'attendance', label: 'Attendance' },
];
const ALLOWANCE_LABELS: Record<AllowanceType, string> = { transport: 'Transport', education: 'Education', attendance: 'Attendance' };

interface AllowanceRow { type: AllowanceType; amount: string }

interface FormState {
  employee_id: string;
  payroll_month_name: string;
  payroll_year: string;
  payroll_period: string;
  basic_salary: string;
  allowances: AllowanceRow[];
  actual_working_days: string;
  leave_entitlement_days: string;
  stamp_duty_enabled: boolean;
}

const EMPTY: FormState = {
  employee_id: '', payroll_month_name: '', payroll_year: String(new Date().getFullYear()),
  payroll_period: '', basic_salary: '', allowances: [],
  actual_working_days: '30', leave_entitlement_days: '0', stamp_duty_enabled: true,
};

// Map allowance rows to DB columns
function allowanceMap(allowances: AllowanceRow[]) {
  return {
    transportation_allowance: allowances.filter(a => a.type === 'transport').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0),
    education_allowance: allowances.filter(a => a.type === 'education').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0),
    attendance_allowance: allowances.filter(a => a.type === 'attendance').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0),
  };
}

const SalaryFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [form, setForm] = useState<FormState>({ ...EMPTY, employee_id: searchParams.get('employeeId') ?? '' });
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [leaves, setLeaves] = useState<Array<Pick<LeaveRequest, 'start_date' | 'end_date' | 'leave_type'>>>([]);
  const [noPayDays, setNoPayDays] = useState(0);
  // "YYYY-M" keys of months that already have a salary record for the selected employee
  const [takenMonths, setTakenMonths] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [daysTouched, setDaysTouched] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [emps, rec] = await Promise.all([
        getEmployeeDirectory(),
        isEdit ? getSalaryRecord(id!) : Promise.resolve(null),
      ]);
      setEmployees(emps);
      if (rec) {
        const allow: AllowanceRow[] = [];
        if (rec.transportation_allowance > 0) allow.push({ type: 'transport', amount: String(rec.transportation_allowance) });
        if (rec.education_allowance > 0) allow.push({ type: 'education', amount: String(rec.education_allowance) });
        if (rec.attendance_allowance > 0) allow.push({ type: 'attendance', amount: String(rec.attendance_allowance) });
        setForm({
          employee_id: rec.employee_id,
          payroll_month_name: MONTHS[rec.payroll_month_number - 1] ?? '',
          payroll_year: String(rec.payroll_year),
          payroll_period: rec.payroll_period,
          basic_salary: String(rec.basic_salary),
          allowances: allow,
          actual_working_days: String(rec.actual_working_days),
          leave_entitlement_days: String(rec.leave_entitlement_days),
          stamp_duty_enabled: rec.stamp_duty > 0,
        });
        setDaysTouched(true);
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  const period = useMemo(() => buildPayrollPeriod(form.payroll_month_name, form.payroll_year), [form.payroll_month_name, form.payroll_year]);

  // Approved leave in the selected period (RPC works for Finance users without leave access)
  useEffect(() => {
    if (!form.employee_id || !period || isEdit) return;
    let cancelled = false;
    getApprovedLeavesForPayroll(form.employee_id, period.startIso, period.endIso).then(l => { if (!cancelled) setLeaves(l); });
    return () => { cancelled = true; };
  }, [form.employee_id, period, isEdit]);

  // Auto-populate payroll period (also when the month changes while editing) + working/leave days
  useEffect(() => {
    if (loading || !period) return;
    setForm(f => f.payroll_period === period.label ? f : { ...f, payroll_period: period.label });
    if (isEdit) return;
    if (!daysTouched && form.employee_id) {
      // Paid leave counts as paid days; No Pay leave days are not paid
      const { paid: leaveDays, noPay } = splitLeaveDays(leaves, period.start, period.end);
      setNoPayDays(noPay);
      const working = Math.max(30 - leaveDays - noPay, 0);
      setForm(f => (
        f.leave_entitlement_days === String(leaveDays) && f.actual_working_days === String(working)
          ? f : { ...f, leave_entitlement_days: String(leaveDays), actual_working_days: String(working) }
      ));
    }
  }, [period, form.employee_id, leaves, loading, isEdit, daysTouched]);

  // Months already paid for this employee can't be picked again (the record being edited stays selectable)
  useEffect(() => {
    if (!form.employee_id) { setTakenMonths(new Set()); return; }
    let cancelled = false;
    getSalaryRecords(form.employee_id).then(recs => {
      if (cancelled) return;
      setTakenMonths(new Set(recs.filter(r => r.id !== id).map(r => `${r.payroll_year}-${r.payroll_month_number}`)));
    });
    return () => { cancelled = true; };
  }, [form.employee_id, id]);

  const isMonthTaken = (monthName: string, year: string) => takenMonths.has(`${year}-${MONTHS.indexOf(monthName) + 1}`);

  // If the employee/year changes onto an already-paid month, clear the month selection
  useEffect(() => {
    if (form.payroll_month_name && isMonthTaken(form.payroll_month_name, form.payroll_year)) {
      setForm(f => ({ ...f, payroll_month_name: '', payroll_period: '' }));
    }
  }, [takenMonths, form.payroll_year]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const addAllowance = () => setForm(f => ({ ...f, allowances: [...f.allowances, { type: 'transport', amount: '' }] }));
  const updateAllowance = (idx: number, patch: Partial<AllowanceRow>) =>
    setForm(f => ({ ...f, allowances: f.allowances.map((a, i) => i === idx ? { ...a, ...patch } : a) }));
  const removeAllowance = (idx: number) =>
    setForm(f => ({ ...f, allowances: f.allowances.filter((_, i) => i !== idx) }));

  const amounts = allowanceMap(form.allowances);

  const calc = useMemo(() => calculateSalary({
    basicSalary: parseFloat(form.basic_salary) || 0,
    transportationAllowance: amounts.transportation_allowance,
    educationAllowance: amounts.education_allowance,
    attendanceAllowance: amounts.attendance_allowance,
    actualWorkingDays: parseFloat(form.actual_working_days) || 0,
    leaveEntitlementDays: parseFloat(form.leave_entitlement_days) || 0,
    stampDuty: form.stamp_duty_enabled ? STAMP_DUTY_AMOUNT : 0,
  }), [form, amounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.payroll_month_name || !form.payroll_year || !form.basic_salary) {
      toast.error('Please fill all required fields'); return;
    }
    const dayError = period && validatePayrollDays(parseFloat(form.actual_working_days) || 0, parseFloat(form.leave_entitlement_days) || 0, period.days);
    if (dayError) { toast.error(dayError); return; }
    // Guard: no duplicate allowance types
    const types = form.allowances.map(a => a.type);
    if (new Set(types).size !== types.length) {
      toast.error('Each allowance type can only be added once'); return;
    }
    setSaving(true);
    // NOTE: total_pay / total_days_entitled are DB-generated — omitted from the payload
    const payload = {
      employee_id: form.employee_id,
      payroll_month: `${form.payroll_month_name} ${form.payroll_year}`,
      payroll_period: form.payroll_period,
      payroll_year: parseInt(form.payroll_year),
      payroll_month_number: MONTHS.indexOf(form.payroll_month_name) + 1,
      basic_salary: parseFloat(form.basic_salary) || 0,
      transportation_allowance: amounts.transportation_allowance,
      education_allowance: amounts.education_allowance,
      attendance_allowance: amounts.attendance_allowance,
      working_days_constant: 30,
      actual_working_days: parseFloat(form.actual_working_days) || 0,
      leave_entitlement_days: parseFloat(form.leave_entitlement_days) || 0,
      gross_earning: calc.grossEarning,
      basic_salary_earned: calc.basicSalaryEarned,
      total_allowance_earned: calc.totalAllowanceEarned,
      total_gross_earning: calc.totalGrossEarning,
      epf_employer: calc.epfEmployer,
      etf_payment: calc.etfPayment,
      epf_employee: calc.epfEmployee,
      stamp_duty: form.stamp_duty_enabled ? STAMP_DUTY_AMOUNT : 0,
      total_deductions: calc.totalDeductions,
      net_pay: calc.netPay,
    };
    // created_by is kept from the original record when editing
    const result = isEdit ? await updateSalaryRecord(id!, payload) : await createSalaryRecord({ ...payload, created_by: profile!.id });
    setSaving(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(isEdit ? 'Salary record updated' : 'Salary record created');
    navigate('/salary-history');
  };

  const CalcRow = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-1.5 border-b border-border last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${bold ? 'text-primary' : 'text-foreground'}`}>{formatLKR(value)}</span>
    </div>
  );

  if (loading) return <AppLayout><div className="p-8"><div className="h-48 bg-muted animate-pulse rounded-lg" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/salary-history')}><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{isEdit ? 'Edit Salary Entry' : 'Add Salary Entry'}</h1>
            <p className="text-sm text-muted-foreground">Payroll calculation for an employee</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Input */}
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3"><CardTitle className="section-label">1. Generic Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Employee <span className="text-destructive">*</span></Label>
                    <Select value={form.employee_id} onValueChange={v => set('employee_id', v)} disabled={isEdit}>
                      <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                      <SelectContent>
                        {employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.employee_id} — {e.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Month <span className="text-destructive">*</span></Label>
                      <Select value={form.payroll_month_name} onValueChange={v => set('payroll_month_name', v)}>
                        <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map(m => {
                            const taken = isMonthTaken(m, form.payroll_year);
                            return (
                              <SelectItem key={m} value={m} disabled={taken}>
                                {m}{taken ? ' — already added' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Year <span className="text-destructive">*</span></Label>
                      <Select value={form.payroll_year} onValueChange={v => set('payroll_year', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payroll Period <span className="text-xs font-normal text-muted-foreground">(auto-filled: 25th of previous month to 24th of selected month)</span></Label>
                    <Input value={form.payroll_period} readOnly />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="section-label flex items-center justify-between">
                    <span>2. Salary & Allowances</span>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addAllowance}>
                      <Plus size={13} className="mr-1" /> Add Allowance
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Basic Salary <span className="text-destructive">*</span></Label>
                    <Input type="number" min="0" step="0.01" placeholder="LKR 0.00" value={form.basic_salary}
                      onChange={e => set('basic_salary', e.target.value)} />
                  </div>
                  {form.allowances.length === 0 && (
                    <p className="text-xs text-muted-foreground bg-muted/60 rounded-md px-3 py-2.5">
                      No allowances added. Use "Add Allowance" to include Transport, Education, or Attendance allowances.
                    </p>
                  )}
                  {form.allowances.map((a, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <Label className="text-xs">Allowance Type</Label>
                        <Select value={a.type} onValueChange={v => updateAllowance(idx, { type: v as AllowanceType })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ALLOWANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 w-32 shrink-0">
                        <Label className="text-xs">Amount (LKR)</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={a.amount}
                          onChange={e => updateAllowance(idx, { amount: e.target.value })} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                        title="Remove allowance" onClick={() => removeAllowance(idx)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="section-label flex items-center gap-1.5">
                    <Wand2 size={13} className="text-accent" /> 3. Working Days
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Actual Working Days (incl. vacations) <span className="text-destructive">*</span></Label>
                    <Input type="number" min="0" max="31" step="0.5" value={form.actual_working_days}
                      onChange={e => { setDaysTouched(true); set('actual_working_days', e.target.value); }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Leave Entitlement Days</Label>
                    <Input type="number" min="0" max="90" step="0.5" value={form.leave_entitlement_days}
                      onChange={e => { setDaysTouched(true); set('leave_entitlement_days', e.target.value); }} />
                  </div>
                  {period && (
                    <p className={`text-xs ${validatePayrollDays(parseFloat(form.actual_working_days) || 0, parseFloat(form.leave_entitlement_days) || 0, period.days) ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Paid days: {(parseFloat(form.actual_working_days) || 0) + (parseFloat(form.leave_entitlement_days) || 0)} (max {Math.max(PAYROLL_BASIS_DAYS, period.days)} for this period)
                      {noPayDays > 0 && !isEdit && <span className="block text-amber-700 dark:text-amber-300">Includes {noPayDays} day{noPayDays === 1 ? '' : 's'} of approved No Pay Leave — not paid.</span>}
                    </p>
                  )}
                  {daysTouched && !isEdit && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDaysTouched(false)}>
                      <Wand2 size={13} className="mr-1" /> Reset to auto-filled values
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3"><CardTitle className="section-label">4. Deductions</CardTitle></CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 min-h-12 -mx-2 px-2 cursor-pointer rounded-md hover:bg-muted/40 transition-colors">
                    <Checkbox
                      checked={form.stamp_duty_enabled}
                      onCheckedChange={checked => set('stamp_duty_enabled', checked === true)}
                      id="stamp_duty"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Stamp Duty</p>
                      <p className="text-xs text-muted-foreground">{form.stamp_duty_enabled ? `Applies LKR ${STAMP_DUTY_AMOUNT.toFixed(2)} deduction` : 'Not applied'}</p>
                    </div>
                    <span className="text-sm text-foreground shrink-0">{form.stamp_duty_enabled ? formatLKR(STAMP_DUTY_AMOUNT) : '—'}</span>
                  </label>
                </CardContent>
              </Card>
            </div>

            {/* Right: Calculated Preview */}
            <div className="space-y-4">
              <Card className="border-border shadow-card md:sticky md:top-20 self-start">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 section-label">
                    <Calculator size={14} /> Live Calculation Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="section-label mb-2">Monthly Allocation</p>
                    <CalcRow label="Basic Salary" value={parseFloat(form.basic_salary) || 0} />
                    {form.allowances.map((a, i) => (
                      <CalcRow key={i} label={`${ALLOWANCE_LABELS[a.type]} Allowance`} value={parseFloat(a.amount) || 0} />
                    ))}
                    <CalcRow label="Total Monthly Pay" value={calc.totalPay} bold />
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="section-label mb-2">Per Day Allocation (÷ 30)</p>
                    <CalcRow label="Per Day Basic" value={calc.perDayBasic} />
                    {form.allowances.length > 0 && <CalcRow label="Per Day All Allowances" value={calc.perDayTotal - calc.perDayBasic} />}
                    <CalcRow label="Per Day Total" value={calc.perDayTotal} bold />
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="section-label mb-2">Gross Earning Breakdown</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      Working Days {form.actual_working_days || 0} + Leave {form.leave_entitlement_days || 0} = {calc.totalDaysEntitled} days
                    </p>
                    <CalcRow label="Basic Salary Earned" value={calc.basicSalaryEarned} />
                    <CalcRow label="Total Allowance Earned" value={calc.totalAllowanceEarned} />
                    <CalcRow label="Total Gross Earning" value={calc.totalGrossEarning} bold />
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="section-label mb-2">Statutory Payments (Employer)</p>
                    <CalcRow label="EPF Employer [12%]" value={calc.epfEmployer} />
                    <CalcRow label="ETF [3%]" value={calc.etfPayment} />
                    <CalcRow label="Total Statutory" value={calc.totalStatutory} bold />
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="section-label mb-2">Deductions (Employee)</p>
                    <CalcRow label="EPF Employee [8%]" value={calc.epfEmployee} />
                    <CalcRow label="Stamp Duty" value={calc.stampDuty} />
                    <CalcRow label="Total Deductions" value={calc.totalDeductions} bold />
                  </div>
                  <div className="border-t-2 border-primary pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">NET PAY</span>
                      <span className="text-xl font-bold text-primary">{formatLKR(calc.netPay)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/salary-history')}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update Record' : 'Save Salary Record'}</Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default SalaryFormPage;
