import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSalaryRecords, getEmployees, getEmployeeByProfileId } from '@/db/api';
import { formatLKR } from '@/lib/salaryCalc';
import { generateSlipPdf } from '@/lib/slipPdf';
import { useAuth } from '@/contexts/AuthContext';
import type { SalaryRecord, Employee } from '@/types/types';
import { Download, Eye, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';

// Dedicated Salary Slips tab: generate and download clean salary slips
const SalarySlipsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterEmp, setFilterEmp] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (profile?.role === 'staff') {
        const emp = await getEmployeeByProfileId(profile.id);
        if (emp) {
          setEmployees([emp]);
          setRecords(await getSalaryRecords(emp.id));
        }
      } else {
        const [recs, emps] = await Promise.all([getSalaryRecords(), getEmployees()]);
        setRecords(recs);
        setEmployees(emps);
      }
      setLoading(false);
    })();
  }, [profile]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const filtered = records.filter(r => {
    const matchEmp = filterEmp === 'all' || r.employee_id === filterEmp;
    const matchSearch = search === '' || r.payroll_month.toLowerCase().includes(search.toLowerCase());
    return matchEmp && matchSearch;
  });

  const handleDownload = async (r: SalaryRecord) => {
    const emp = empMap[r.employee_id];
    if (!emp) { toast.error('Employee record not found'); return; }
    setDownloadingId(r.id);
    try {
      await generateSlipPdf(r, emp);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Salary Slips</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate and download official salary slips</p>
        </div>

        <Card className="border-border shadow-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search month..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {profile?.role !== 'staff' && (
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
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {profile?.role !== 'staff' && <th className="text-left px-6 py-3 font-semibold text-foreground">Employee</th>}
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Month</th>
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Period</th>
                    <th className="text-right px-6 py-3 font-semibold text-foreground">Gross Pay</th>
                    <th className="text-right px-6 py-3 font-semibold text-foreground">Net Pay</th>
                    <th className="text-right px-6 py-3 font-semibold text-foreground">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No salary records found.</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      {profile?.role !== 'staff' && (
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{empMap[r.employee_id]?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{empMap[r.employee_id]?.employee_id}</p>
                        </td>
                      )}
                      <td className="px-6 py-3 font-medium text-foreground">{r.payroll_month}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.payroll_period || '—'}</td>
                      <td className="px-6 py-3 text-right">{formatLKR(r.total_gross_earning)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-primary">{formatLKR(r.net_pay)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View slip" onClick={() => navigate(`/salary/${r.id}/slip`)}>
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="outline" size="sm" className="h-8 text-xs"
                            disabled={downloadingId === r.id}
                            onClick={() => handleDownload(r)}
                          >
                            {downloadingId === r.id ? <FileText size={14} className="mr-1 animate-pulse" /> : <Download size={14} className="mr-1" />}
                            {downloadingId === r.id ? 'Generating...' : 'Download'}
                          </Button>
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

export default SalarySlipsPage;
