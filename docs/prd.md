# Requirements Document

## 1. Application Overview

**Application Name:** ESOL Premier Campus HR Platform

**Description:** A web-based HR and payroll management platform for ESOL Premier Campus (Pvt) Limited, supporting employee profile management, automated LKR salary calculations, salary slip generation, Sri Lanka statutory-compliant leave management workflows, and granular module-level access control.

**Brand Identity:**
- Primary Color: Deep Navy Blue (#1B3B8A)
- Secondary Color: White
- Currency: Sri Lankan Rupee (LKR)
- Company Logo URL: https://miaoda-conversation-file.s3cdn.medo.dev/user-dq4tds2thj40/app-egavjozgg001/20260916/Logo.png
- Company Address: No 179, High Level Road, Pannipitiya, 10230

## 2. Users and Usage Scenarios

**Target Users:**
1. Admin / HR Admin - Manages system users, granular access permissions, employee master data, payroll processing, salary slips, and organization-wide leave requests.
2. Manager - Reviews and approves/rejects leave applications for departmental team members.
3. Finance / Specialized Staff - Users assigned specific access permissions (e.g., viewing and processing salary records and salary slips only).
4. Staff / Employee - Views personal profile, submits leave applications, and views/downloads personal salary slips.

**Core Usage Scenarios:**
- Admin creates user profiles, assigns a base role, and selects specific module access permissions via checkboxes (e.g., granting a Finance user access only to Salary Management and Salary Slips).
- Admin updates permissions for existing users at any time without resetting passwords.
- Users log in and see only the navigation items and pages they are explicitly granted access to, with unauthorized route access blocked.
- HR Admin processes monthly payroll where payroll period dates (25th of prior month to 24th of current month) and days worked/on leave are auto-populated.
- Staff members submit leave requests governed by statutory Sri Lankan leave rules.
- HR Admin and Employees generate and download clean salary slips.

## 3. Page Structure and Functionality

### 3.1 Page Hierarchy

```
HR Platform
├── Authentication
│   ├── Login Page
│   └── Password Setup / Reset Page
├── Dashboard (Access Controlled)
├── User & Employee Management (Access Controlled)
│   ├── Employee & User List
│   ├── Add / Create Employee & User (with Module Permission Checkboxes)
│   ├── Edit Employee & Permissions
│   └── Employee Profile Details
├── Salary Management (Access Controlled)
│   ├── Add Salary Entry
│   ├── Edit Salary Entry
│   └── Salary History
├── Salary Slips (Access Controlled)
│   ├── Salary Slip Generation List
│   └── Salary Slip View & Download
├── Leave Management (Access Controlled)
│   ├── Apply Leave
│   ├── Leave History & Balance
│   ├── Leave Approval Requests
│   └── Leave Policy Configuration
└── Profile Management (All Authenticated Users)
```

### 3.2 Detailed Page Functionality

#### 3.2.1 Authentication & User Lifecycle

**Login Page:**
- User inputs email (acting as username) and password.
- On successful credential verification, system establishes session state, loads user permissions, and redirects to the first authorized module or dashboard.
- Provides clear error message upon invalid credentials.

**Password Setup & Reset:**
- New users arriving via onboarding email link log in with temporary credentials and create a permanent password upon initial login.
- Admin / HR Admin can trigger a password reset for any user from User Management.

#### 3.2.2 Dashboard (Module-Controlled)

- Rendered dynamically based on granted module permissions.
- Displays widgets relevant only to modules the logged-in user can access (e.g., active employee counts if Employee Management is granted; pending leave counts if Leave Management is granted; payroll summaries if Salary Management is granted).

#### 3.2.3 User & Employee Management (Access-Controlled)

**Employee & User List:**
- Displays staff records with columns: Employee ID, Full Name, Email, Base Role, Granted Modules, Status (Active / Resigned), and Actions.
- Filters by status (Active / Resigned) and search by Name or Employee ID.
- Actions:
  - Edit Details & Permissions
  - Reset Password
  - Change Status (Active / Resigned)

**Add / Create Employee & User:**
- Input fields without placeholder text:
  - First Name, Last Name
  - Email Address (used as Platform Username)
  - Phone Number
  - Employee ID
  - Employment Commencement Date
  - Designation
  - Base Role Selection (Admin, HR Admin, Manager, Staff)
  - Bank Name, Branch, Account Number
- **Module Access Permission Checkboxes:**
  - Available module checkboxes: Dashboard, Employee Management, Leave Management, Salary Management, Salary Slips, User Management.
  - Selecting a Base Role automatically pre-checks default modules for that role as a preset.
  - Admin can freely tick or untick individual module checkboxes to customize access (e.g., selecting Staff role and ticking only Salary Management and Salary Slips for a Finance officer).
  - Admin users always have all module checkboxes ticked and locked to prevent lockout.
- On creation:
  - System creates user account, employee profile, and stores granted module permissions.
  - Automatically dispatches an onboarding email containing the login URL, a temporary password, and setup instructions.

**Edit Employee & Permissions:**
- Update personal, employment, and banking details.
- Permission management section allowing Admin to modify module checkboxes for the selected user.
- Update employment status (Active / Resigned).

#### 3.2.4 Salary Management (Access-Controlled)

**Add Salary Entry:**
- Select employee from dropdown and select Salary Month (e.g., September 2026).
- Auto-Populated Payroll Period: 25th of previous month to 24th of selected month.
- Auto-Populated Days: Actual Working Days and Approved Leave Entitlement Days in the period.
- Salary Component Inputs (in LKR): Basic Salary, Transportation Allowance, Education Allowance.
- Auto-Calculations (LKR): Total Pay, Daily Allocation (Component / 30), Total Days Entitled (Working Days + Leave Days), Gross Earning, EPF Employer (12%), ETF (3%), EPF Employee (8%), Stamp Duty (LKR 25), Total Deductions, Net Pay.
- Save salary entry.

**Edit Salary Entry:**
- Modify entry parameters with real-time recalculation.

**Salary History:**
- View, search, and filter historical monthly salary records.

#### 3.2.5 Salary Slips (Access-Controlled)

**Salary Slip Management:**
- Dedicated navigation accessible by users with Salary Slips permission.
- Users with administrative/finance access can select any employee and payroll period to generate or download salary slips.
- Regular staff view and download their own personal historical salary slips.

**Salary Slip Layout & Download:**
- Printable and PDF-downloadable layout.
- **Slip Content (General Information Only - Formulas hidden):**
  - Top Header: ESOL Premier Campus logo, company name, address, title \"Salary Slip\".
  - Employee Info: Employee ID, Full Name, Designation, Commencement Date, Bank, Branch, Account Number, Pay Period.
  - Earnings (LKR): Basic Salary, Transportation Allowance, Education Allowance, Total Gross Pay.
  - Deductions (LKR): EPF Employee (8%), Stamp Duty (LKR 25), Total Deductions.
  - Summary: Net Payable Amount (LKR).
  - Employer Contributions: EPF Employer (12%), ETF (3%).
  - Signatory section: \"HR Manager\" designation and date.
- Action buttons: \"Download PDF\" and \"Print Slip\".

#### 3.2.6 Leave Management (Access-Controlled)

**Apply Leave:**
- Select Leave Type: Annual Leave, Casual Leave, Sick Leave, Maternity Leave, Other.
- Select Start Date and End Date, enter Reason.
- Validation checks against statutory and balance rules.

**Leave History & Balance:**
- Real-time balance tracker by leave category.
- Table of past leave requests with status and reviewer remarks.

**Leave Requests & Approvals:**
- Accessible by users with Leave Management review permissions.
- Actions: Approve or Reject with optional remarks.

**Leave Policy Configuration:**
- Accessible by HR Admin to adjust organizational leave parameters.

#### 3.2.7 Profile Management (All Authenticated Users)

- View personal contact details and employment information.
- Change password functionality.

## 4. Business Rules and Logic

### 4.1 Granular Access Control Rules

1. **Module Keys:** Supported module permissions are:
   - `dashboard`: Access to overview dashboard.
   - `employees`: Access to Employee List and employee profile details.
   - `leaves`: Access to leave application, leave history, and leave approvals.
   - `salary_management`: Access to create, edit, and view salary calculation entries.
   - `salary_slips`: Access to generate, view, and download salary slips.
   - `user_management`: Access to create users, assign permissions, and manage accounts.
2. **Role-Based Default Presets:**
   - `admin`: All modules enabled (locked, cannot be deselected).
   - `hr_admin`: `dashboard`, `employees`, `leaves`, `salary_management`, `salary_slips`.
   - `manager`: `dashboard`, `leaves`.
   - `staff`: `dashboard`, `leaves` (self only), `salary_slips` (self only).
3. **Custom Permission Overrides:** Admin can check/uncheck any module for any non-admin user during creation or via Edit Permissions.
4. **Navigation & Route Protection:**
   - Sidebar navigation hides links to modules not granted to the user.
   - Route guards block direct URL navigation to unauthorized modules, redirecting to the first authorized page or an unauthorized access notice.
5. **Backend Authorization:** Data operations for each module enforce user permission verification on backend requests.
6. **Existing Users Migration:** Existing user profiles are backfilled with permission lists corresponding to their current base role defaults.

### 4.2 Sri Lankan Statutory Leave Rules

1. **Annual Leave (14 Days / Year):**
   - Year 1 of Service: 0 days entitlement.
   - Year 2 of Service: Pro-rated based on Year 1 joining date:
     - Jan 1 – Mar 31: 14 days
     - Apr 1 – Jun 30: 10 days
     - Jul 1 – Sep 30: 7 days
     - Oct 1 – Dec 31: 4 days
   - Year 3 onwards: Full 14 days credited at start of calendar year.
   - Usage constraint: At least 7 days taken consecutively.
2. **Casual Leave (7 Days / Year):**
   - Year 1 of Service: Accrues at 1 day for every 2 completed months of continuous service.
   - Year 2 onwards: Full 7 days credited at start of calendar year.
   - Expiry: Unused casual leave lapses at calendar year-end.
3. **Maternity Leave (84 Days):** 84 consecutive days with full pay for live child delivery; 42 days for non-live birth.

### 4.3 Payroll & Salary Calculation Rules

1. **Currency:** All monetary values displayed and stored in LKR.
2. **Automatic Period Mapping:** Selecting Month M sets start date to 25th of Month M-1 and end date to 24th of Month M.
3. **Automatic Days Extraction:** Working Days and Leave Days are automatically summed from employee records for the 25th-to-24th cycle.
4. **Calculations:**
   - Total Days Entitled = Actual Working Days + Leave Entitlement Days
   - Basic Earned = (Basic Salary / 30) × Total Days Entitled
   - Allowances Earned = ((Transportation + Education) / 30) × Total Days Entitled
   - Gross Pay = Basic Earned + Allowances Earned
   - EPF Employer = 12% of Basic Earned
   - ETF = 3% of Basic Earned
   - EPF Employee = 8% of Basic Earned
   - Stamp Duty = LKR 25
   - Net Pay = Gross Pay - (EPF Employee + Stamp Duty)
5. **Slip Presentation:** Salary slips display final earnings, deductions, and net pay without showing internal calculation formula steps.

## 5. Exceptions and Boundary Cases

| Scenario | Handling |
|----------|----------|
| User navigates directly to unauthorized module URL | Route guard blocks access and redirects to first accessible page with access denied notice |
| User with zero granted modules logs in | Redirect to personal Profile Management page only |
| Attempting to deselect admin full permissions | Admin role has all module checkboxes permanently selected and disabled from modification |
| Annual leave request with less than 7 consecutive days when taking primary block | Warn or validate based on organization consecutive leave rule |
| Year 1 employee applying for Annual Leave | Prevent selection with notice that annual entitlement begins in Year 2 |
| Casual leave requested exceeding accrued 2-month rate in Year 1 | Block submission and display available accrued casual days |
| Offboarded employee marked as Resigned | Account deactivated for login; historical records preserved |
| Duplicate salary processing for same employee in same payroll month | Block submission and display duplicate payroll warning |

## 6. Acceptance Criteria

1. Admin creates a new user, selects a base role, observes default module checkboxes populated, and customizes access (e.g., enables only Salary Management and Salary Slips for a Finance user); the user receives onboarding credentials.
2. User with customized permissions logs in; the sidebar displays only the granted modules (e.g., Salary Management and Salary Slips) and direct URL access to unassigned modules (e.g., /leaves, /employees) is blocked.
3. Admin edits an existing user's permissions via checkbox adjustments, and the user's accessible modules update immediately upon next navigation.
4. Existing system users retain their expected access rights based on automated permission backfill matching their base roles.
5. HR Admin/Finance user opens Add Salary, selects salary month, verifies auto-populated 25th-to-24th period and days, and saves calculated salary in LKR.
6. Authorized users generate and download salary slips in PDF format with company logo, general details, and clean net amounts without calculation mechanics.
7. Staff submit leave requests adhering to Sri Lankan statutory rules, and balances update accurately upon approval.

## 7. Out of Scope for This Release

- Biometric machine physical hardware integration
- Bulk payroll export to third-party bank clearing network file formats
- Multi-currency payroll processing outside of LKR
- Automated income tax (APIT) bracket calculation engine
- Performance appraisal and KPI scoring modules