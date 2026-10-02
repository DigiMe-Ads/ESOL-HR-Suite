import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, Users, Wallet, FileText, CalendarCheck, CalendarDays, Settings2,
  LogOut, Menu, UserCog, Receipt, KeyRound, ChevronsUpDown, CalendarClock, UserRound, Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandMark, CREST_URL } from '@/components/common/BrandLogo';
import NotificationBell from '@/components/common/NotificationBell';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', hr_admin: 'HR User', manager: 'Manager', finance: 'Finance', staff: 'Staff',
};

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

// Nav entries map to route configs; visibility = route permission
const navGroups: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Overview', items: [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'My Profile', path: '/my-profile', icon: UserRound },
  ] },
  { title: 'People', items: [
    { label: 'Employees', path: '/employees', icon: Users },
  ] },
  { title: 'Payroll', items: [
    { label: 'Add Salary', path: '/salary/new', icon: Wallet },
    { label: 'Salary Slips', path: '/salary-slips', icon: Receipt },
    { label: 'Slip Requests', path: '/slip-requests', icon: Inbox },
    { label: 'Salary History', path: '/salary-history', icon: FileText },
  ] },
  { title: 'Time Off', items: [
    { label: 'Leave Requests', path: '/leave-requests', icon: CalendarCheck },
    { label: 'My Leaves', path: '/my-leaves', icon: CalendarDays },
    { label: 'Leave Config', path: '/leave-config', icon: Settings2 },
  ] },
  { title: 'Administration', items: [
    { label: 'User Management', path: '/users', icon: UserCog },
  ] },
];

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Resolve the current route's display name (supports :id params)
function useRouteTitle(): string {
  const { pathname } = useLocation();
  const match = routeConfigs.find(r => {
    const routeSegs = r.path.split('/');
    const pathSegs = pathname.split('/');
    if (routeSegs.length !== pathSegs.length) return false;
    return routeSegs.every((seg, i) => seg.startsWith(':') || seg === pathSegs[i]);
  });
  return match?.name ?? 'HR Platform';
}

const UserMenu: React.FC<{ variant: 'sidebar' | 'header' }> = ({ variant }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const role = ROLE_LABELS[profile?.role ?? 'staff'] ?? 'Staff';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const avatar = (
    <div className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 ring-2 ring-white/10 shadow-glow">
      <span className="text-xs font-bold text-white tracking-wide">{initials(profile?.full_name)}</span>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'sidebar' ? (
          <button type="button" className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name ?? 'User'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{role}</p>
            </div>
            <ChevronsUpDown size={15} className="text-sidebar-foreground/40 shrink-0" />
          </button>
        ) : (
          <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {avatar}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === 'sidebar' ? 'start' : 'end'} side={variant === 'sidebar' ? 'top' : 'bottom'} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name ?? 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          <span className="pill pill-info mt-2 normal-case">{role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/my-profile')} className="cursor-pointer">
          <UserRound size={15} /> My profile & documents
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/change-password')} className="cursor-pointer">
          <KeyRound size={15} /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50">
          <LogOut size={15} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NavContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { profile } = useAuth();

  // Reviewers see both "Leave Requests" and their own "My Leaves"; visibility follows route permissions
  const isVisible = (item: NavItem) => {
    const cfg = routeConfigs.find(r => r.path === item.path);
    return cfg ? hasRoutePermission(cfg, profile) : false;
  };
  const groups = navGroups
    .map(g => ({ ...g, items: g.items.filter(isVisible) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="relative flex flex-col h-full bg-sidebar overflow-hidden">
      {/* Ambient globe glow + orbit arcs, echoing the logo's globe */}
      <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-brand-globe/30 blur-3xl" />
      <div className="orbit-ring -top-28 -right-24 h-56 w-56 rotate-12" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-brand-sky/10 blur-3xl" />

      {/* Brand */}
      <div className="relative px-5 pt-5 pb-4 shrink-0">
        <BrandMark tone="dark" />
        <div className="mt-4 h-px bg-gradient-to-r from-brand-sky/40 via-sidebar-border to-transparent" />
      </div>

      {/* Nav */}
      <nav className="relative flex-1 px-3 py-3 space-y-5 overflow-y-auto">
        {groups.map(group => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/35">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/my-leaves'}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive
                        ? 'bg-gradient-to-r from-brand-globe/30 to-brand-globe/5 text-white font-medium'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={cn(
                          'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0'
                        )} />
                        <Icon size={17} className={cn('shrink-0 transition-colors', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-white')} />
                        <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="relative border-t border-sidebar-border p-3">
        <UserMenu variant="sidebar" />
      </div>
    </div>
  );
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = useRouteTitle();
  const today = new Date().toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[264px] shrink-0 sticky top-0 h-screen">
        <NavContent />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden bg-app">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 h-16 px-4 md:px-8 border-b border-border/70 bg-background/75 backdrop-blur-xl shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[264px] bg-sidebar border-sidebar-border">
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={CREST_URL} alt="ESOL" className="md:hidden h-8 w-8 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80 hidden sm:block">ESOL Premier Campus</p>
            <p className="font-display text-[15px] font-semibold text-foreground truncate leading-tight">{title}</p>
          </div>
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            <CalendarClock size={14} className="text-primary" />
            {today}
          </div>
          <div className="md:hidden">
            <UserMenu variant="header" />
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
