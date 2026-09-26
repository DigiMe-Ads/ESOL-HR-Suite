import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createLeaveRequest, getEmployeeByProfileId, getLeaveRequests } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveType, Employee, LeaveRequest } from '@/types/types';
import { validateLeaveRequest, remainingDays, entitlementFor } from '@/lib/leavePolicy';
import { toast } from 'sonner';
import { ArrowLeft, Info } from 'lucide-react';

// Ordered per statutory policy display
const LEAVE_TYPE_ORDER: { value: LeaveType; label: string; note: string }[] = [
  { value: 'annual', label: 'Annual Leave', note: '14 days from Year 3 · must be taken as at least 7 consecutive days' },
  { value: 'casual', label: 'Casual Leave', note: '7 days (Year 1: 1 day per 2 completed months) · lapses at year end' },
  { value: 'sick', label: 'Sick Leave', note: 'Covered by the 7-day casual leave allocation' },
  { value: 'maternity', label: 'Maternity Leave', note: '84 days (14 before + 70 after delivery)' },
  { value: 'paternity', label: 'Paternity Leave', note: '3 days under company policy' },
];

const ApplyLeavePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [form, setForm] = useState({ leave_type: '' as LeaveType | '', start_date: '', end_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const emp = await getEmployeeByProfileId(profile.id);
      if (emp) {
        setEmployee(emp);
        setLeaves(await getLeaveRequests(emp.id));
      }
      setLoading(false);
    })();
  }, [profile]);

  const calcDays = (): number => {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const totalDays = calcDays();

  const balances = useMemo(() => {
    if (!employee) return null;
    const year = new Date().getFullYear();
    return LEAVE_TYPE_ORDER.map(t => ({
      ...t,
      entitlement: entitlementFor(t.value, employee.employment_commencement),
      remaining: remainingDays(t.value, employee.employment_commencement, leaves, year),
    }));
  }, [employee, leaves]);

  const selectedNote = LEAVE_TYPE_ORDER.find(t => t.value === form.leave_type)?.note;

  const validation = useMemo(() => {
    if (!employee || !form.leave_type || totalDays <= 0) return null;
    return validateLeaveRequest({
      type: form.leave_type,
      totalDays,
      commencement: employee.employment_commencement,
      leaves,
    });
  }, [employee, form.leave_type, totalDays, leaves]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type || !form.start_date || !form.end_date) { toast.error('Please fill all required fields'); return; }
    if (totalDays <= 0) { toast.error('End date must be on or after start date'); return; }
    if (!employee) { toast.error('No employee record linked to your account. Contact HR.'); return; }
    const check = validateLeaveRequest({
      type: form.leave_type,
      totalDays,
      commencement: employee.employment_commencement,
      leaves,
    });
    if (!check.ok) { toast.error(check.error); return; }
    setSaving(true);
    const result = await createLeaveRequest({
      employee_id: employee.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      total_days: totalDays,
      reason: form.reason,
    });
    setSaving(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Leave request submitted successfully');
    navigate('/my-leaves');
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/my-leaves')}><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Apply for Leave</h1>
            <p className="text-sm text-muted-foreground">Submit a new leave request</p>
          </div>
        </div>

        {balances && (
          <Card className="border-border shadow-card">
            <CardContent className="pt-5">
              <p className="section-label mb-3">Your Entitlement Balances (This Year)</p>
              <div className="space-y-2">
                {balances.map(b => (
                  <div key={b.value} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 py-1.5 border-b border-border last:border-0">
                    <div className="md:w-40 shrink-0">
                      <p className="text-sm font-medium text-foreground">{b.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1 min-w-0">{b.note}</p>
                    <p className={`text-sm font-semibold shrink-0 ${b.remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {b.remaining} / {b.entitlement} day{b.entitlement === 1 ? '' : 's'} left
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="border-border shadow-card">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Leave Type <span className="text-destructive">*</span></Label>
                <Select value={form.leave_type} onValueChange={v => setForm(f => ({ ...f, leave_type: v as LeaveType }))} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Select leave type..." /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_ORDER.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedNote && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                    <Info size={13} className="shrink-0 mt-0.5 text-accent" /> {selectedNote}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              {totalDays > 0 && (
                <div className={`rounded-md px-4 py-2.5 flex items-center gap-2 ${validation && !validation.ok ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                  <span className={`text-sm font-medium ${validation && !validation.ok ? 'text-destructive' : 'text-primary'}`}>Total Days: {totalDays}</span>
                  {validation && !validation.ok && (
                    <span className="text-xs text-destructive">{validation.error}</span>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Textarea placeholder="Briefly describe the reason for your leave..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/my-leaves')}>Cancel</Button>
            <Button type="submit" disabled={saving || (validation ? !validation.ok : false)}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default ApplyLeavePage;
