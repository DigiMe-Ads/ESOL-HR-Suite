import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Lock, Save } from 'lucide-react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  getEmployeeByProfileId, getEmployeeFileUrls, missingProfileFields, removeEmployeeFiles,
  updateMyEmployeeProfile, uploadEmployeePhoto,
} from '@/db/api';
import type { Employee } from '@/types/types';
import { isValidNic, normalizeNic, NIC_HINT } from '@/lib/nic';
import { EmployeeAvatar, PhotoPicker } from '@/components/employees/EmployeePhoto';
import EmployeeDocuments from '@/components/employees/EmployeeDocuments';

interface Editable { phone: string; nic_number: string; bank: string; bank_branch: string; bank_account_number: string }

const toEditable = (e: Employee): Editable => ({
  phone: e.phone ?? '', nic_number: e.nic_number ?? '', bank: e.bank, bank_branch: e.bank_branch, bank_account_number: e.bank_account_number,
});

// Self-service profile: employees fill in missing details and upload their documents
const MyProfilePage: React.FC = () => {
  const { profile } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Editable>({ phone: '', nic_number: '', bank: '', bank_branch: '', bank_account_number: '' });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const applyEmployee = async (e: Employee) => {
    setEmployee(e);
    setForm(toEditable(e));
    if (e.photo_path) {
      const urls = await getEmployeeFileUrls([e.photo_path]);
      setPhotoUrl(urls[e.photo_path] ?? null);
    } else {
      setPhotoUrl(null);
    }
  };

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const emp = await getEmployeeByProfileId(profile.id);
      if (emp) await applyEmployee(emp);
      setLoading(false);
    })();
  }, [profile]);

  // NIC and bank details are locked once on file; changes go through HR
  const nicLocked = !!employee?.nic_number;
  const bankLocked = !!(employee?.bank && employee.bank_branch && employee.bank_account_number);
  const set = (k: keyof Editable, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (!nicLocked && form.nic_number.trim() && !isValidNic(form.nic_number)) {
      toast.error(`NIC number must be ${NIC_HINT}`); return;
    }
    setSaving(true);
    let photoPath: string | undefined;
    if (photoFile) {
      const up = await uploadEmployeePhoto(employee.id, photoFile);
      if (up.error || !up.path) { setSaving(false); toast.error(up.error ?? 'Photo upload failed'); return; }
      photoPath = up.path;
    }
    const res = await updateMyEmployeeProfile({
      phone: form.phone,
      nic_number: nicLocked ? undefined : (form.nic_number.trim() ? normalizeNic(form.nic_number) : undefined),
      bank: employee.bank ? undefined : form.bank,
      bank_branch: employee.bank_branch ? undefined : form.bank_branch,
      bank_account_number: employee.bank_account_number ? undefined : form.bank_account_number,
      photo_path: photoPath,
    });
    setSaving(false);
    if (res.error || !res.data) {
      if (photoPath) await removeEmployeeFiles([photoPath]);
      toast.error(res.error ?? 'Could not save your details');
      return;
    }
    if (photoPath && employee.photo_path) await removeEmployeeFiles([employee.photo_path]);
    setPhotoFile(null);
    await applyEmployee(res.data);
    toast.success('Your details were saved');
  };

  const readOnly = (label: string, value: string | null | undefined) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  );

  const lockedField = (label: string, key: keyof Editable, locked: boolean, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="flex items-center gap-1.5">
        {label} {locked && <Lock size={12} className="text-muted-foreground" />}
      </Label>
      <Input id={key} value={form[key]} onChange={e => set(key, e.target.value)} disabled={locked || saving} />
      {hint && !locked && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  if (loading) return <AppLayout><div className="p-8"><div className="h-48 bg-muted animate-pulse rounded-2xl" /></div></AppLayout>;

  if (!employee) {
    return (
      <AppLayout>
        <div className="p-6 md:p-8 max-w-2xl">
          <h1 className="page-title">My Profile</h1>
          <Card className="mt-6"><CardContent className="p-6 text-sm text-muted-foreground">
            Your login is not linked to an employee record yet. Please contact HR to link your account.
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  const missing = missingProfileFields(employee);

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <EmployeeAvatar url={photoUrl} name={employee.full_name} className="h-16 w-16 text-lg" />
          <div className="min-w-0">
            <h1 className="page-title truncate">{employee.full_name}</h1>
            <p className="page-subtitle">{employee.employee_id} · {employee.designation}</p>
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Please complete your profile</p>
              <p>Still missing: {missing.join(', ')}. Also upload your educational certificates and service letters below.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 size={18} className="shrink-0" /> Your profile details are complete.
          </div>
        )}

        <form onSubmit={handleSave}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-3"><CardTitle className="text-base">My details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <PhotoPicker currentUrl={photoUrl} name={employee.full_name} file={photoFile} onChange={setPhotoFile} disabled={saving} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4">
                {readOnly('Employee ID', employee.employee_id)}
                {readOnly('Designation', employee.designation)}
                {readOnly('Email (username)', employee.email ?? profile?.email)}
                {readOnly('Employment start', employee.employment_commencement)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} disabled={saving} />
                </div>
                {lockedField('NIC Number', 'nic_number', nicLocked, NIC_HINT)}
              </div>

              <div className="border-t border-border pt-4">
                <p className="section-label mb-3">Bank details (for salary payments)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lockedField('Bank', 'bank', !!employee.bank)}
                  {lockedField('Bank Branch', 'bank_branch', !!employee.bank_branch)}
                  {lockedField('Account Number', 'bank_account_number', !!employee.bank_account_number)}
                </div>
              </div>

              {(nicLocked || bankLocked) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock size={12} /> Locked details are already on file. Contact HR if they need to change.
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save details'}</Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <EmployeeDocuments employeeId={employee.id} canEdit description="Upload your educational certificates, service letters and other documents. HR can see everything you upload here." />
      </div>
    </AppLayout>
  );
};

export default MyProfilePage;
