import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSalaryRecords, getEmployeeDirectory, getEmployeeByProfileId, getEmployeeForSlip, getSlipRequests, requestSalarySlip, cancelSlipRequest } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import { formatLKR } from '@/lib/salaryCalc';
import { generateSlipPdf } from '@/lib/slipPdf';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import type { SalaryRecord, Employee, SalarySlipRequest } from '@/types/types';
import { SLIP_REQUEST_LABELS } from '@/types/types';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Eye, Search, FileText, Send, X } from 'lucide-react';
import { toast } from 'sonner';

// Dedicated Salary Slips tab: generate and download clean salary slips
const SalarySlipsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [filterEmp, setFilterEmp] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<SalarySlipRequest[]>([]);
  const [requestFor, setRequestFor] = useState<SalaryRecord | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  const canViewAll = hasRoutePermission(routeConfigs.find(r => r.path === '/salary/new')!, profile);

  useEffect(() => {
    (async () => {
      if (!canViewAll) {
        const emp = profile ? await getEmployeeByProfileId(profile.id) : null;
        if (emp) {
          setEmployees([emp]);
          const [recs, reqs] = await Promise.all([getSalaryRecords(emp.id), getSlipRequests(emp.id)]);
          setRecords(recs);
          setRequests(reqs);
        }
      } else {
        const [recs, emps] = await Promise.all([getSalaryRecords(), getEmployeeDirectory()]);
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

  // Latest request per payslip (employees ask HR for a printed slip instead of downloading)
  const latestRequest = (recordId: string) => requests.find(q => q.salary_record_id === recordId);
  const reloadRequests = async () => {
    const emp = employees[0];
    if (emp) setRequests(await getSlipRequests(emp.id));
  };

  const submitRequest = async () => {
    if (!requestFor) return;
    setRequestBusy(true);
    const { error } = await requestSalarySlip(requestFor.id, requestNote);
    setRequestBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(`Request sent — you'll be notified when your ${requestFor.payroll_month} slip is ready to pick up from HR`);
    setRequestFor(null);
    setRequestNote('');
    reloadRequests();
  };

  const cancelRequest = async (q: SalarySlipRequest) => {
    const { error } = await cancelSlipRequest(q.id);
    if (error) { toast.error(error); return; }
    toast.success('Request cancelled');
    reloadRequests();
  };

  const requestPill: Record<string, string> = {
    pending: 'pill pill-info', ready: 'pill pill-success', collected: 'pill', declined: 'pill pill-danger',
  };

  const handleDownload = async (r: SalaryRecord) => {
    setDownloadingId(r.id);
    try {
      const emp = await getEmployeeForSlip(r.employee_id);
      if (!emp) { toast.error('Employee record not found'); return; }
      await generateSlipPdf(r, emp);
    } catch (err) {
      console.error('Salary slip PDF failed:', err);
      toast.error('Could not generate the PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="page-title">Salary Slips</h1>
          <p className="page-subtitle">
            {canViewAll ? 'Generate and download official salary slips' : 'View your salary slips. Need a printed copy? Request it and HR will notify you when it is ready to pick up.'}
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search month..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {canViewAll && (
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
                    {canViewAll && <th className="text-left px-6 py-3">Employee</th>}
                    <th className="text-left px-6 py-3">Month</th>
                    <th className="text-left px-6 py-3">Period</th>
                    <th className="text-right px-6 py-3">Gross Pay</th>
                    <th className="text-right px-6 py-3">Net Pay</th>
                    {!canViewAll && <th className="text-left px-6 py-3">Printed slip</th>}
                    <th className="text-right px-6 py-3">Slip</th>
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
                      {canViewAll && (
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{empMap[r.employee_id]?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{empMap[r.employee_id]?.employee_id}</p>
                        </td>
                      )}
                      <td className="px-6 py-3 font-medium text-foreground">{r.payroll_month}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.payroll_period || '—'}</td>
                      <td className="px-6 py-3 text-right">{formatLKR(r.total_gross_earning)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-primary">{formatLKR(r.net_pay)}</td>
                      {!canViewAll && (
                        <td className="px-6 py-3">
                          {(() => {
                            const q = latestRequest(r.id);
                            if (!q) return <span className="text-xs text-muted-foreground">Not requested</span>;
                            return (
                              <div className="space-y-0.5">
                                <span className={requestPill[q.status]}>{SLIP_REQUEST_LABELS[q.status]}</span>
                                {q.admin_note && <p className="text-xs text-muted-foreground max-w-[220px] truncate" title={q.admin_note}>{q.admin_note}</p>}
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View slip" onClick={() => navigate(`/salary/${r.id}/slip`)}>
                            <Eye size={15} />
                          </Button>
                          {canViewAll ? (
                            <Button
                              variant="outline" size="sm" className="h-8 text-xs"
                              disabled={downloadingId === r.id}
                              onClick={() => handleDownload(r)}
                            >
                              {downloadingId === r.id ? <FileText size={14} className="mr-1 animate-pulse" /> : <Download size={14} className="mr-1" />}
                              {downloadingId === r.id ? 'Generating...' : 'Download'}
                            </Button>
                          ) : (() => {
                            const q = latestRequest(r.id);
                            if (q?.status === 'pending') {
                              return (
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => cancelRequest(q)}>
                                  <X size={14} className="mr-1" /> Cancel request
                                </Button>
                              );
                            }
                            if (q?.status === 'ready') return null;
                            return (
                              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setRequestNote(''); setRequestFor(r); }}>
                                <Send size={14} className="mr-1" /> Request slip
                              </Button>
                            );
                          })()}
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

      <Dialog open={requestFor !== null} onOpenChange={o => { if (!o && !requestBusy) setRequestFor(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>Request printed salary slip</DialogTitle>
            <DialogDescription>
              HR will prepare your <strong className="text-foreground">{requestFor?.payroll_month}</strong> salary slip and notify you when it is ready to be picked up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="slip-note" className="text-sm font-medium text-foreground">Note for HR (optional)</label>
            <Textarea id="slip-note" rows={3} value={requestNote} onChange={e => setRequestNote(e.target.value)} placeholder="e.g. Needed for a bank loan application" />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRequestFor(null)} disabled={requestBusy}>Cancel</Button>
            <Button onClick={submitRequest} disabled={requestBusy}><Send size={14} /> {requestBusy ? 'Sending…' : 'Send request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SalarySlipsPage;
