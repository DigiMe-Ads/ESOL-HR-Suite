import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Mail, MailCheck, MailWarning } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface IssuedLogin {
  name: string;
  email: string;
  tempPassword: string;
  /** null = email sent; otherwise the reason it could not be sent */
  emailError: string | null;
}

const portalUrl = () => `${window.location.origin}/login`;

/** Shown after a login is created: email status plus the temporary password as a fallback */
const LoginCredentialsDialog: React.FC<{ login: IssuedLogin | null; onClose: () => void }> = ({ login, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!login) return;
    try {
      await navigator.clipboard.writeText(login.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const openMail = () => {
    if (!login) return;
    const body = `Dear ${login.name},

Your ESOL Premier Campus portal account is ready.

Portal: ${portalUrl()}
Username: ${login.email}
Temporary password: ${login.tempPassword}

You will be asked to choose your own password when you first sign in. After that, please complete your profile (photo, NIC number, bank details) and upload your educational certificates and service letters under "My Profile".

ESOL Premier Campus HR`;
    window.location.href = `mailto:${encodeURIComponent(login.email)}?subject=${encodeURIComponent('Your ESOL Premier Campus portal login')}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Dialog open={login !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Portal login created</DialogTitle>
          <DialogDescription>{login?.name} can now sign in with <strong className="text-foreground">{login?.email}</strong>.</DialogDescription>
        </DialogHeader>

        {login && (
          <div className="space-y-4 text-sm">
            {login.emailError === null ? (
              <div className="flex gap-3 rounded-lg border border-emerald-600/20 bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <MailCheck size={18} className="shrink-0 mt-0.5" />
                <p>An email with a secure link to set their password was sent to {login.email}.</p>
              </div>
            ) : (
              <div className="flex gap-3 rounded-lg border border-amber-600/25 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <MailWarning size={18} className="shrink-0 mt-0.5" />
                <p>The login email could not be sent ({login.emailError}). Share the temporary password below instead.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="section-label">Temporary password (backup)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">{login.tempPassword}</code>
                <Button type="button" variant="outline" size="icon" onClick={copy} title="Copy password">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">They must choose their own password at first sign-in. This password is not shown again.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={openMail}><Mail size={15} /> Open in mail app</Button>
          <Button type="button" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginCredentialsDialog;
