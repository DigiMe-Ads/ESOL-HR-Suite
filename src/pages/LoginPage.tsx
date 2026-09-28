import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { resetPasswordWithCode } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Users, Receipt, CalendarCheck, ArrowLeft, KeyRound, Mail, Lock, ShieldCheck, Loader2,
} from 'lucide-react';

const LOGO_URL = '/esol_logo.png';

type Mode = 'signin' | 'reset';

// The email address is the username; bare usernames map to the platform domain
function toEmail(raw: string): string {
  const v = raw.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@miaoda.com`;
}

const FEATURES = [
  { icon: Users, title: 'Employee records', text: 'One source of truth for your whole team.' },
  { icon: Receipt, title: 'Payroll & slips', text: 'EPF/ETF-ready payslips in a click.' },
  { icon: CalendarCheck, title: 'Leave approvals', text: 'Requests, balances and reviews in one flow.' },
];

const PasswordInput: React.FC<React.ComponentProps<typeof Input>> = (props) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input {...props} type={show ? 'text' : 'password'} className="h-11 pl-10 pr-10" />
      <button type="button" tabIndex={-1} onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Reset-with-code form
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error('Please agree to the User Agreement and Privacy Policy'); return; }
    if (!username.trim() || !password.trim()) { toast.error('Please enter your email/username and password'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
    if (error) {
      setLoading(false);
      toast.error('Invalid email/username or password');
      return;
    }
    // RouteGuard forces a password change if the account still uses a temporary password.
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? '/dashboard', { replace: true });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !resetCode.trim()) { toast.error('Enter your email and the reset code'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one letter and one number');
      return;
    }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    const email = toEmail(username);
    const err = await resetPasswordWithCode(email, resetCode, newPassword);
    if (err) {
      setLoading(false);
      toast.error(err);
      return;
    }
    toast.success('Password updated — signing you in');
    const { error } = await supabase.auth.signInWithPassword({ email, password: newPassword });
    setLoading(false);
    if (error) {
      setMode('signin');
      setPassword('');
      toast.error('Password changed, but sign-in failed. Please sign in manually.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-sidebar text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-primary/40 blur-[110px]" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[380px] w-[380px] rounded-full bg-violet-500/30 blur-[110px]" />
        <div className="absolute top-1/2 right-1/4 h-40 w-40 rounded-full bg-gold/20 blur-[80px]" />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-xl">
              <img src={LOGO_URL} alt="ESOL Premier Campus" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-display font-bold leading-tight">ESOL Premier Campus</p>
              <p className="text-xs text-white/60">HR Suite</p>
            </div>
          </div>

          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
              <ShieldCheck size={13} className="text-emerald-400" /> Secure staff portal
            </span>
            <h1 className="mt-5 text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight">
              People operations,{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-amber-200 bg-clip-text text-transparent">beautifully simple.</span>
            </h1>
            <p className="mt-4 text-white/65 text-[15px] leading-relaxed">
              Manage employees, run payroll and approve leave — all from a single, modern workspace.
            </p>

            <div className="mt-10 space-y-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-sm text-white/55">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40">ESOL Premier Campus (Pvt) Limited · No 179, High Level Road, Pannipitiya, 10230</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-app">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-card border border-border">
              <img src={LOGO_URL} alt="ESOL Premier Campus" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-display font-bold leading-tight">ESOL Premier Campus</p>
              <p className="text-xs text-muted-foreground">HR Suite</p>
            </div>
          </div>

          {mode === 'signin' ? (
            <>
              <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
              <p className="mt-2 text-muted-foreground">Sign in to your HR workspace.</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Email or username</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input id="username" placeholder="you@miaoda.com" value={username}
                      onChange={e => setUsername(e.target.value)} autoComplete="username" disabled={loading} className="h-11 pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => switchMode('reset')} className="text-xs font-medium text-primary hover:underline underline-offset-4">
                      Have a reset code?
                    </button>
                  </div>
                  <PasswordInput id="password" placeholder="Enter your password" value={password}
                    onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={loading} />
                </div>
                <label htmlFor="agreed" className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input id="agreed" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-primary shrink-0 w-4 h-4 rounded" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the <span className="text-foreground font-medium">User Agreement</span> and <span className="text-foreground font-medium">Privacy Policy</span>
                  </span>
                </label>
                <Button type="submit" size="lg" className="w-full bg-gradient-primary" disabled={loading || !agreed}>
                  {loading ? <><Loader2 className="animate-spin" /> Signing in…</> : 'Sign in'}
                </Button>
              </form>
              <p className="mt-8 text-center text-xs text-muted-foreground">
                Don't have an account? Contact your HR Administrator.
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={() => switchMode('signin')}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft size={15} /> Back to sign in
              </button>
              <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center mb-5">
                <KeyRound size={22} className="text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Reset your password</h2>
              <p className="mt-2 text-muted-foreground">Enter the one-time reset code from your administrator and choose a new password. No email confirmation needed.</p>

              <form onSubmit={handleReset} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input id="reset-email" placeholder="you@miaoda.com" value={username}
                      onChange={e => setUsername(e.target.value)} autoComplete="username" disabled={loading} className="h-11 pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Reset code</Label>
                  <Input id="reset-code" placeholder="XXXXXXXXXX" value={resetCode}
                    onChange={e => setResetCode(e.target.value.toUpperCase())} autoComplete="one-time-code" disabled={loading}
                    className="h-11 font-mono tracking-[0.3em] text-center uppercase" maxLength={14} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput id="new-password" placeholder="At least 8 characters, letters & numbers" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <PasswordInput id="confirm-password" placeholder="Re-enter the new password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
                </div>
                <Button type="submit" size="lg" className="w-full bg-gradient-primary mt-2" disabled={loading}>
                  {loading ? <><Loader2 className="animate-spin" /> Updating…</> : 'Set new password & sign in'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
