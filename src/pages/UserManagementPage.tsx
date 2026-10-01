import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllProfiles, createUserAccount, resetUserPassword, getEmployees, updateEmployee, updateUserPermissions } from '@/db/api';
import type { Profile, UserRole, Employee, Permission } from '@/types/types';
import { PERMISSION_MODULES, ALL_PERMISSIONS, ROLE_PERMISSION_PRESETS } from '@/types/types';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Check, Mail, ExternalLink, CheckCircle2, UserCheck, ShieldCheck, Lock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'finance', label: 'Finance' },
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR User' },
];

const roleLabel = (r: UserRole) => ROLE_OPTIONS.find(o => o.value === r)?.label ?? (r === 'admin' ? 'Administrator' : r);

interface CreateFormState {
  employee_id: string; // ID of selected employee or 'manual'
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: UserRole;
  permissions: Permission[];
}

const EMPTY_CREATE: CreateFormState = {
  employee_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: 'staff',
  permissions: [...ROLE_PERMISSION_PRESETS.staff],
};

interface TempCredsState {
  name: string;
  email: string;
  password: string;
  portal_url: string;
  is_reset?: boolean;
}

const UserManagementPage: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({ ...EMPTY_CREATE });
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [tempCreds, setTempCreds] = useState<TempCredsState | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Edit-permissions dialog state
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('staff');
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pList, eList] = await Promise.all([getAllProfiles(), getEmployees()]);
    setProfiles(pList);
    setEmployees(eList);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePerm = (list: Permission[], perm: Permission): Permission[] =>
    list.includes(perm) ? list.filter(p => p !== perm) : [...list, perm];

  // When an employee is chosen in the Create User dialog, auto-fill their email, name, and phone
  const handleEmployeeSelect = (empId: string) => {
    if (empId === 'manual') {
      setCreateForm(f => ({ ...f, employee_id: 'manual', first_name: '', last_name: '', email: '', phone: '' }));
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    let fName = emp.first_name || '';
    let lName = emp.last_name || '';
    if (!fName && emp.full_name) {
      const parts = emp.full_name.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }

    setCreateForm(f => ({
      ...f,
      employee_id: emp.id,
      first_name: fName,
      last_name: lName,
      email: emp.email?.trim() || '',
      phone: emp.phone?.trim() || '',
    }));
  };

  // Selecting a role pre-checks that role's default modules (still fully editable)
  const handleRolePreset = (role: UserRole) => {
    setCreateForm(f => ({ ...f, role, permissions: [...ROLE_PERMISSION_PRESETS[role]] }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const { first_name, last_name, email, phone, role, permissions, employee_id } = createForm;
    if (!first_name.trim() || !last_name.trim()) {
      toast.error('First name and last name are required'); return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('A valid email address is required (it serves as the username)'); return;
    }
    if (permissions.length === 0) {
      toast.error('Select at least one module for this user to access'); return;
    }

    setCreating(true);
    const res = await createUserAccount({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role,
      permissions,
    });
    setCreating(false);

    if (res.error || !res.data) {
      toast.error(res.error ?? 'Failed to create user');
      return;
    }

    // If linked to an employee record, update employee.profile_id and ensure employee.email matches
    if (employee_id && employee_id !== 'manual') {
      const link = await updateEmployee(employee_id, {
        profile_id: res.data.user_id,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
      });
      if (link.error) toast.error(`Account created, but linking it to the employee failed: ${link.error}`);
    }

    setTempCreds({
      name: `${first_name.trim()} ${last_name.trim()}`,
      email: email.trim().toLowerCase(),
      password: res.data.temp_password,
      portal_url: `${window.location.origin}/login`,
      is_reset: false,
    });

    setShowCreate(false);
    setCreateForm({ ...EMPTY_CREATE });
    toast.success('User account created successfully');
    load();
  };

  const openEditPermissions = (p: Profile) => {
    setEditTarget(p);
    setEditRole(p.role);
    // Admins implicitly hold all modules; show them fully ticked
    setEditPerms(p.role === 'admin' ? [...ALL_PERMISSIONS] : (p.permissions ?? []));
  };

  const handleSavePermissions = async () => {
    if (!editTarget) return;
    if (editPerms.length === 0) {
      toast.error('Select at least one module for this user to access'); return;
    }
    setSavingPerms(true);
    const res = await updateUserPermissions({
      user_id: editTarget.id,
      permissions: editPerms,
      role: editTarget.role === 'admin' ? undefined : editRole,
    });
    setSavingPerms(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Access permissions updated');
    setEditTarget(null);
    load();
  };

  const handleResetPassword = async (p: Profile) => {
    setResettingId(p.id);
    const res = await resetUserPassword(p.id);
    setResettingId(null);
    if (res.error || !res.data) {
      toast.error(res.error ?? 'Failed to reset password'); return;
    }
    setTempCreds({
      name: p.full_name || 'Employee',
      email: p.email ?? '',
      password: res.data.temp_password,
      portal_url: `${window.location.origin}/login`,
      is_reset: true,
    });
    load();
  };

  const copyPassword = async () => {
    if (!tempCreds) return;
    try {
      await navigator.clipboard.writeText(tempCreds.password);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
      toast.success('Temporary password copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const getEmailContent = () => {
    if (!tempCreds) return { subject: '', body: '' };
    const subject = tempCreds.is_reset
      ? 'ESOL Premier Campus Portal — Your New Password'
      : 'Welcome to ESOL Premier Campus Portal — Your Login Credentials';
    const body = `Dear ${tempCreds.name},

Your user account for the ESOL Premier Campus Employee Portal is ready.

Portal Login URL: ${tempCreds.portal_url}
Username (Your Email): ${tempCreds.email}
Temporary Password: ${tempCreds.password}

Please log in to the portal using your username and temporary password. Upon your first sign-in, you will be prompted to set your own permanent password.

If you have any questions, please contact the HR Department.

Best regards,
ESOL Premier Campus HR & Administration
No 179, High Level Road, Pannipitiya`;
    return { subject, body };
  };

  const copyInvitationEmail = async () => {
    const { body } = getEmailContent();
    try {
      await navigator.clipboard.writeText(body);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
      toast.success('Full invitation email copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const openMailClient = () => {
    if (!tempCreds) return;
    const { subject, body } = getEmailContent();
    window.location.href = `mailto:${encodeURIComponent(tempCreds.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getLinkedEmployee = (profileId: string) => employees.find(e => e.profile_id === profileId);

  const PermCheckList: React.FC<{
    perms: Permission[];
    onChange: (p: Permission[]) => void;
    locked?: boolean;
  }> = ({ perms, onChange, locked }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {PERMISSION_MODULES.map(mod => (
        <label
          key={mod.key}
          className={`flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${perms.includes(mod.key) ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'} ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-primary/30'}`}
        >
          <Checkbox
            checked={perms.includes(mod.key)}
            disabled={locked}
            onCheckedChange={() => !locked && onChange(togglePerm(perms, mod.key))}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground block">{mod.label}</span>
            <span className="text-xs text-muted-foreground block mt-0.5">{mod.description}</span>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">
              Create accounts, tick the module access for each user, and issue login credentials
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="shrink-0">
            <UserPlus size={16} className="mr-1.5" /> Create User
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Email (Username)</th>
                    <th className="text-left px-6 py-3">Role</th>
                    <th className="text-left px-6 py-3">Module Access</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(5)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-28" /></td>
                        ))}
                      </tr>
                    ))
                  ) : profiles.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No users found.</td></tr>
                  ) : profiles.map(p => {
                    const linkedEmp = getLinkedEmployee(p.id);
                    const isAdmin = p.role === 'admin';
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <span className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isAdmin ? 'bg-gradient-primary text-white' : 'bg-accent text-primary'}`}>
                              {(p.full_name ?? p.email ?? '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              {p.full_name ?? '—'}
                              {linkedEmp && <span className="block text-xs text-muted-foreground font-normal">{linkedEmp.employee_id} · {linkedEmp.designation}</span>}
                              {p.must_change_password && (
                                <span className="pill pill-warning mt-1 normal-case">Temporary password</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-muted-foreground">
                          {p.email ?? '—'}
                          <span className="block text-xs text-muted-foreground/70">Joined {new Date(p.created_at).toLocaleDateString('en-LK')}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isAdmin ? 'bg-gradient-primary text-white shadow-glow' : 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border'}`}>
                            {isAdmin && <Lock size={10} />}
                            {roleLabel(p.role)}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1 min-w-[220px] max-w-[320px] whitespace-normal">
                            {isAdmin && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                                All modules
                              </span>
                            )}
                            {(isAdmin ? [] : (p.permissions ?? [])).map(perm => {
                              const m = PERMISSION_MODULES.find(x => x.key === perm);
                              return m ? (
                                <span key={perm} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-accent text-accent-foreground ring-1 ring-inset ring-primary/10">
                                  {m.label}
                                </span>
                              ) : null;
                            })}
                            {!isAdmin && (p.permissions ?? []).length === 0 && (
                              <span className="text-xs text-muted-foreground italic">No modules</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openEditPermissions(p)}
                              title="Edit module access"
                            >
                              <ShieldCheck size={14} /> <span className="hidden 2xl:inline">Access</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={resettingId === p.id}
                              onClick={() => handleResetPassword(p)}
                              title="Reset password"
                            >
                              <KeyRound size={14} />
                              <span className="hidden 2xl:inline">{resettingId === p.id ? 'Resetting...' : 'Reset password'}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create User Account for Employee</DialogTitle>
            <DialogDescription>
              Select a registered employee, choose a base role, then tick exactly which modules this user can access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            {/* Registered Employee Picker */}
            <div className="space-y-1.5">
              <Label>Select Registered Employee</Label>
              <Select value={createForm.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">+ Manual Entry (External / Non-employee account)</SelectItem>
                  {employees.map(emp => {
                    const alreadyLinked = profiles.some(p => p.id === emp.profile_id);
                    return (
                      <SelectItem key={emp.id} value={emp.id} disabled={alreadyLinked}>
                        {emp.employee_id} — {emp.full_name} {emp.email ? `(${emp.email})` : '(No email)'} {alreadyLinked ? '✓ [Has Account]' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Kumara"
                  value={createForm.first_name}
                  onChange={e => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Perera"
                  value={createForm.last_name}
                  onChange={e => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Email Address / Username */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Registered Email (System Username) <span className="text-destructive">*</span></Label>
                {createForm.employee_id && createForm.employee_id !== 'manual' && createForm.email && (
                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} /> From Employee Record
                  </span>
                )}
              </div>
              <Input
                type="email"
                placeholder="employee@esolpremiercampus.lk"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                This exact email address will be the username used to sign in to the portal and will receive the login credentials and temporary password.
              </p>
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                placeholder="+94 77 123 4567"
                value={createForm.phone}
                onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Base Role + Module Access */}
            <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm">Base Role (applies default module preset)</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    e.g. Finance = Salary Management + Salary Slips only. You can still adjust the ticks below.
                  </p>
                </div>
                <div className="w-full sm:w-44 shrink-0">
                  <Select value={createForm.role} onValueChange={v => handleRolePreset(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Module Access <span className="text-destructive">*</span></Label>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => setCreateForm(f => ({ ...f, permissions: [...ALL_PERMISSIONS] }))}>
                      Select All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
                      onClick={() => setCreateForm(f => ({ ...f, permissions: [] }))}>
                      Clear
                    </Button>
                  </div>
                </div>
                <PermCheckList
                  perms={createForm.permissions}
                  onChange={perms => setCreateForm(f => ({ ...f, permissions: perms }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Creating Account...' : 'Create Account & Prepare Credentials'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Access Permissions Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              Module Access — {editTarget?.full_name ?? 'User'}
            </DialogTitle>
            <DialogDescription>
              {editTarget?.role === 'admin'
                ? 'Administrators always have full access to every module. This cannot be modified.'
                : 'Tick the modules this user is allowed to see. Unticked modules disappear from their navigation and are blocked by the backend.'}
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <div className="space-y-4">
              {editTarget.role !== 'admin' ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Base Role</Label>
                    <Select
                      value={editRole}
                      onValueChange={v => {
                        const r = v as UserRole;
                        setEditRole(r);
                        setEditPerms([...ROLE_PERMISSION_PRESETS[r]]);
                      }}
                    >
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Changing the role re-applies its default preset (you can still fine-tune the ticks).</p>
                  </div>

                  <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Module Access</Label>
                      <div className="flex gap-1.5">
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setEditPerms([...ALL_PERMISSIONS])}>Select All</Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setEditPerms([])}>Clear</Button>
                      </div>
                    </div>
                    <PermCheckList perms={editPerms} onChange={setEditPerms} />
                  </div>
                </>
              ) : (
                <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Lock size={14} className="text-primary" />
                    <span className="font-medium">Administrator — Full Access (Locked)</span>
                  </div>
                  <PermCheckList perms={editPerms} onChange={() => {}} locked />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
                {editTarget.role !== 'admin' && (
                  <Button onClick={handleSavePermissions} disabled={savingPerms}>
                    {savingPerms ? 'Saving...' : 'Save Access'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Temporary Password & Employee Email Dialog */}
      <Dialog open={tempCreds !== null} onOpenChange={open => { if (!open) setTempCreds(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-primary" />
              {tempCreds?.is_reset ? 'Password Reset for Employee' : 'Employee Login Credentials Ready'}
            </DialogTitle>
            <DialogDescription>
              The employee account has been created with their registered email as username. Send them the portal link and temporary password below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Employee Name</span>
                  <span className="font-semibold text-foreground text-sm">{tempCreds?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Portal URL</span>
                  <a href={tempCreds?.portal_url} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline text-xs inline-flex items-center gap-1">
                    {tempCreds?.portal_url} <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              <div className="border-t border-border pt-2.5">
                <span className="text-muted-foreground block text-xs mb-0.5">Username (Registered Email)</span>
                <span className="font-mono font-medium text-foreground text-sm">{tempCreds?.email}</span>
              </div>

              <div className="border-t border-border pt-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-muted-foreground block text-xs mb-0.5">Temporary Password</span>
                  <span className="font-mono font-bold text-primary text-base tracking-wider break-all">
                    {tempCreds?.password}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0 h-8" onClick={copyPassword}>
                  {copiedPwd ? <Check size={14} className="mr-1 text-emerald-600" /> : <Copy size={14} className="mr-1" />}
                  {copiedPwd ? 'Copied' : 'Copy Password'}
                </Button>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-start gap-2">
                <Mail size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <p className="font-medium">Send Credentials to Employee ({tempCreds?.email})</p>
                  <p className="text-muted-foreground mt-0.5">
                    Click "Send Email to Employee" to open your mail app with the pre-filled username and password, or copy the formatted message.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="default" size="sm" className="text-xs flex-1 min-w-[160px]" onClick={openMailClient}>
                  <Mail size={13} className="mr-1.5" /> Send Email to Employee
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-xs flex-1 min-w-[160px]" onClick={copyInvitationEmail}>
                  {copiedEmail ? <Check size={13} className="mr-1.5 text-emerald-600" /> : <Copy size={13} className="mr-1.5" />}
                  {copiedEmail ? 'Email Copied!' : 'Copy Invitation Email'}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              The employee will be required to change this temporary password upon their first sign-in.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setTempCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default UserManagementPage;
