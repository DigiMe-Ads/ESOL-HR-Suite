import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getEmployees } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee } from '@/types/types';
import { Plus, Search, Pencil, Eye } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteEmployee, setEmploymentStatus } from '@/db/api';
import { UserMinus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'active' | 'resigned';

const EmployeeListPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [confirmResign, setConfirmResign] = useState<Employee | null>(null);
  const [resignBusy, setResignBusy] = useState(false);

  const load = async (q?: string) => {
    setLoading(true);
    setEmployees(await getEmployees(q || undefined));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => statusFilter === 'all' || e.employment_status === statusFilter);

  const handleDelete = async (id: string) => {
    await deleteEmployee(id);
    toast.success('Employee deleted');
    load(search);
  };

  const handleResignToggle = async () => {
    if (!confirmResign) return;
    setResignBusy(true);
    const target = confirmResign;
    const res = target.employment_status === 'resigned'
      ? await setEmploymentStatus(target, 'active')
      : await setEmploymentStatus(target, 'resigned');
    setResignBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(target.employment_status === 'resigned' ? 'Employee reactivated' : 'Employee marked as resigned');
    setConfirmResign(null);
    load(search);
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">Employees</h1>
            <p className="page-subtitle">Manage all employee records</p>
          </div>
          <Button onClick={() => navigate('/employees/new')} className="shrink-0">
            <Plus size={16} className="mr-1.5" /> Add Employee
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={e => { setSearch(e.target.value); setTimeout(() => load(e.target.value), 400); }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 shrink-0">
              {(['all', 'active', 'resigned'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    statusFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Employee ID</th>
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Designation</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-left px-6 py-3">Commenced</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No employees found.</td></tr>
                  ) : filtered.map(emp => (
                    <tr key={emp.id} className={`border-b border-border hover:bg-muted/40 transition-colors ${emp.employment_status === 'resigned' ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-3 font-mono text-xs text-foreground">{emp.employee_id}</td>
                      <td className="px-6 py-3 font-medium text-foreground">{emp.full_name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{emp.designation}</td>
                      <td className="px-6 py-3">
                        <span className={`${
                          emp.employment_status === 'resigned'
                            ? 'pill pill-danger'
                            : 'pill pill-success'
                        }`}>
                          {emp.employment_status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{emp.employment_commencement}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/employees/${emp.id}`)}>
                            <Eye size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/employees/${emp.id}/edit`)}>
                            <Pencil size={15} />
                          </Button>
                          {(profile?.role === 'admin' || profile?.role === 'hr_admin') && (
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title={emp.employment_status === 'resigned' ? 'Reactivate employee' : 'Mark as resigned'}
                              onClick={() => setConfirmResign(emp)}
                            >
                              {emp.employment_status === 'resigned' ? <UserCheck size={15} /> : <UserMinus size={15} />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resign / Reactivate confirmation */}
      <AlertDialog open={confirmResign !== null} onOpenChange={open => { if (!open) setConfirmResign(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmResign?.employment_status === 'resigned' ? 'Reactivate Employee' : 'Mark as Resigned'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmResign?.employment_status === 'resigned' ? (
                <>This will reactivate <strong>{confirmResign?.full_name}</strong> and restore their platform login access.</>
              ) : (
                <>This will mark <strong>{confirmResign?.full_name}</strong> as resigned. Their platform login will be disabled, but salary and leave records are retained for statutory purposes.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResignToggle} disabled={resignBusy}>
              {resignBusy ? 'Processing...' : confirmResign?.employment_status === 'resigned' ? 'Reactivate' : 'Mark as Resigned'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default EmployeeListPage;
