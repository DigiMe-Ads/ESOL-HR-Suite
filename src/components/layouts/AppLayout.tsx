import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission, routes as routeConfigs } from '@/routes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Users, DollarSign, FileText, CalendarCheck, Settings,
  LogOut, Menu, ChevronRight, UserCog, FileDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LOGO_URL = '/esol_logo.png';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// Nav entries map to route configs; visibility = route permission
const navItems: Array<NavItem & { routePath: string }> = [
  { label: 'Dashboard', path: '/dashboard', routePath: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Employees', path: '/employees', routePath: '/employees', icon: <Users size={18} /> },
  { label: 'Add Salary', path: '/salary/new', routePath: '/salary/new', icon: <DollarSign size={18} /> },
  { label: 'Salary Slips', path: '/salary-slips', routePath: '/salary-slips', icon: <FileDown size={18} /> },
  { label: 'Salary History', path: '/salary-history', routePath: '/salary-history', icon: <FileText size={18} /> },
  { label: 'Leave Requests', path: '/leave-requests', routePath: '/leave-requests', icon: <CalendarCheck size={18} /> },
  { label: 'My Leaves', path: '/my-leaves', routePath: '/my-leaves', icon: <CalendarCheck size={18} /> },
  { label: 'User Management', path: '/users', routePath: '/users', icon: <UserCog size={18} /> },
  { label: 'Leave Config', path: '/leave-config', routePath: '/leave-config', icon: <Settings size={18} /> },
];

const NavContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role ?? 'staff';

  // Show "My Leaves" instead of "Leave Requests" for staff-like roles
  const isReviewer = profile?.role === 'admin' || profile?.role === 'hr_admin' || profile?.role === 'manager';
  const visibleItems = navItems.filter(item => {
    if (item.path === '/my-leaves' && isReviewer) return false;
    if (item.path === '/leave-requests' && !isReviewer) return false;
    const cfg = routeConfigs.find(r => r.path === item.routePath);
    return cfg ? hasRoutePermission(cfg, profile) : false;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <img src={LOGO_URL} alt="ESOL" className="h-8 object-contain brightness-200" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-sidebar-foreground/90 leading-tight truncate">ESOL Premier</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">Campus HR</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-label px-2 mb-2 text-sidebar-foreground/40">Navigation</p>
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-100',
              isActive
                ? 'bg-sidebar-accent text-white font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
            <ChevronRight size={14} className="shrink-0 opacity-40" />
          </NavLink>
        ))}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-accent">
              {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {({ admin: 'Administrator', hr_admin: 'HR User', manager: 'Manager', finance: 'Finance', staff: 'Staff' } as const)[role] ?? 'Staff'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          onClick={handleSignOut}
        >
          <LogOut size={15} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border">
        <NavContent />
      </aside>

      {/* Mobile header + Sheet */}
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={LOGO_URL} alt="ESOL" className="h-7 object-contain" />
          <span className="text-sm font-semibold text-foreground truncate">HR Platform</span>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
