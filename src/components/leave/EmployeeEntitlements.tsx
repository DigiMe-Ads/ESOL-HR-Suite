import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getEmployees, getLeaveGrants, getLeaveRequests, setLeaveGrant } from '@/db/api';
import type { Employee, GrantedLeaveType, LeaveRequest } from '@/types/types';
import { entitlementFor, remainingDays, serviceYearLabel } from '@/lib/leavePolicy';
import type { LeavePolicy } from '@/lib/leavePolicy';

/**
 * Per-employee leave: annual/casual are calculated from each employee's joining date;
 * maternity/paternity are switched on only for the employees HR selects.
 */
const EmployeeEntitlements: React.FC<{ policy: LeavePolicy }> = ({ policy }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [emps, lvs, gr] = await Promise.all([getEmployees(), getLeaveRequests(undefined, 'approved'), getLeaveGrants()]);
      setEmployees(emps.filter(e => e.employment_status === 'active').sort((a, b) => a.employee_id.localeCompare(b.employee_id)));
      setLeaves(lvs);
      setGrants(new Set(gr.map(g => `${g.employee_id}:${g.leave_type}`)));
      setLoading(false);
    })();
  }, []);

  const year = new Date().getFullYear();
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter(e => !q || e.full_name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q))
      .map(e => {
        const own = leaves.filter(l => l.employee_id === e.id);
        return {
          emp: e,
          service: serviceYearLabel(e.employment_commencement),
          annual: { left: remainingDays('annual', e.employment_commencement, own, year, policy), of: entitlementFor('annual', e.employment_commencement, new Date(), policy) },
          casual: { left: remainingDays('casual', e.employment_commencement, own, year, policy), of: entitlementFor('casual', e.employment_commencement, new Date(), policy) },
        };
      });
  }, [employees, leaves, search, policy, year]);

  const toggle = async (emp: Employee, type: GrantedLeaveType, on: boolean) => {
    const key = `${emp.id}:${type}`;
    setBusyKey(key);
    setGrants(prev => { const next = new Set(prev); if (on) next.add(key); else next.delete(key); return next; });
    const { error } = await setLeaveGrant(emp.id, type, on);
    setBusyKey(null);
    if (error) {
      setGrants(prev => { const next = new Set(prev); if (on) next.delete(key); else next.add(key); return next; });
      toast.error(error);
      return;
    }
    toast.success(`${type === 'maternity' ? 'Maternity' : 'Paternity'} leave ${on ? 'enabled' : 'disabled'} for ${emp.full_name}`);
  };

  const cell = (v: { left: number; of: number }) => (
    <span className={v.of === 0 ? 'text-muted-foreground' : 'text-foreground'}>
      <span className="font-semibold">{v.left}</span> / {v.of}
    </span>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 space-y-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Users size={16} className="text-primary" /> Employee entitlements</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Annual and casual leave are calculated automatically from each employee's joining date (days left / entitled this year).
            Maternity and paternity leave can only be applied for by the employees you switch on here.
          </p>
        </div>
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="text-left px-5 py-3">Employee</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-left px-5 py-3">Service</th>
                <th className="text-right px-5 py-3">Annual</th>
                <th className="text-right px-5 py-3">Casual</th>
                <th className="text-center px-5 py-3">Maternity</th>
                <th className="text-center px-5 py-3">Paternity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>)}</tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No active employees found.</td></tr>
              ) : rows.map(({ emp, service, annual, casual }) => (
                <tr key={emp.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{emp.full_name}</p>
                    <p className="text-xs text-muted-foreground">{emp.employee_id} · {emp.designation}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{emp.employment_commencement}</td>
                  <td className="px-5 py-3 text-muted-foreground">{service}</td>
                  <td className="px-5 py-3 text-right">{cell(annual)}</td>
                  <td className="px-5 py-3 text-right">{cell(casual)}</td>
                  {(['maternity', 'paternity'] as GrantedLeaveType[]).map(type => {
                    const key = `${emp.id}:${type}`;
                    return (
                      <td key={type} className="px-5 py-3 text-center">
                        <Switch
                          aria-label={`${type} leave for ${emp.full_name}`}
                          checked={grants.has(key)}
                          disabled={busyKey === key}
                          onCheckedChange={on => toggle(emp, type, on)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
          Annual: Year 1 — none; Year 2 — pro-rated by joining quarter; Year 3+ — full entitlement. Casual: Year 1 — 1 day per 2 completed months; Year 2+ — full entitlement.
        </p>
      </CardContent>
    </Card>
  );
};

export default EmployeeEntitlements;
