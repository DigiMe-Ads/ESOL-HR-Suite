import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { adminDeleteEmployee, getLeaveRequests, getSalaryRecords, listEmployeeDocuments } from '@/db/api';
import type { Employee } from '@/types/types';

interface Props {
  employee: Pick<Employee, 'id' | 'employee_id' | 'full_name' | 'profile_id' | 'employment_status'> | null;
  onClose: () => void;
  onRemoved: () => void;
}

const LOGIN_RESULT: Record<string, string> = {
  deleted: 'Their portal login was deleted.',
  disabled: 'Their login could not be deleted because it is referenced by other records, so it was disabled instead.',
  kept: 'Their portal login was kept.',
  none: '',
};

/** Admin-only permanent removal, confirmed by typing the Employee ID */
const RemoveEmployeeDialog: React.FC<Props> = ({ employee, onClose, onRemoved }) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleteLogin, setDeleteLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<{ salary: number; leave: number; docs: number } | null>(null);

  useEffect(() => {
    setConfirmText('');
    setDeleteLogin(true);
    setCounts(null);
    if (!employee) return;
    let cancelled = false;
    Promise.all([getSalaryRecords(employee.id), getLeaveRequests(employee.id), listEmployeeDocuments(employee.id)])
      .then(([s, l, d]) => { if (!cancelled) setCounts({ salary: s.length, leave: l.length, docs: d.length }); });
    return () => { cancelled = true; };
  }, [employee]);

  const matches = !!employee && confirmText.trim() === employee.employee_id;

  const handleRemove = async () => {
    if (!employee || !matches) return;
    setBusy(true);
    const res = await adminDeleteEmployee(employee.id, deleteLogin);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(`${employee.full_name} was removed. ${LOGIN_RESULT[res.login ?? 'none'] ?? ''}`.trim());
    onRemoved();
  };

  return (
    <Dialog open={employee !== null} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} /> Remove employee permanently
          </DialogTitle>
          <DialogDescription>
            This deletes <strong className="text-foreground">{employee?.full_name}</strong> ({employee?.employee_id}) and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p className="font-medium text-foreground">These records will also be deleted:</p>
            {counts ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>{counts.salary} salary record{counts.salary === 1 ? '' : 's'} (payslips)</li>
                <li>{counts.leave} leave request{counts.leave === 1 ? '' : 's'}</li>
                <li>{counts.docs} uploaded document{counts.docs === 1 ? '' : 's'} and the profile photo</li>
              </ul>
            ) : <p className="text-muted-foreground">Counting records…</p>}
          </div>

          {employee?.employment_status !== 'resigned' && (
            <p className="text-muted-foreground">
              If the person has left, <strong className="text-foreground">Mark as resigned</strong> is usually better: it blocks their login but keeps
              payroll and leave history for statutory (EPF/ETF) records.
            </p>
          )}

          {employee?.profile_id && (
            <label htmlFor="delete-login" className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox id="delete-login" checked={deleteLogin} onCheckedChange={v => setDeleteLogin(v === true)} className="mt-0.5" />
              <span>
                Also delete their portal login
                <span className="block text-xs text-muted-foreground">If unticked, the login is kept but no longer linked to an employee.</span>
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="confirm-remove">Type <span className="font-mono font-semibold">{employee?.employee_id}</span> to confirm</Label>
            <Input id="confirm-remove" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" disabled={busy} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleRemove} disabled={!matches || busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Trash2 size={15} /> {busy ? 'Removing…' : 'Remove employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveEmployeeDialog;
