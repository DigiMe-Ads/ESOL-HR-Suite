import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEmployee, getSalaryRecords, getLeaveRequests, setEmploymentStatus, getEmployeeFileUrls, missingProfileFields } from '@/db/api';
import { EmployeeAvatar } from '@/components/employees/EmployeePhoto';
import EmployeeDocuments from '@/components/employees/EmployeeDocuments';
import RemoveEmployeeDialog from '@/components/employees/RemoveEmployeeDialog';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee, SalaryRecord, LeaveRequest } from '@/types/types';
import { ArrowLeft, Pencil, FileText, CalendarCheck, UserMinus, UserCheck, Trash2, AlertCircle } from 'lucide-react';
import { formatLKR } from '@/lib/salaryCalc';

const statusColor: Record<string, string> = {
  pending: 'pill pill-warning',
  approved: 'pill pill-success',
  rejected: 'pill pill-danger',
};

const EmployeeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const canEdit = hasRoutePermission(routeConfigs.find(r => r.path === '/employees/new')!, profile);
  const isAdmin = profile?.role === 'admin';

  const toggleResignation = async () => {
    if (!employee) return;
    setStatusBusy(true);
    const res = await setEmploymentStatus(employee, employee.employment_status === 'resigned' ? 'active' : 'resigned');
    setStatusBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(employee.employment_status === 'resigned' ? 'Employee reactivated' : 'Employee marked as resigned');
    setEmployee(await getEmployee(employee.id));
  };

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [emp, sals, lvs] = await Promise.all([
        getEmployee(id),
        getSalaryRecords(id),
        getLeaveRequests(id),
      ]);
      setEmployee(emp);
      if (emp?.photo_path) {
        const urls = await getEmployeeFileUrls([emp.photo_path]);
        setPhotoUrl(urls[emp.photo_path] ?? null);
      }
      setSalaries(sals);
      setLeaves(lvs);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppLayout><div className="p-8"><div className="h-48 bg-muted animate-pulse rounded-lg" /></div></AppLayout>;
  if (!employee) return <AppLayout><div className="p-8 text-muted-foreground">Employee not found.</div></AppLayout>;

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col md:flex-row md:items-center py-2.5 border-b border-border last:border-0">
      <span className="section-label md:w-48 shrink-0">{label}</span>
      <span className="text-sm text-foreground mt-0.5 md:mt-0">{value}</span>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}><ArrowLeft size={18} /></Button>
            <EmployeeAvatar url={photoUrl} name={employee.full_name} className="h-14 w-14 text-base" />
            <div>
              <h1 className="text-xl font-semibold text-foreground flex items-center gap-2 flex-wrap">
                {employee.full_name}
                <span className={`${
                  employee.employment_status === 'resigned' ? 'pill pill-danger' : 'pill pill-success'
                }`}>{employee.employment_status}</span>
              </h1>
              <p className="text-sm text-muted-foreground">{employee.employee_id} · {employee.designation}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(`/employees/${id}/edit`)}>
                <Pencil size={15} className="mr-1.5" /> Edit
              </Button>
            )}
            <Button onClick={() => navigate(`/salary/new?employeeId=${id}`)}>
              <FileText size={15} className="mr-1.5" /> Add Salary
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={toggleResignation} disabled={statusBusy}>
                {employee.employment_status === 'resigned' ? <UserCheck size={15} className="mr-1.5" /> : <UserMinus size={15} className="mr-1.5" />}
                {statusBusy ? 'Processing...' : employee.employment_status === 'resigned' ? 'Reactivate' : 'Mark Resigned'}
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setRemoving(true)}>
                <Trash2 size={15} className="mr-1.5" /> Remove
              </Button>
            )}
          </div>
        </div>

        {missingProfileFields(employee).length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>
              Missing details: <strong>{missingProfileFields(employee).join(', ')}</strong>.
              {employee.profile_id ? ' The employee can complete these under My Profile.' : ' Link a portal login so the employee can complete them.'}
            </p>
          </div>
        )}

        {/* Employee Info */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3"><CardTitle className="text-base">Employee Information</CardTitle></CardHeader>
          <CardContent>
            <InfoRow label="Employee ID" value={employee.employee_id} />
            <InfoRow label="Full Name" value={employee.full_name} />
            <InfoRow label="First Name" value={employee.first_name ?? '—'} />
            <InfoRow label="Last Name" value={employee.last_name ?? '—'} />
            <InfoRow label="NIC Number" value={employee.nic_number || '—'} />
            <InfoRow label="Email Address" value={employee.email ?? '—'} />
            <InfoRow label="Phone Number" value={employee.phone ?? '—'} />
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow label="Employment Start" value={employee.employment_commencement} />
            <InfoRow label="Bank" value={employee.bank || '—'} />
            <InfoRow label="Bank Branch" value={employee.bank_branch || '—'} />
            <InfoRow label="Account Number" value={employee.bank_account_number || '—'} />
            <InfoRow label="Portal Login" value={employee.profile_id ? 'Linked' : 'Not linked'} />
            <InfoRow label="Employment Status" value={employee.employment_status === 'resigned' ? `Resigned${employee.resigned_at ? ` (${new Date(employee.resigned_at).toLocaleDateString('en-LK')})` : ''}` : 'Active'} />
          </CardContent>
        </Card>

        <EmployeeDocuments employeeId={employee.id} canEdit={canEdit} description="Educational certificates, service letters and other documents uploaded by the employee or HR." />

        {/* Salary History */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Salary History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Month</th>
                    <th className="text-left px-6 py-3">Period</th>
                    <th className="text-right px-6 py-3">Gross</th>
                    <th className="text-right px-6 py-3">Net Pay</th>
                    <th className="text-right px-6 py-3">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No salary records found.</td></tr>
                  ) : salaries.map(s => (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/40">
                      <td className="px-6 py-3 font-medium">{s.payroll_month}</td>
                      <td className="px-6 py-3 text-muted-foreground">{s.payroll_period}</td>
                      <td className="px-6 py-3 text-right">{formatLKR(s.total_gross_earning)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-primary">{formatLKR(s.net_pay)}</td>
                      <td className="px-6 py-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/salary/${s.id}/slip`)}>
                          View Slip
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Leave History */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck size={16} className="text-primary" /> Leave History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Dates</th>
                    <th className="text-left px-6 py-3">Days</th>
                    <th className="text-left px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No leave records.</td></tr>
                  ) : leaves.map(l => (
                    <tr key={l.id} className="border-b border-border hover:bg-muted/40">
                      <td className="px-6 py-3 capitalize">{l.leave_type} Leave</td>
                      <td className="px-6 py-3 text-muted-foreground">{l.start_date} to {l.end_date}</td>
                      <td className="px-6 py-3">{l.total_days}</td>
                      <td className="px-6 py-3">
                        <span className={`${statusColor[l.status]}`}>{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <RemoveEmployeeDialog
        employee={removing ? employee : null}
        onClose={() => setRemoving(false)}
        onRemoved={() => navigate('/employees', { replace: true })}
      />
    </AppLayout>
  );
};

export default EmployeeDetailPage;
