import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createEmployee, updateEmployee, getEmployee, getAllProfiles } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/types';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormData {
  employee_id: string;
  first_name: string;
  last_name: string;
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
  employee_id: '', first_name: '', last_name: '', email: '', phone: '',
  employment_commencement: '', designation: '', bank: '', bank_branch: '',
  bank_account_number: '', profile_id: '__none__',
};

const EmployeeFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [, profs] = await Promise.all([
        isEdit ? getEmployee(id!).then(e => {
          if (e) setForm({
            employee_id: e.employee_id,
            first_name: e.first_name ?? '',
            last_name: e.last_name ?? '',
            email: e.email ?? '',
            phone: e.phone ?? '',
            employment_commencement: e.employment_commencement,
            designation: e.designation,
            bank: e.bank,
            bank_branch: e.bank_branch,
            bank_account_number: e.bank_account_number,
            profile_id: e.profile_id ?? '__none__',
          });
        }) : Promise.resolve(),
        getAllProfiles(),
      ]);
      setProfiles(profs);
      setLoading(false);
    })();
  }, [id, isEdit]);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = ['employee_id', 'first_name', 'last_name', 'employment_commencement', 'designation', 'bank', 'bank_branch', 'bank_account_number'] as const;
    for (const f of required) {
      if (!form[f].trim()) { toast.error(`${f.replace(/_/g, ' ')} is required`); return; }
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email address'); return;
    }
    setSaving(true);
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.replace(/\s+/g, ' ');
    const payload = {
      employee_id: form.employee_id.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: fullName,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      employment_commencement: form.employment_commencement,
      designation: form.designation.trim(),
      bank: form.bank.trim(),
      bank_branch: form.bank_branch.trim(),
      bank_account_number: form.bank_account_number.trim(),
      profile_id: form.profile_id === '__none__' ? null : form.profile_id,
    };
    if (isEdit) {
      await updateEmployee(id!, payload);
      toast.success('Employee updated');
    } else {
      await createEmployee({ ...payload, created_by: authProfile!.id });
      toast.success('Employee created');
    }
    setSaving(false);
    navigate('/employees');
  };

  const field = (label: string, key: keyof FormData, type = 'text', placeholder = '') => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} placeholder={placeholder} value={form[key]} onChange={e => set(key, e.target.value)} disabled={loading} />
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
          <Card className="border-border shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm section-label">1. Generic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Employee ID', 'employee_id')}
                {field('Designation', 'designation')}
                {field('First Name', 'first_name')}
                {field('Last Name', 'last_name')}
                {field('Email Address', 'email', 'email')}
                {field('Phone Number', 'phone', 'tel')}
                {field('Employment Commencement', 'employment_commencement', 'date')}
              </div>
              <div className="border-t border-border pt-4">
                <p className="section-label mb-3">Bank Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field('Bank', 'bank')}
                  {field('Bank Branch', 'bank_branch')}
                  {field('Bank Account Number', 'bank_account_number')}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="section-label mb-3">Link to User Account (Optional)</p>
                <div className="space-y-1.5">
                  <Label htmlFor="profile_id">Staff Account</Label>
                  <Select value={form.profile_id} onValueChange={v => set('profile_id', v)} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not linked —</SelectItem>
                      {profiles.filter(p => p.role !== 'admin').map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/employees')}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}</Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default EmployeeFormPage;
