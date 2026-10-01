import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDashboardStats, getSalaryRecords, getLeaveRequests, getEmployeeByProfileId, missingProfileFields } from '@/db/api';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import { formatLKR } from '@/lib/salaryCalc';
import {
  Users, FileText, Clock, DollarSign, ChevronRight, TrendingUp, UserMinus, UserPlus, Wallet,
  CalendarCheck, CalendarDays, CalendarPlus, Receipt, UserCog, Inbox, UserRound,
} from 'lucide-react';

interface Stats { totalEmployees: number; activeEmployees: number; resignedEmployees: number; pendingLeaves: number; totalSalaryRecords: number; }

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalEmployees: 0, activeEmployees: 0, resignedEmployees: 0, pendingLeaves: 0, totalSalaryRecords: 0 });
  const [recentPayrolls, setRecentPayrolls] = useState<Array<{ id: string; payroll_month: string; net_pay: number; employee_id: string }>>([]);
  const [recentLeaves, setRecentLeaves] = useState<Array<{ id: string; leave_type: string; start_date: string; status: string; total_days: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [missingDetails, setMissingDetails] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Counts and lists are scoped by row-level security: reviewers/managers see everyone,
        // staff see their own records — so the same queries work for every role.
        const canSee = (path: string) => hasRoutePermission(routeConfigs.find(r => r.path === path)!, profile);
        const seeSalaries = canSee('/salary-slips') || canSee('/salary-history');
        const seeAllLeaves = canSee('/leave-requests');
        const seeOwnLeaves = canSee('/my-leaves');
        const [s, salaries, leaves] = await Promise.all([
          getDashboardStats(),
          seeSalaries ? getSalaryRecords() : Promise.resolve([]),
          seeAllLeaves ? getLeaveRequests(undefined, 'pending') : seeOwnLeaves ? getLeaveRequests() : Promise.resolve([]),
        ]);
        setStats(s);
        const ownRecord = profile ? await getEmployeeByProfileId(profile.id) : null;
        setMissingDetails(ownRecord ? missingProfileFields(ownRecord) : []);
        setRecentPayrolls(salaries.slice(0, 5).map(r => ({ id: r.id, payroll_month: r.payroll_month, net_pay: r.net_pay, employee_id: r.employee_id })));
        setRecentLeaves(leaves.slice(0, 5).map(r => ({ id: r.id, leave_type: r.leave_type, start_date: r.start_date, status: r.status, total_days: r.total_days })));
      } finally { setLoading(false); }
    })();
  }, [profile]);

  const can = (path: string) => hasRoutePermission(routeConfigs.find(r => r.path === path)!, profile);
  const isReviewer = can('/leave-requests');
  const isSelfViewer = !isReviewer && can('/my-leaves');

  const statusPill: Record<string, string> = {
    pending: 'pill-warning',
    approved: 'pill-success',
    rejected: 'pill-danger',
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards: Array<{ show: boolean; label: string; value: number; icon: React.ElementType; tone: string; hint: string }> = [
    { show: can('/employees'), label: 'Active Employees', value: stats.activeEmployees, icon: Users, tone: 'from-primary to-brand-globe', hint: 'Currently on payroll' },
    { show: can('/employees'), label: 'Resigned', value: stats.resignedEmployees, icon: UserMinus, tone: 'from-rose-500 to-pink-500', hint: 'Records retained' },
    { show: isReviewer || isSelfViewer, label: 'Pending Leaves', value: stats.pendingLeaves, icon: Clock, tone: 'from-amber-500 to-orange-500', hint: isReviewer ? 'Awaiting review' : 'Your requests awaiting review' },
    { show: can('/salary-slips') || can('/salary-history'), label: 'Salary Records', value: stats.totalSalaryRecords, icon: TrendingUp, tone: 'from-brand-globe to-sky-400', hint: 'Payroll entries' },
  ];

  const isManagerView = isReviewer || can('/employees/new') || can('/salary/new');
  const quickActions: Array<{ show: boolean; label: string; desc: string; path: string; icon: React.ElementType }> = isManagerView ? [
    { show: can('/employees/new'), label: 'Add employee', desc: 'Onboard a new team member', path: '/employees/new', icon: UserPlus },
    { show: can('/salary/new'), label: 'Add salary entry', desc: 'Record a monthly payroll', path: '/salary/new', icon: Wallet },
    { show: isReviewer, label: 'Review leaves', desc: 'Approve or reject requests', path: '/leave-requests', icon: CalendarCheck },
    { show: can('/salary-slips'), label: 'Salary slips', desc: 'Download payslips', path: '/salary-slips', icon: Receipt },
    { show: can('/users'), label: 'Manage users', desc: 'Access & permissions', path: '/users', icon: UserCog },
  ] : [
    { show: can('/my-leaves/apply'), label: 'Apply for leave', desc: 'Submit a new request', path: '/my-leaves/apply', icon: CalendarPlus },
    { show: can('/salary-slips'), label: 'My salary slips', desc: 'View and download payslips', path: '/salary-slips', icon: Receipt },
    { show: can('/salary-history'), label: 'Salary history', desc: 'Past payroll records', path: '/salary-history', icon: FileText },
  ];
  const visibleActions = quickActions.filter(a => a.show);
  const primaryAction = visibleActions[0];

  if (loading) return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="h-36 rounded-3xl bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-sidebar text-white p-6 md:p-8">
          <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-brand-globe/45 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-primary/60 blur-3xl" />
          <div className="orbit-ring -top-24 -right-16 h-72 w-72 rotate-[25deg]" />
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-sm text-white/60">
                {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-balance">
                {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
              </h1>
              <p className="mt-2 text-sm text-white/65 max-w-lg">Here's what's happening across your HR workspace today.</p>
            </div>
            {primaryAction && (
              <Button onClick={() => navigate(primaryAction.path)} className="bg-white text-primary hover:bg-white/90 shadow-lg shrink-0 self-start md:self-auto">
                <primaryAction.icon size={16} /> {primaryAction.label}
              </Button>
            )}
          </div>
        </div>

        {missingDetails.length > 0 && (
          <button type="button" onClick={() => navigate('/my-profile')}
            className="w-full flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-50 p-4 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200">
            <UserRound size={18} className="shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="font-medium">Complete your profile</span>
              <span className="block">Missing: {missingDetails.join(', ')}. You can also upload your certificates and service letters.</span>
            </span>
            <ChevronRight size={16} className="shrink-0" />
          </button>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.filter(c => c.show).map(({ label, value, icon: Icon, tone, hint }) => (
            <Card key={label} className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="section-label pt-1">{label}</p>
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-lg shrink-0`}>
                    <Icon size={18} className="text-white" />
                  </div>
                </div>
                <p className="font-display text-3xl font-bold text-foreground -mt-1 tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{hint}</p>
              </CardContent>
              <div className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${tone} opacity-0 group-hover:opacity-100 transition-opacity`} />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payrolls */}
          {(can('/salary-slips') || can('/salary-history') || can('/salary/new')) && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center"><DollarSign size={16} className="text-primary" /></span>
                Recent Payroll
              </CardTitle>
              {can('/salary-history') && (
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/salary-history')}>
                  View all <ChevronRight size={14} />
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {recentPayrolls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox size={28} className="text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No payroll records yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentPayrolls.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Receipt size={16} /></span>
                        <p className="text-sm font-medium text-foreground truncate">{p.payroll_month}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground tabular-nums">{formatLKR(p.net_pay)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Recent Leave Requests */}
          {(isReviewer || isSelfViewer) && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center"><FileText size={16} className="text-primary" /></span>
                {isReviewer ? 'Pending Leave Requests' : 'My Leaves'}
              </CardTitle>
              {(isReviewer || can('/my-leaves')) && (
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate(isReviewer ? '/leave-requests' : '/my-leaves')}>
                  View all <ChevronRight size={14} />
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {recentLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox size={28} className="text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No leave requests.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentLeaves.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-9 w-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><CalendarDays size={16} /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground capitalize">{l.leave_type} leave</p>
                          <p className="text-xs text-muted-foreground">{l.start_date} · {l.total_days} day(s)</p>
                        </div>
                      </div>
                      <span className={`pill ${statusPill[l.status] ?? 'pill-info'}`}>{l.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        {/* Quick Actions */}
        {visibleActions.length > 0 && (
          <div>
            <p className="section-label mb-3">Quick actions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {visibleActions.map(({ label, desc, path, icon: Icon }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-hover"
                >
                  <span className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary">
                    <Icon size={18} className="text-primary transition-colors group-hover:text-white" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground truncate">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
