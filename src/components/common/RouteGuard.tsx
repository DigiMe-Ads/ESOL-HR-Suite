import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/routes';

interface RouteGuardProps {
  children: React.ReactNode;
}

// System-level public routes (no need to register in routes.tsx)
const SYSTEM_PUBLIC_ROUTES = ['/login', '/403', '/404'];

// Derived from routes.tsx: all routes marked with public: true
const routePublicPaths = routes.filter(r => r.public).map(r => r.path);

const PUBLIC_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routePublicPaths];

function matchPublicRoute(path: string, patterns: string[]) {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      return regex.test(path);
    }
    return path === pattern;
  });
}

// Find the matching route config for a path (supports :id params)
function findRouteConfig(path: string) {
  return routes.find(r => {
    if (r.public) return false;
    if (r.path === path) return true;
    const routeSegs = r.path.split('/');
    const pathSegs = path.split('/');
    if (routeSegs.length !== pathSegs.length) return false;
    return routeSegs.every((seg, i) => seg.startsWith(':') || seg === pathSegs[i]);
  });
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublic = matchPublicRoute(location.pathname, PUBLIC_ROUTES);

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
      return;
    }
    // A signed-in user has nothing to do on public pages (fixes the "must refresh after login" issue)
    if (user && isPublic) {
      navigate('/dashboard', { replace: true });
      return;
    }
    // Temporary password: force a password change before anything else
    if (user && profile?.must_change_password && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
      return;
    }
    // Role-based access control on protected routes
    if (user && profile && !isPublic) {
      const route = findRouteConfig(location.pathname);
      if (route?.roles && !route.roles.includes(profile.role)) {
        navigate('/403', { replace: true });
        return;
      }
    }
  }, [user, profile, loading, location.pathname, navigate, isPublic]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
