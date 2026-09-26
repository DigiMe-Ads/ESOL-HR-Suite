import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDashboardStats, getEmployees, getSalaryRecords, getLeaveRequests, getEmployeeByProfileId } from '@/db/api';
import { formatLKR } from '@/lib/salaryCalc';
import { Users, FileText, Clock, DollarSign, ChevronRight, TrendingUp, UserMinus } from 'lucide-react';

interface Stats { totalEmployees: number; activeEmployees: number; resignedEmployees: number; pendingLeaves: number; totalSalaryRecords: number; }

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalEmployees: 0, activeEmployees: 0, resignedEmployees: 0, pendingLeaves: 0, totalSalaryRecords: 0 });
  const [recentPayrolls, setRecentPayrolls] = useState<Array<{ id: string; payroll_month: string; net_pay: number; employee_id: string }>>([]);
  const [recentLeaves, setRecentLeaves] = useState<Array<{ id: string; leave_type: string; start_date: string; status: string; total_days: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (profile?.role === 'admin' || profile?.role === 'hr_admin' || profile?.role === 'manager') {
          const [s, salaries, leaves] = await Promise.all([
            getDashboardStats(),
            getSalaryRecords(),
            getLeaveRequests(undefined, 'pending'),
          ]);
          setStats(s);
          setRecentPayrolls(salaries.slice(0, 5).map(r => ({ id: r.id, payroll_month: r.payroll_month, net_pay: r.net_pay, employee_id: r.employee_id })));
          setRecentLeaves(leaves.slice(0, 5).map(r => ({ id: r.id, leave_type: r.leave_type, start_date: r.start_date, status: r.status, total_days: r.total_days })));
        } else {
          // Staff: own data
          const emp = await getEmployeeByProfileId(profile!.id);
          if (emp) {
            const [salaries, leaves] = await Promise.all([
              getSalaryRecords(emp.id),
              getLeaveRequests(emp.id),
            ]);
            setStats({ totalEmployees: 0, activeEmployees: 0, resignedEmployees: 0, pendingLeaves: leaves.filter(l => l.status === 'pending').length, totalSalaryRecords: salaries.length });
            setRecentPayrolls(salaries.slice(0, 3).map(r => ({ id: r.id, payroll_month: r.payroll_month, net_pay: r.net_pay, employee_id: r.employee_id })));
            setRecentLeaves(leaves.slice(0, 5).map(r => ({ id: r.id, leave_type: r.leave_type, start_date: r.start_date, status: r.status, total_days: r.total_days })));
          }
        }
      } finally { setLoading(false); }
    })();
  }, [profile]);

  const role = profile?.role ?? 'staff';

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  if (loading) return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground text-balance">
            Welcome back, {profile?.full_name?.split(' ')[0] ?? 'User'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {role !== 'staff' && (
            <>
              <Card className="border-border shadow-card">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users size={22} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="section-label">Active Employees</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.activeEmployees}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-card">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <UserMinus size={22} className="text-red-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="section-label">Resigned</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.resignedEmployees}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          <Card className="border-border shadow-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                <Clock size={22} className="text-yellow-700" />
              </div>
              <div className="min-w-0">
                <p className="section-label">Pending Leaves</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.pendingLeaves}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <TrendingUp size={22} className="text-green-700" />
              </div>
              <div className="min-w-0">
                <p className="section-label">Salary Records</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.totalSalaryRecords}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Payrolls */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign size={16} className="text-primary" /> Recent Payroll
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-primary text-xs h-7" onClick={() => navigate('/salary-history')}>
                View All <ChevronRight size={14} />
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              {recentPayrolls.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6">No payroll records yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentPayrolls.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.payroll_month}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">{formatLKR(p.net_pay)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leave Requests */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-primary" /> {role === 'staff' ? 'My Leaves' : 'Leave Requests'}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-primary text-xs h-7"
                onClick={() => navigate(role === 'staff' ? '/my-leaves' : '/leave-requests')}>
                View All <ChevronRight size={14} />
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              {recentLeaves.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6">No leave requests.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentLeaves.map(l => (
                    <div key={l.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{l.leave_type} Leave</p>
                        <p className="text-xs text-muted-foreground">{l.start_date} · {l.total_days} day(s)</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[l.status]}`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {(role === 'admin' || role === 'hr_admin') && (
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/employees/new')}>Add Employee</Button>
              <Button variant="secondary" onClick={() => navigate('/salary/new')}>Add Salary Entry</Button>
              {role === 'admin' && <Button variant="secondary" onClick={() => navigate('/users')}>Manage Users</Button>}
              <Button variant="secondary" onClick={() => navigate('/leave-requests')}>Review Leaves</Button>
              <Button variant="secondary" onClick={() => navigate('/salary-slips')}>Salary Slips</Button>
            </CardContent>
          </Card>
        )}
        {role === 'staff' && (
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/my-leaves/apply')}>Apply for Leave</Button>
              <Button variant="secondary" onClick={() => navigate('/salary-history')}>View My Salary</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
