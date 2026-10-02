import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { dismissNotification, getNotifications, markNotificationsRead } from '@/db/api';
import type { AppNotification } from '@/types/types';
import { cn } from '@/lib/utils';

const POLL_MS = 60_000;

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' });
};

/** Header bell: in-app notifications (e.g. "Your salary slip is ready to be picked up from HR") */
const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => { setItems(await getNotifications()); }, []);

  // Refresh on navigation and periodically (only while the tab is visible)
  useEffect(() => { load(); }, [load, pathname]);
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const unread = items.filter(n => !n.read_at);

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read_at) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await markNotificationsRead([n.id]);
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    const ids = unread.map(n => n.id);
    setItems(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    await markNotificationsRead(ids);
  };

  const dismiss = async (e: React.MouseEvent, n: AppNotification) => {
    e.stopPropagation();
    setItems(prev => prev.filter(x => x.id !== n.id));
    await dismissNotification(n.id);
  };

  return (
    <DropdownMenu open={open} onOpenChange={o => { setOpen(o); if (o) load(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0" aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}>
          <Bell size={18} />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold leading-[18px] text-white text-center">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          {unread.length > 0 && (
            <button type="button" onClick={markAll} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : items.map(n => (
            <div
              key={n.id} role="button" tabIndex={0}
              onClick={() => openItem(n)} onKeyDown={e => { if (e.key === 'Enter') openItem(n); }}
              className={cn('group relative flex gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-accent/50 outline-none focus-visible:bg-accent/50',
                !n.read_at && 'bg-primary/[0.04]')}
            >
              <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read_at ? 'bg-transparent' : 'bg-primary')} />
              <div className="min-w-0 flex-1 pr-5">
                <p className={cn('text-sm text-foreground', !n.read_at && 'font-semibold')}>{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal">{n.body}</p>}
                <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              <button type="button" onClick={e => dismiss(e, n)} aria-label="Dismiss"
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
