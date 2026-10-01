import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { clearMustChangePassword, completeForcedPasswordChange } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { getFirstPermittedPath } from '@/routes';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { KeyRound, Check, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/common/BrandLogo';


const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /[0-9]/.test(p) },
];

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, passwordRecovery, endPasswordRecovery } = useAuth();
  // First login with a temporary password, or arriving from the emailed link → no current password needed
  const forced = profile?.must_change_password === true || passwordRecovery;

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!RULES.every(r => r.test(password))) { toast.error('Password must be 8+ characters with at least one letter and one number'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (!forced && password === current) { toast.error('New password must be different from the current one'); return; }
    setLoading(true);

    if (!forced) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: current });
      if (verifyErr) {
        setLoading(false);
        toast.error('Current password is incorrect');
        return;
      }
    }

    // Forced change: the server sets the password and clears the temporary flag together
    const serverSide = forced ? await completeForcedPasswordChange(password) : { error: null, missing: true };
    if (serverSide.error) {
      setLoading(false);
      toast.error(serverSide.error);
      return;
    }
    if (serverSide.missing) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setLoading(false);
        toast.error(error.message);
        return;
      }
      if (forced && user) {
        const cleared = await clearMustChangePassword(user.id);
        if (cleared.error) {
          setLoading(false);
          toast.error(cleared.error);
          return;
        }
      }
    }
    if (forced) await refreshProfile();
    endPasswordRecovery();
    setLoading(false);
    setCurrent(''); setPassword(''); setConfirm('');
    toast.success('Password updated successfully');
    navigate(getFirstPermittedPath(profile ? { ...profile, must_change_password: false } : null), { replace: true });
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!forced && (
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" placeholder="Enter your current password" value={current}
            onChange={e => setCurrent(e.target.value)} autoComplete="current-password" disabled={loading} required className="h-11" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input id="new-password" type="password" placeholder="Choose a strong password" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} required minLength={8} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input id="confirm-password" type="password" placeholder="Re-enter the new password" value={confirm}
          onChange={e => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading} required minLength={8} className="h-11" />
      </div>
      <ul className="grid gap-1.5 rounded-xl bg-muted/60 p-3.5">
        {RULES.map(r => {
          const ok = r.test(password);
          return (
            <li key={r.label} className={cn('flex items-center gap-2 text-xs transition-colors', ok ? 'text-emerald-700' : 'text-muted-foreground')}>
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full transition-colors', ok ? 'bg-emerald-500 text-white' : 'bg-border')}>
                {ok && <Check size={10} strokeWidth={3} />}
              </span>
              {r.label}
            </li>
          );
        })}
      </ul>
      <Button type="submit" size="lg" className="w-full bg-gradient-primary" disabled={loading}>
        {loading ? <><Loader2 className="animate-spin" /> Updating…</> : 'Update password'}
      </Button>
    </form>
  );

  if (forced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-app p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center text-center mb-8">
            <BrandLogo className="w-[220px] mb-8" />
            <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {profile?.must_change_password
                ? 'Welcome to the ESOL Premier Campus portal. Choose your own password to continue.'
                : 'Choose a new password for your account.'}
            </p>
          </div>
          <Card className="shadow-hover">
            <CardContent className="p-6">{form}</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="page-title">Change password</h1>
          <p className="page-subtitle">Update the password you use to sign in to the HR platform.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] max-w-4xl">
          <Card>
            <CardContent className="p-6">{form}</CardContent>
          </Card>
          <Card className="h-fit bg-gradient-to-br from-accent to-card">
            <CardContent className="p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck size={20} className="text-primary" />
              </div>
              <p className="font-display font-semibold">Keep your account safe</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use a unique password you don't use anywhere else. Your other sessions stay signed in until they expire.
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <KeyRound size={13} /> Signed in as <span className="font-medium text-foreground truncate">{user?.email}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default ChangePasswordPage;
