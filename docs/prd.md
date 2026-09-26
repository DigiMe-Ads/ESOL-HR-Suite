# Requirements Document

## 1. Application Overview

**Application Name:** ESOL Premier Campus HR Platform

**Description:** A web-based HR management system for ESOL Premier Campus (Pvt) Limited, supporting employee profile management, automated LKR salary calculations, streamlined salary slip generation and downloading, and Sri Lanka statutory-compliant leave management workflows.

**Brand Identity:**
- Primary Color: Deep Navy Blue (#1B3B8A)
- Secondary Color: White
- Currency: Sri Lankan Rupee (LKR)
- Company Logo URL: https://miaoda-conversation-file.s3cdn.medo.dev/user-dq4tds2thj40/app-egavjozgg001/20260916/Logo.png
- Company Address: No 179, High Level Road, Pannipitiya, 10230

## 2. Users and Usage Scenarios

**Target Users:**
1. HR Admin - Manages employee master data, user accounts, payroll processing, salary slip generation, and organization-wide leave requests.
2. Manager - Reviews and approves/rejects leave applications for departmental team members.
3. Staff/Employee - Views personal profile, submits leave applications, and views/downloads personal salary slips.

**Core Usage Scenarios:**
- HR Admin creates user profiles with email and phone numbers, sending system onboarding emails with temporary passwords.
- HR Admin processes monthly payroll where payroll period dates (25th of prior month to 24th of current month) and days worked/on leave are auto-populated.
- HR Admin and Employees generate and download clean salary slips without internal calculation formulas.
- Staff members submit leave requests governed by statutory Sri Lankan leave rules.
- HR Admin transitions offboarded employees to \"Resigned\" status.

## 3. Page Structure and Functionality

### 3.1 Page Hierarchy

```
HR Platform
├── Authentication
│   ├── Login Page
│   └── Password Setup / Reset Page
├── Dashboard (Role-based)
│   ├── HR Admin Dashboard
│   ├── Manager Dashboard
│   └── Staff Dashboard
├── User & Employee Management (HR Admin)
│   ├── Employee List
│   ├── Add / Create Employee & User
│   ├── Edit Employee
│   └── Employee Profile Details
├── Salary Management (HR Admin)
│   ├── Add Salary Entry
│   ├── Edit Salary Entry
│   └── Salary History
├── Salary Slips (HR Admin / Staff)
│   ├── Salary Slip Generation List
│   └── Salary Slip View & Download
├── Leave Management
│   ├── Apply Leave (Staff)
│   ├── Leave History & Balance (Staff)
│   ├── Leave Approval Requests (Manager / HR Admin)
│   └── Leave Policy Configuration (HR Admin)
└── Profile Management (All Users)
```

### 3.2 Detailed Page Functionality

#### 3.2.1 Authentication & User Lifecycle

**Login Page:**
- User inputs email (acting as username) and password.
- On successful credential verification, system immediately establishes session state and redirects to the role-specific dashboard without requiring a manual page refresh.
- Provides clear error message upon invalid credentials.

**Password Setup & Reset:**
- New users arriving via the onboarding email link use their temporary credentials and are prompted to create a new secure password upon initial login.
- HR Admin can trigger a password reset for any user from the User/Employee Management backend, sending an automated reset link/temporary password to the user's registered email.

#### 3.2.2 Dashboard

**HR Admin Dashboard:**
- Key metrics: total active employees, resigned count, pending leave requests, and recent payroll entries.
- Quick links to User Creation, Add Salary, Salary Slips, and Leave Requests.

**Manager Dashboard:**
- Team size count and pending team leave approvals.
- Quick access to leave review queue.

**Staff Dashboard:**
- Current leave balances by category (Annual, Casual, Maternity, etc.).
- Quick access to Apply Leave and the most recent salary slips.

#### 3.2.3 Employee & User Management (HR Admin)

**Employee List:**
- Displays all staff records with columns: Employee ID, Full Name, Email, Designation, Bank, Status (Active / Resigned), and Actions.
- Filters by status (Active / Resigned) and search by Name or Employee ID.
- Action to change status to \"Resigned\" when an employee departs the organization.

**Add / Create Employee & User:**
- Clean input fields without \"e.g.\" placeholder text:
  - First Name
  - Last Name
  - Email Address (used as Platform Username)
  - Phone Number
  - Employee ID
  - Employment Commencement Date
  - Designation
  - Role (HR Admin, Manager, Staff)
  - Bank Name, Branch, Account Number
- On creation:
  - System creates user account and employee record.
  - Automatically dispatches an onboarding email containing the login URL, a temporary password, and instructions to set a permanent password upon first login.

**Edit Employee:**
- Update existing personal, employment, and banking details.
- Allows changing employment status between \"Active\" and \"Resigned\".
- Reset Password button to generate and email new temporary credentials.

#### 3.2.4 Salary Management (HR Admin)

**Add Salary Entry:**
- Form fields without \"e.g.\" placeholders.
- Select employee from dropdown.
- Select Salary Month (e.g., September 2026).
- Auto-Populated Payroll Period: Automatically sets the date range from the 25th of the previous month to the 24th of the selected month (e.g., selecting September 2026 sets 25th August 2026 to 24th September 2026).
- Auto-Populated Days: Automatically extracts and populates:
  - Actual Working Days worked in the period from records.
  - Approved Leave Entitlement Days falling within the period.
- Salary Component Inputs (in LKR):
  - Basic Salary
  - Transportation Allowance
  - Education Allowance
- Auto-Calculation Summary:
  - Total Pay = Basic + Transportation + Education
  - Daily Allocation = Component / 30
  - Total Days Entitled = Working Days + Leave Days
  - Gross Earning = Total Days Entitled × Daily Total Pay
  - EPF Employer (12%) & ETF (3%) based on Basic earned
  - EPF Employee (8%) & Stamp Duty (LKR 25)
  - Total Deductions & Net Pay in LKR
- Save salary entry.

**Edit Salary Entry:**
- Edit existing entry parameters with automatic recalculation.

**Salary History:**
- View, search, and filter historical monthly salary entries.

#### 3.2.5 Salary Slips (Dedicated Tab for HR Admin & Staff)

**Salary Slip Management:**
- Dedicated navigation tab accessible by HR Admin and all Staff.
- HR Admin can select any employee and payroll period to generate or download salary slips.
- Staff members can view and download their own historical salary slips.

**Salary Slip Template & Download:**
- Clean, printable, and PDF-downloadable layout.
- **Slip Content (General Information Only - Calculation mechanics hidden):**
  - Top Header: ESOL Premier Campus logo, company name, address, and document title \"Salary Slip\".
  - Employee Information: Employee ID, Employee Full Name, Designation, Commencement Date, Bank, Branch, Account Number, Pay Period.
  - Earnings (LKR): Basic Salary, Transportation Allowance, Education Allowance, Total Gross Pay.
  - Deductions (LKR): EPF Employee (8%), Stamp Duty (LKR 25), Total Deductions.
  - Summary: Net Payable Amount (LKR).
  - Employer Contributions (for statutory record): EPF Employer (12%), ETF (3%).
  - Signatory section with \"HR Manager\" designation and date.
- Action buttons: \"Download PDF\" and \"Print Slip\".

#### 3.2.6 Leave Management

**Apply Leave (Staff):**
- Form without \"e.g.\" placeholder text.
- Select Leave Type: Annual Leave, Casual Leave, Sick Leave (via Casual allocation/policy), Maternity Leave, or Other.
- Select Start Date and End Date.
- Enter Reason.
- Validation checks against statutory and balance rules before submission.

**Leave History & Balance (Staff):**
- Real-time balance tracker broken down by category.
- Table of past leave requests with Status (Pending, Approved, Rejected) and reviewer comments.

**Leave Requests (Manager & HR Admin):**
- Managers review direct reports' pending requests.
- HR Admin reviews organization-wide requests.
- Actions: Approve or Reject with optional remarks.

**Leave Policy Configuration (HR Admin):**
- View and adjust organization leave parameters based on employment guidelines.

#### 3.2.7 Profile Management

**All Users:**
- View personal contact details and employment information.
- Change password functionality.

## 4. Business Rules and Logic

### 4.1 Sri Lankan Statutory Leave Rules

1. **Annual Leave (14 Days / Year):**
   - Year 1 of Service: 0 days entitlement.
   - Year 2 of Service: Pro-rated based on Year 1 joining date:
     - Joined Jan 1 – Mar 31: 14 days
     - Joined Apr 1 – Jun 30: 10 days
     - Joined Jul 1 – Sep 30: 7 days
     - Joined Oct 1 – Dec 31: 4 days
   - Year 3 onwards: Full 14 days credited at start of year.
   - Usage constraint: At least 7 days must be taken consecutively.
2. **Casual Leave (7 Days / Year):**
   - Year 1 of Service: Accrues at the rate of 1 day for every 2 completed months of continuous service.
   - Year 2 onwards: Full 7 days credited at start of calendar year.
   - Expiry: All unused casual leave lapses automatically at calendar year-end.
3. **Sick Leave:**
   - Statutorily covered under the 7-day Casual Leave quota under the Shop and Office Employees Act unless extended via company policy.
4. **Maternity Leave (84 Days):**
   - Granted for live child delivery: 84 consecutive days with full pay (14 days prior to delivery, 70 days post delivery).
   - Non-live birth or miscarriage: 42 consecutive days of paid leave.
5. **Paternity Leave:**
   - No statutory requirement; available only under company discretion.

### 4.2 Payroll & Salary Calculation Rules

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
5. **Slip Presentation:** Salary slips display final earnings, deductions, and net pay without showing internal formula steps.

### 4.3 User Account & Status Rules

1. Username corresponds strictly to the employee's unique email address.
2. When an employee departs, their status is updated to \"Resigned\", disabling active login while retaining all historical payroll and leave data.
3. New user onboarding triggers an automatic system email with login link and temporary password.

## 5. Exceptions and Boundary Cases

| Scenario | Handling |
|----------|----------|
| Annual leave request with less than 7 consecutive days when taking primary block | Warn or validate based on organization consecutive leave rule |
| Year 1 employee applying for Annual Leave | Prevent selection/submission with message indicating entitlement starts in Year 2 |
| Casual leave requested exceeding accrued 2-month rate in Year 1 | Block submission and display available accrued casual days |
| Offboarding employee marked as Resigned | Account deactivated for platform access; historical salary records preserved |
| Missing attendance/leave logs for auto-fill in salary entry | Allow HR Admin to verify and manually adjust days worked / leave days |
| Duplicate salary processing for same employee in same payroll month | Block submission and show \"Salary entry already exists for this payroll period\" |
| Immediate login following password input | Authenticate instantly without page refresh or stale redirect loop |

## 6. Acceptance Criteria

1. HR Admin creates a new user entering First Name, Last Name, Email, and Phone Number; the user receives an onboarding email with platform login link and temporary password.
2. User logs in with temporary password, is prompted to set their own permanent password, and logs in smoothly without page refresh.
3. HR Admin updates an offboarded employee's status to \"Resigned\", and the employee is listed under resigned records.
4. HR Admin opens \"Add Salary\", selects salary month, and verifies the payroll period (25th prior month to 24th selected month) along with working and leave days are auto-filled.
5. System calculates salary components in LKR (Basic, Allowances, EPF 12%/8%, ETF 3%, Stamp Duty LKR 25) and saves successfully.
6. HR Admin and Staff access the dedicated \"Salary Slips\" tab, generate the salary slip, verify company logo, general info, and clean salary amounts are shown without formula workings, and successfully download the PDF.
7. Staff submits leave applications subject to Sri Lankan leave rules (Year 1 vs Year 2+ Annual Leave rules, Casual Leave accrual, 84-day Maternity Leave), and balances update accurately upon approval.

## 7. Out of Scope for This Release

- Biometric machine physical hardware integration
- Bulk payroll export to third-party bank clearing network file formats
- Multi-currency payroll processing outside of LKR
- Automated income tax (APIT) bracket calculation engine
- Performance appraisal and KPI scoring modules