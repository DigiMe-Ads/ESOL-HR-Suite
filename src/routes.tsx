import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import EmployeeListPage from './pages/employees/EmployeeListPage';
import EmployeeFormPage from './pages/employees/EmployeeFormPage';
import EmployeeDetailPage from './pages/employees/EmployeeDetailPage';
import SalaryFormPage from './pages/salary/SalaryFormPage';
import SalaryHistoryPage from './pages/salary/SalaryHistoryPage';
import SalarySlipPage from './pages/salary/SalarySlipPage';
import SalarySlipsPage from './pages/salary/SalarySlipsPage';
import ApplyLeavePage from './pages/leave/ApplyLeavePage';
import MyLeavesPage from './pages/leave/MyLeavesPage';
import LeaveRequestsPage from './pages/leave/LeaveRequestsPage';
import LeaveConfigPage from './pages/leave/LeaveConfigPage';
import UserManagementPage from './pages/UserManagementPage';
import ForbiddenPage from './pages/ForbiddenPage';
import MyProfilePage from './pages/MyProfilePage';

import type { Permission, Profile } from '@/types/types';

export function hasRoutePermission(route: RouteConfig, profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (route.roles && !route.roles.includes(profile.role)) return false;
  if (route.permission) return (profile.permissions ?? []).includes(route.permission);
  return true;
}

// First page a user may actually open (fallback when /dashboard is not granted)
const LANDING_PRIORITY: string[] = ['/dashboard', '/salary-slips', '/salary-history', '/salary/new', '/employees', '/leave-requests', '/my-leaves', '/users', '/my-profile', '/change-password'];

export function getFirstPermittedPath(profile: Profile | null): string {
  if (!profile) return '/403';
  for (const path of LANDING_PRIORITY) {
    const route = routes.find(r => r.path === path);
    if (route && hasRoutePermission(route, profile)) return path;
  }
  return '/change-password';
}

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
  roles?: string[];
  /** Required module permission — users without it are redirected to /403 */
  permission?: Permission;
}

export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Access Denied', path: '/403', element: <ForbiddenPage />, visible: false },
  { name: 'Change Password', path: '/change-password', element: <ChangePasswordPage /> },
  { name: 'Dashboard', path: '/dashboard', element: <DashboardPage />, permission: 'dashboard' },
  { name: 'My Profile', path: '/my-profile', element: <MyProfilePage /> },

  // Employee management
  { name: 'Employees', path: '/employees', element: <EmployeeListPage />, permission: 'employees' },
  { name: 'Add Employee', path: '/employees/new', element: <EmployeeFormPage />, permission: 'employees', roles: ['admin', 'hr_admin'] },
  { name: 'Edit Employee', path: '/employees/:id/edit', element: <EmployeeFormPage />, permission: 'employees', roles: ['admin', 'hr_admin'] },
  { name: 'Employee Detail', path: '/employees/:id', element: <EmployeeDetailPage />, permission: 'employees' },

  // Salary management
  { name: 'Add Salary', path: '/salary/new', element: <SalaryFormPage />, permission: 'salary_management', roles: ['admin', 'hr_admin', 'finance'] },
  { name: 'Edit Salary', path: '/salary/:id/edit', element: <SalaryFormPage />, permission: 'salary_management', roles: ['admin', 'hr_admin', 'finance'] },
  { name: 'Salary Slip', path: '/salary/:id/slip', element: <SalarySlipPage />, permission: 'salary_slips' },
  { name: 'Salary Slips', path: '/salary-slips', element: <SalarySlipsPage />, permission: 'salary_slips' },
  { name: 'Salary History', path: '/salary-history', element: <SalaryHistoryPage />, permission: 'salary_management' },

  // Leave management
  { name: 'My Leaves', path: '/my-leaves', element: <MyLeavesPage />, permission: 'leaves' },
  { name: 'Apply Leave', path: '/my-leaves/apply', element: <ApplyLeavePage />, permission: 'leaves' },
  { name: 'Leave Requests', path: '/leave-requests', element: <LeaveRequestsPage />, permission: 'leaves', roles: ['admin', 'hr_admin', 'manager'] },
  { name: 'Leave Config', path: '/leave-config', element: <LeaveConfigPage />, roles: ['admin', 'hr_admin'] },

  // User management
  { name: 'Users', path: '/users', element: <UserManagementPage />, permission: 'user_management' },
];
