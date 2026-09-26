import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { getSalaryRecord, getEmployeeForSlip } from '@/db/api';
import type { SalaryRecord, Employee } from '@/types/types';
import { formatLKR, round2 } from '@/lib/salaryCalc';
import { generateSlipPdf } from '@/lib/slipPdf';
import { ArrowLeft, Download } from 'lucide-react';

const LOGO_URL = '/esol_logo.png';
const COMPANY_NAME = 'ESOL Premier Campus (Pvt) Limited';
const COMPANY_ADDRESS = 'No 179, High Level Road, Pannipitiya, 10230';

// Clean salary slip: general information + pay summary (no internal calculation workings)
const SlipContent: React.FC<{ record: SalaryRecord; employee: Employee }> = ({ record, employee }) => {
  const days = record.total_days_entitled;
  const earnedAllowances = [
    { label: 'Transport Allowance', amount: round2((record.transportation_allowance / 30) * days) },
    { label: 'Education Allowance', amount: round2((record.education_allowance / 30) * days) },
    { label: 'Attendance Allowance', amount: round2((record.attendance_allowance / 30) * days) },
  ].filter(a => a.amount > 0);

  const Info = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2 text-sm min-w-0">
      <span className="text-gray-500 sm:w-36 shrink-0">{label}:</span>
      <span className="font-medium text-gray-900 break-words min-w-0 flex-1">{value}</span>
    </div>
  );

  const Row = ({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) => (
    <div className={`flex justify-between items-center py-1.5 border-b border-gray-200 last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-sm whitespace-nowrap ${accent ? 'text-base text-gray-900 font-bold' : 'text-gray-900'}`}>{value}</span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto font-sans text-gray-900 bg-white px-4 md:px-0" style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex flex-col items-center text-center border-b-2 border-gray-800 pb-4 mb-5">
        <img src={LOGO_URL} alt="ESOL Premier Campus" className="h-14 w-auto object-contain mx-auto mb-2" />
        <h2 className="text-base font-bold text-gray-900">{COMPANY_NAME}</h2>
        <p className="text-xs text-gray-600">{COMPANY_ADDRESS}</p>
        <div className="mt-3 bg-gray-800 text-white px-6 py-1 text-sm font-semibold rounded-sm">
          SALARY SLIP — {record.payroll_month.toUpperCase()}
        </div>
      </div>

      {/* Employee information */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2.5">Employee Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
          <Info label="Employee ID" value={employee.employee_id} />
          <Info label="Employee Name" value={employee.full_name} />
          <Info label="Designation" value={employee.designation} />
          <Info label="Employment Commencement" value={employee.employment_commencement} />
          <Info label="Bank" value={employee.bank} />
          <Info label="Bank Branch" value={employee.bank_branch} />
          <Info label="Bank Account Number" value={employee.bank_account_number} />
          <Info label="Pay Period" value={record.payroll_period || `${record.payroll_month}`} />
        </div>
      </section>

      {/* Earnings */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2.5">Earnings</h3>
        <Row label={`Basic Salary (${days} days)`} value={formatLKR(record.basic_salary_earned)} />
        {earnedAllowances.map(a => (
          <Row key={a.label} label={a.label} value={formatLKR(a.amount)} />
        ))}
        <Row label="Total Gross Pay" value={formatLKR(record.total_gross_earning)} bold />
      </section>

      {/* Deductions */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2.5">Deductions</h3>
        <Row label="EPF — Employee Contribution" value={formatLKR(record.epf_employee)} />
        {record.stamp_duty > 0 && <Row label="Stamp Duty" value={formatLKR(record.stamp_duty)} />}
        <Row label="Total Deductions" value={formatLKR(record.total_deductions)} bold />
      </section>

      {/* Net pay */}
      <section className="mb-6">
        <div className="flex justify-center border-2 border-gray-800 rounded px-6 py-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Net Pay</p>
            <p className="text-2xl font-bold text-gray-900">{formatLKR(record.net_pay)}</p>
          </div>
        </div>
      </section>

      {/* Signatory */}
      <div className="border-t-2 border-gray-800 pt-6 mt-4">
        <div className="flex justify-between items-end">
          <div className="text-center">
            <div className="w-48 border-b border-gray-600 mb-1" style={{ height: '40px' }} />
            <p className="text-xs font-semibold text-gray-700">HR Manager</p>
            <p className="text-xs text-gray-500">{COMPANY_NAME}</p>
            <p className="text-xs text-gray-400 mt-1">Date: {new Date().toLocaleDateString('en-LK')}</p>
          </div>
          <p className="text-[10px] text-gray-400 self-end">This is a computer-generated document.</p>
        </div>
      </div>
    </div>
  );
};

const SalarySlipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const rec = await getSalaryRecord(id);
      if (!rec) { setLoading(false); return; }
      const emp = await getEmployeeForSlip(rec.employee_id);
      setRecord(rec);
      setEmployee(emp);
      setLoading(false);
    })();
  }, [id]);

  const handleDownload = async () => {
    if (!record || !employee) return;
    setDownloading(true);
    try {
      await generateSlipPdf(record, employee);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="p-8"><div className="h-96 bg-muted animate-pulse rounded-lg" /></div>
    </AppLayout>
  );
  if (!record || !employee) return (
    <AppLayout>
      <div className="p-8 text-muted-foreground">Salary record not found.</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft size={18} /></Button>
            <div>
              <h1 className="text-xl font-semibold">Salary Slip</h1>
              <p className="text-sm text-muted-foreground">{employee.full_name} — {record.payroll_month}</p>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading} className="shrink-0">
            <Download size={16} className="mr-1.5" />
            {downloading ? 'Preparing...' : 'Download PDF'}
          </Button>
        </div>
        <div className="bg-white border border-border rounded-lg shadow-card p-2 md:p-6">
          <SlipContent record={record} employee={employee} />
        </div>
      </div>
    </AppLayout>
  );
};

export default SalarySlipPage;
