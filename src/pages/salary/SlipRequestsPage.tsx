import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCheck, Eye, PackageCheck, XCircle } from 'lucide-react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getEmployeeDirectory, getSlipRequests, updateSlipRequest } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import type { SalarySlipRequest, SlipRequestStatus } from '@/types/types';
import { SLIP_REQUEST_LABELS } from '@/types/types';

type Filter = 'open' | SlipRequestStatus | 'all';
type Action = Exclude<SlipRequestStatus, 'pending'>;

const PILL: Record<SlipRequestStatus, string> = {
  pending: 'pill pill-warning', ready: 'pill pill-info', collected: 'pill pill-success', declined: 'pill pill-danger',
};

const ACTION_COPY: Record<Action, { title: string; button: string; notePlaceholder: string; description: string }> = {
  ready: {
    title: 'Mark ready for pickup', button: 'Mark ready & notify',
    notePlaceholder: 'e.g. Collect from the HR office (2nd floor) after 2 pm',
    description: 'The employee gets a notification that their salary slip is ready to be picked up from HR.',
  },
  declined: {
    title: 'Decline request', button: 'Decline & notify',
    notePlaceholder: 'Reason shown to the employee',
    description: 'The employee is notified that the request was declined.',
  },
  collected: {
    title: 'Mark as collected', button: 'Mark collected',
    notePlaceholder: 'Optional note',
    description: 'Closes the request once the employee has picked up the printed slip.',
  },
};

// Payroll staff handle employees' requests for printed salary slips
const SlipRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SalarySlipRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ req: SalarySlipRequest; action: Action } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, emps] = await Promise.all([getSlipRequests(), getEmployeeDirectory()]);
    setRequests(reqs);
    setEmployees(emps);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const filtered = requests.filter(r =>
    filter === 'all' || (filter === 'open' ? r.status === 'pending' || r.status === 'ready' : r.status === filter));
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const openDialog = (req: SalarySlipRequest, action: Action) => { setNote(''); setDialog({ req, action }); };

  const submit = async () => {
    if (!dialog) return;
    setBusy(true);
    const { error } = await updateSlipRequest(dialog.req.id, dialog.action, note);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(dialog.action === 'ready' ? 'Marked ready — the employee has been notified' : dialog.action === 'declined' ? 'Request declined' : 'Marked as collected');
    setDialog(null);
    load();
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="page-title">Salary Slip Requests</h1>
          <p className="page-subtitle">
            Employees request printed salary slips here. Mark a request ready and they are notified to pick it up from HR.
            {pendingCount > 0 && <span className="ml-1 font-medium text-foreground">{pendingCount} waiting.</span>}
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open (requested + ready)</SelectItem>
                <SelectItem value="pending">Requested</SelectItem>
                <SelectItem value="ready">Ready for pickup</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="text-left px-6 py-3">Employee</th>
                    <th className="text-left px-6 py-3">Slip month</th>
                    <th className="text-left px-6 py-3">Requested</th>
                    <th className="text-left px-6 py-3">Note</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No requests here.</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id}>
                      <td className="px-6 py-3">
                        <p className="font-medium text-foreground">{empMap[r.employee_id]?.full_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{empMap[r.employee_id]?.employee_id}</p>
                      </td>
                      <td className="px-6 py-3 font-medium">{r.payroll_month}</td>
                      <td className="px-6 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-LK')}</td>
                      <td className="px-6 py-3 text-muted-foreground max-w-[220px] truncate" title={r.note ?? ''}>{r.note ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={PILL[r.status]}>{SLIP_REQUEST_LABELS[r.status]}</span>
                        {r.admin_note && <p className="text-xs text-muted-foreground mt-0.5 max-w-[220px] truncate" title={r.admin_note}>{r.admin_note}</p>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View slip" onClick={() => navigate(`/salary/${r.salary_record_id}/slip`)}>
                            <Eye size={15} />
                          </Button>
                          {r.status === 'pending' && (
                            <>
                              <Button size="sm" className="h-8 text-xs" onClick={() => openDialog(r, 'ready')}>
                                <PackageCheck size={14} /> Ready for pickup
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Decline" onClick={() => openDialog(r, 'declined')}>
                                <XCircle size={15} />
                              </Button>
                            </>
                          )}
                          {r.status === 'ready' && (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openDialog(r, 'collected')}>
                              <CheckCheck size={14} /> Collected
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

      <Dialog open={dialog !== null} onOpenChange={o => { if (!o && !busy) setDialog(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_COPY[dialog.action].title}</DialogTitle>
                <DialogDescription>
                  {empMap[dialog.req.employee_id]?.full_name} — {dialog.req.payroll_month}. {ACTION_COPY[dialog.action].description}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <label htmlFor="admin-note" className="text-sm font-medium text-foreground">Note {dialog.action === 'declined' ? '' : '(optional)'}</label>
                <Textarea id="admin-note" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={ACTION_COPY[dialog.action].notePlaceholder} />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
                <Button onClick={submit} disabled={busy || (dialog.action === 'declined' && !note.trim())}
                  className={dialog.action === 'declined' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
                  {busy ? 'Saving…' : ACTION_COPY[dialog.action].button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SlipRequestsPage;
