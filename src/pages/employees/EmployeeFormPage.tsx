import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  createEmployee, updateEmployee, getEmployee, getLinkableProfiles, uploadEmployeePhoto, getEmployeeFileUrls,
  removeEmployeeFiles, createUserAccount, sendLoginEmail,
} from '@/db/api';
import type { LinkableProfile } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_PERMISSION_PRESETS } from '@/types/types';
import { isValidNic, normalizeNic, NIC_HINT } from '@/lib/nic';
import { PhotoPicker } from '@/components/employees/EmployeePhoto';
import LoginCredentialsDialog from '@/components/employees/LoginCredentialsDialog';
import type { IssuedLogin } from '@/components/employees/LoginCredentialsDialog';
import { toast } from 'sonner';
import { ArrowLeft, MailPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormData {
  employee_id: string;
  first_name: string;
  last_name: string;
  nic_number: string;
  email: string;
  phone: string;
  employment_commencement: string;
  designation: string;
  bank: string;
  bank_branch: string;
  bank_account_number: string;
  profile_id: string;
}

const EMPTY: FormData = {
  employee_id: '', first_name: '', last_name: '', nic_number: '', email: '', phone: '',
  employment_commencement: '', designation: '', bank: '', bank_branch: '',
  bank_account_number: '', profile_id: '__none__',
};

const REQUIRED: Array<[keyof FormData, string]> = [
  ['employee_id', 'Employee ID'], ['first_name', 'First name'], ['last_name', 'Last name'],
  ['designation', 'Designation'], ['employment_commencement', 'Employment commencement'],
];

const EmployeeFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const isAdmin = authProfile?.role === 'admin';
  const [form, setForm] = useState<FormData>(EMPTY);
  const [profiles, setProfiles] = useState<LinkableProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<{ path: string; url: string | null } | null>(null);
  const [createLogin, setCreateLogin] = useState(false);
  const [issued, setIssued] = useState<{ login: IssuedLogin; employeeId: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [, profs] = await Promise.all([
        isEdit ? getEmployee(id!).then(async e => {
          if (!e) return;
          setForm({
            employee_id: e.employee_id,
            first_name: e.first_name ?? '',
            last_name: e.last_name ?? '',
            nic_number: e.nic_number ?? '',
            email: e.email ?? '',
            phone: e.phone ?? '',
            employment_commencement: e.employment_commencement,
            designation: e.designation,
            bank: e.bank,
            bank_branch: e.bank_branch,
            bank_account_number: e.bank_account_number,
            profile_id: e.profile_id ?? '__none__',
          });
          if (e.photo_path) {
            const urls = await getEmployeeFileUrls([e.photo_path]);
            setSavedPhoto({ path: e.photo_path, url: urls[e.photo_path] ?? null });
          }
        }) : Promise.resolve(),
        getLinkableProfiles(),
      ]);
      setProfiles(profs);
      setLoading(false);
    })();
  }, [id, isEdit]);

  // New employees get a portal login by default when an admin enters their email
  useEffect(() => {
    if (!isEdit && isAdmin) setCreateLogin(true);
  }, [isEdit, isAdmin]);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));
  const hasLinkedLogin = form.profile_id !== '__none__';
  const offerLogin = isAdmin && !hasLinkedLogin;
  const willCreateLogin = offerLogin && createLogin;

  // Creates a staff login for the employee, links it and emails the set-password link
  const issueLogin = async (employeeId: string): Promise<IssuedLogin | null> => {
    const email = form.email.trim().toLowerCase();
    const res = await createUserAccount({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email,
      phone: form.phone.trim() || undefined,
      role: 'staff',
      permissions: [...ROLE_PERMISSION_PRESETS.staff],
    });
    if (res.error || !res.data) {
      toast.error(`Employee saved, but the portal login could not be created: ${res.error ?? 'unknown error'}`);
      return null;
    }
    const link = await updateEmployee(employeeId, { profile_id: res.data.user_id });
    if (link.error) toast.error(`Login created, but linking it to the employee failed: ${link.error}`);
    const mail = await sendLoginEmail(email);
    return {
      name: `${form.first_name.trim()} ${form.last_name.trim()}`,
      email,
      tempPassword: res.data.temp_password,
      emailError: mail.error,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const [key, label] of REQUIRED) {
      if (!form[key].trim()) { toast.error(`${label} is required`); return; }
    }
    if (form.nic_number.trim() && !isValidNic(form.nic_number)) {
      toast.error(`NIC number must be ${NIC_HINT}`); return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email address'); return;
    }
    if (willCreateLogin && !form.email.trim()) {
      toast.error('An email address is needed to create the portal login'); return;
    }
    setSaving(true);
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.replace(/\s+/g, ' ');
    const payload = {
      employee_id: form.employee_id.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: fullName,
      nic_number: form.nic_number.trim() ? normalizeNic(form.nic_number) : null,
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      employment_commencement: form.employment_commencement,
      designation: form.designation.trim(),
      bank: form.bank.trim(),
      bank_branch: form.bank_branch.trim(),
      bank_account_number: form.bank_account_number.trim(),
      profile_id: form.profile_id === '__none__' ? null : form.profile_id,
    };

    let employeeId = id ?? null;
    if (isEdit) {
      const { error } = await updateEmployee(id!, payload);
      if (error) { setSaving(false); toast.error(error); return; }
    } else {
      const res = await createEmployee({ ...payload, photo_path: null, created_by: authProfile!.id });
      if (res.error || !res.id) { setSaving(false); toast.error(res.error ?? 'Could not create the employee'); return; }
      employeeId = res.id;
    }

    if (photoFile && employeeId) {
      const up = await uploadEmployeePhoto(employeeId, photoFile);
      const saved = up.path ? await updateEmployee(employeeId, { photo_path: up.path }) : null;
      if (up.error || saved?.error) {
        toast.error(`Details saved, but the photo could not be uploaded: ${up.error ?? saved?.error}`);
      } else if (savedPhoto?.path) {
        await removeEmployeeFiles([savedPhoto.path]);
      }
    }

    const login = willCreateLogin && employeeId ? await issueLogin(employeeId) : null;
    setSaving(false);
    toast.success(isEdit ? 'Employee updated' : 'Employee created');
    if (login && employeeId) { setIssued({ login, employeeId }); return; }
    navigate(employeeId ? `/employees/${employeeId}` : '/employees');
  };

  const field = (label: string, key: keyof FormData, type = 'text', hint?: string, required?: boolean) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={key} type={type} value={form[key]} onChange={e => set(key, e.target.value)} disabled={loading} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')} className="shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{isEdit ? 'Edit Employee' : 'Add Employee'}</h1>
            <p className="text-sm text-muted-foreground">Employee profile information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm section-label">1. Generic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoPicker
                currentUrl={savedPhoto?.url}
                name={`${form.first_name} ${form.last_name}`}
                file={photoFile}
                onChange={setPhotoFile}
                disabled={loading || saving}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Employee ID', 'employee_id', 'text', undefined, true)}
                {field('Designation', 'designation', 'text', undefined, true)}
                {field('First Name', 'first_name', 'text', undefined, true)}
                {field('Last Name', 'last_name', 'text', undefined, true)}
                {field('NIC Number', 'nic_number', 'text', 'Old (901234567V) or new (199012345678) format')}
                {field('Employment Commencement', 'employment_commencement', 'date', undefined, true)}
                {field('Email Address', 'email', 'email', willCreateLogin ? 'Used as the portal username' : undefined, willCreateLogin)}
                {field('Phone Number', 'phone', 'tel')}
              </div>
              <div className="border-t border-border pt-4">
                <p className="section-label mb-1">Bank Details</p>
                <p className="text-xs text-muted-foreground mb-3">Optional — the employee can fill these in themselves after signing in.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field('Bank', 'bank')}
                  {field('Bank Branch', 'bank_branch')}
                  {field('Bank Account Number', 'bank_account_number')}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="section-label">Portal Access</p>
                {offerLogin && (
                  <label htmlFor="create-login" className="flex items-start gap-2.5 rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30">
                    <Checkbox id="create-login" checked={createLogin} onCheckedChange={v => setCreateLogin(v === true)} className="mt-0.5" disabled={loading} />
                    <span className="text-sm">
                      <span className="font-medium text-foreground flex items-center gap-1.5"><MailPlus size={14} className="text-primary" /> Create a portal login and email the employee</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        They receive a link to set their password, then can complete their details and upload documents under "My Profile". Access starts as Staff (change it in User Management).
                      </span>
                    </span>
                  </label>
                )}
                {!willCreateLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="profile_id">Link an existing user account</Label>
                    <Select value={form.profile_id} onValueChange={v => set('profile_id', v)} disabled={loading}>
                      <SelectTrigger id="profile_id">
                        <SelectValue placeholder="Select a user account..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not linked —</SelectItem>
                        {profiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/employees')}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}</Button>
          </div>
        </form>
      </div>

      <LoginCredentialsDialog
        login={issued?.login ?? null}
        onClose={() => { const empId = issued?.employeeId; setIssued(null); navigate(empId ? `/employees/${empId}` : '/employees'); }}
      />
    </AppLayout>
  );
};

export default EmployeeFormPage;
