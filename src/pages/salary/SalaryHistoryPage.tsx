import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSalaryRecords, getEmployeeDirectory, deleteSalaryRecord, getEmployeeByProfileId } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import { formatLKR } from '@/lib/salaryCalc';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import type { SalaryRecord, Employee } from '@/types/types';
import { Plus, Pencil, Trash2, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SalaryHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [filterEmp, setFilterEmp] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const canManageAll = hasRoutePermission(routeConfigs.find(r => r.path === '/salary/new')!, profile);

  const load = async () => {
    setLoading(true);
    if (!canManageAll) {
      const emp = profile ? await getEmployeeByProfileId(profile.id) : null;
      if (emp) {
        const recs = await getSalaryRecords(emp.id);
        setRecords(recs);
      }
    } else {
      const [recs, emps] = await Promise.all([getSalaryRecords(), getEmployeeDirectory()]);
      setRecords(recs);
      setEmployees(emps);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const filtered = records.filter(r => {
    const matchEmp = filterEmp === 'all' || r.employee_id === filterEmp;
    const matchSearch = search === '' || r.payroll_month.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteSalaryRecord(id);
    if (error) { toast.error(error); return; }
    toast.success('Record deleted');
    load();
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">Salary History</h1>
            <p className="page-subtitle">All payroll records</p>
          </div>
          {hasRoutePermission(routeConfigs.find(r => r.path === '/salary/new')!, profile) && (
            <Button onClick={() => navigate('/salary/new')} className="shrink-0">
              <Plus size={16} className="mr-1" /> Add Salary Entry
            </Button>
          )}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search month..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {canManageAll && (
                <Select value={filterEmp} onValueChange={setFilterEmp}>
                  <SelectTrigger className="w-52 shrink-0"><SelectValue placeholder="All employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.employee_id} — {e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    {canManageAll && <th className="text-left px-6 py-3">Employee</th>}
                    <th className="text-left px-6 py-3">Month</th>
                    <th className="text-left px-6 py-3">Period</th>
                    <th className="text-right px-6 py-3">Days</th>
                    <th className="text-right px-6 py-3">Gross</th>
                    <th className="text-right px-6 py-3">Net Pay</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No salary records found.</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      {canManageAll && (
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{empMap[r.employee_id]?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{empMap[r.employee_id]?.employee_id}</p>
                        </td>
                      )}
                      <td className="px-6 py-3 font-medium text-foreground">{r.payroll_month}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.payroll_period}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{r.total_days_entitled}</td>
                      <td className="px-6 py-3 text-right">{formatLKR(r.total_gross_earning)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-primary">{formatLKR(r.net_pay)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/salary/${r.id}/slip`)}>
                            <FileText size={15} />
                          </Button>
                          {hasRoutePermission(routeConfigs.find(r => r.path === '/salary/:id/edit')!, profile) && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/salary/${r.id}/edit`)}>
                                <Pencil size={15} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 size={15} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Salary Record</AlertDialogTitle>
                                    <AlertDialogDescription>Delete payroll record for {r.payroll_month}? This cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
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
    </AppLayout>
  );
};

export default SalaryHistoryPage;
