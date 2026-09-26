import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { clearMustChangePassword } from '@/db/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

const LOGO_URL = '/esol_logo.png';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('Password must contain at least one letter and one number');
      return;
    }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    await clearMustChangePassword((await supabase.auth.getUser()).data.user!.id);
    setLoading(false);
    toast.success('Password updated successfully');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-card border-border">
        <CardHeader className="pb-4 text-center">
          <img src={LOGO_URL} alt="ESOL Premier Campus" className="h-12 object-contain mx-auto mb-4" />
          <CardTitle className="text-xl text-foreground flex items-center justify-center gap-2">
            <KeyRound size={18} className="text-primary" /> Set a New Password
          </CardTitle>
          <CardDescription>
            Your account uses a temporary password. Please create your own password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Choose a strong password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter the new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Updating...' : 'Save New Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
