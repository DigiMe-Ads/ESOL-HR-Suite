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

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
  roles?: string[];
}

export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Access Denied', path: '/403', element: <ForbiddenPage />, visible: false, roles: ['admin', 'hr_admin', 'manager', 'staff'] },
  { name: 'Change Password', path: '/change-password', element: <ChangePasswordPage />, roles: ['admin', 'hr_admin', 'manager', 'staff'] },
  { name: 'Dashboard', path: '/dashboard', element: <DashboardPage />, roles: ['admin', 'hr_admin', 'manager', 'staff'] },

  // Employee management
  { name: 'Employees', path: '/employees', element: <EmployeeListPage />, roles: ['admin', 'hr_admin', 'manager'] },
  { name: 'Add Employee', path: '/employees/new', element: <EmployeeFormPage />, roles: ['admin', 'hr_admin'] },
  { name: 'Edit Employee', path: '/employees/:id/edit', element: <EmployeeFormPage />, roles: ['admin', 'hr_admin'] },
  { name: 'Employee Detail', path: '/employees/:id', element: <EmployeeDetailPage />, roles: ['admin', 'hr_admin', 'manager'] },

  // Salary management
  { name: 'Add Salary', path: '/salary/new', element: <SalaryFormPage />, roles: ['admin', 'hr_admin'] },
  { name: 'Edit Salary', path: '/salary/:id/edit', element: <SalaryFormPage />, roles: ['admin', 'hr_admin'] },
  { name: 'Salary Slip', path: '/salary/:id/slip', element: <SalarySlipPage />, roles: ['admin', 'hr_admin', 'manager', 'staff'] },
  { name: 'Salary Slips', path: '/salary-slips', element: <SalarySlipsPage />, roles: ['admin', 'hr_admin', 'manager', 'staff'] },
  { name: 'Salary History', path: '/salary-history', element: <SalaryHistoryPage />, roles: ['admin', 'hr_admin', 'manager', 'staff'] },

  // Leave management
  { name: 'My Leaves', path: '/my-leaves', element: <MyLeavesPage />, roles: ['staff'] },
  { name: 'Apply Leave', path: '/my-leaves/apply', element: <ApplyLeavePage />, roles: ['staff'] },
  { name: 'Leave Requests', path: '/leave-requests', element: <LeaveRequestsPage />, roles: ['admin', 'hr_admin', 'manager'] },
  { name: 'Leave Config', path: '/leave-config', element: <LeaveConfigPage />, roles: ['admin'] },

  // User management
  { name: 'Users', path: '/users', element: <UserManagementPage />, roles: ['admin'] },
];
