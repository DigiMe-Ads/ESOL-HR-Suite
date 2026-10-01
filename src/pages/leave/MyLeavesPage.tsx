import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLeaveRequests, getEmployeeByProfileId, withdrawLeaveRequest, getLeaveTypeConfigs } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveRequest, Employee, LeaveType } from '@/types/types';
import { remainingDays, entitlementFor, policyFromConfig, DEFAULT_POLICY } from '@/lib/leavePolicy';
import type { LeavePolicy } from '@/lib/leavePolicy';
import { Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColor: Record<string, string> = {
  pending: 'pill pill-warning',
  approved: 'pill pill-success',
  rejected: 'pill pill-danger',
};

const BALANCE_ROWS: { type: LeaveType; label: string; note: string }[] = [
  { type: 'annual', label: 'Annual Leave', note: 'Year 1: none · Year 2: pro-rated · Year 3+: 14 days (min. 7 consecutive)' },
  { type: 'casual', label: 'Casual Leave', note: '7 days (Year 1: 1 day per 2 completed months) · lapses at year end' },
  { type: 'sick', label: 'Sick Leave', note: 'Shares the casual leave balance above — not an extra allocation' },
  { type: 'maternity', label: 'Maternity Leave', note: '84 days per confinement' },
  { type: 'paternity', label: 'Paternity Leave', note: '3 days under company policy' },
  { type: 'other', label: 'Other Leave', note: 'Special leave at HR discretion' },
];

const MyLeavesPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<LeavePolicy>(DEFAULT_POLICY);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const [emp, configs] = await Promise.all([getEmployeeByProfileId(profile.id), getLeaveTypeConfigs()]);
      if (configs.length) setPolicy(policyFromConfig(configs));
      if (emp) {
        setEmployee(emp);
        setLeaves(await getLeaveRequests(emp.id));
      }
      setLoading(false);
    })();
  }, [profile]);

  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const handleWithdraw = async (l: LeaveRequest) => {
    setWithdrawingId(l.id);
    const { error } = await withdrawLeaveRequest(l.id);
    setWithdrawingId(null);
    if (error) { toast.error(error); return; }
    toast.success('Leave request withdrawn');
    setLeaves(prev => prev.filter(x => x.id !== l.id));
  };

  const filtered = leaves.filter(l => filterStatus === 'all' || l.status === filterStatus);

  const balances = useMemo(() => {
    if (!employee) return null;
    const year = new Date().getFullYear();
    return BALANCE_ROWS.filter(r => !policy.inactive.includes(r.type)).map(r => ({
      ...r,
      entitlement: entitlementFor(r.type, employee.employment_commencement, new Date(), policy),
      remaining: remainingDays(r.type, employee.employment_commencement, leaves, year, policy),
    }));
  }, [employee, leaves, policy]);

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">My Leaves</h1>
            <p className="page-subtitle">Your leave applications and history</p>
          </div>
          <Button onClick={() => navigate('/my-leaves/apply')} className="shrink-0">
            <Plus size={16} className="mr-1.5" /> Apply Leave
          </Button>
        </div>

        {balances && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3"><p className="section-label">Leave Entitlements — {new Date().getFullYear()}</p></CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {balances.map(b => (
                  <div key={b.type} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 py-1.5 border-b border-border last:border-0">
                    <p className="text-sm font-medium text-foreground md:w-36 shrink-0">{b.label}</p>
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

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Start Date</th>
                    <th className="text-left px-6 py-3">End Date</th>
                    <th className="text-right px-6 py-3">Days</th>
                    <th className="text-left px-6 py-3">Reason</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Comment</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(8)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No leave requests found.</td></tr>
                  ) : filtered.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-3 capitalize">{l.leave_type} Leave</td>
                      <td className="px-6 py-3 text-muted-foreground">{l.start_date}</td>
                      <td className="px-6 py-3 text-muted-foreground">{l.end_date}</td>
                      <td className="px-6 py-3 text-right">{l.total_days}</td>
                      <td className="px-6 py-3 text-muted-foreground max-w-[160px] truncate">{l.reason ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`${statusColor[l.status]}`}>{l.status}</span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground max-w-[160px] truncate">{l.review_comment ?? '—'}</td>
                      <td className="px-6 py-3 text-right">
                        {l.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs" disabled={withdrawingId === l.id} onClick={() => handleWithdraw(l)}>
                            <Undo2 size={14} /> {withdrawingId === l.id ? 'Withdrawing…' : 'Withdraw'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MyLeavesPage;
