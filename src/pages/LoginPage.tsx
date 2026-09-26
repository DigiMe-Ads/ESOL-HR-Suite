import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield } from 'lucide-react';

const LOGO_URL = '/esol_logo.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error('Please agree to the User Agreement and Privacy Policy'); return; }
    if (!username.trim() || !password.trim()) { toast.error('Please enter your email/username and password'); return; }
    setLoading(true);
    // The email address is the username; bare usernames map to the platform domain
    const raw = username.trim().toLowerCase();
    const email = raw.includes('@') ? raw : `${raw}@miaoda.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error('Invalid email/username or password');
      return;
    }
    // Navigate immediately — no page refresh needed. RouteGuard will force a
    // password change redirect if the account still uses a temporary password.
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? '/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — white with navy grid */}
      <div className="hidden md:flex md:w-1/2 bg-background flex-col items-center justify-center p-12 relative overflow-hidden border-r border-border">
        <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(27,59,138,0.06) 40px,rgba(27,59,138,0.06) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(27,59,138,0.06) 40px,rgba(27,59,138,0.06) 41px)' }} />
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <img src={LOGO_URL} alt="ESOL Premier Campus" className="w-56 mb-8" />
          <h1 className="text-2xl font-semibold mb-3 text-primary">HR Management Platform</h1>

          <div className="mt-10 flex flex-col gap-3 w-full">
            {['Employee Management', 'Salary Slip Generation', 'Leave Approvals'].map(f => (
              <div key={f} className="flex items-center gap-3 bg-muted border border-border rounded-md px-4 py-2.5">
                <Shield size={16} className="text-accent shrink-0" />
                <span className="text-sm text-foreground/80">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="absolute bottom-6 text-xs text-muted-foreground">ESOL Premier Campus (Pvt) Limited · No 179, High Level Road, Pannipitiya, 10230</p>
      </div>
      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-card border-border">
          <CardHeader className="pb-4">
            <div className="flex md:hidden justify-center mb-4">
              <img src={LOGO_URL} alt="ESOL Premier Campus" className="h-12 object-contain" />
            </div>
            <CardTitle className="text-xl text-foreground">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the HR platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Email or Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your email address"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1">
                <input
                  id="agreed" type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 accent-primary shrink-0 w-4 h-4"
                />
                <Label htmlFor="agreed" className="text-xs text-muted-foreground leading-relaxed font-normal cursor-pointer">
                  I agree to the{' '}
                  <span className="text-primary underline cursor-pointer">User Agreement</span>
                  {' '}and{' '}
                  <span className="text-primary underline cursor-pointer">Privacy Policy</span>
                </Label>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={loading || !agreed}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Don't have an account? Contact your HR Administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
