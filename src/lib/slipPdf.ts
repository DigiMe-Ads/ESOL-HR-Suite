import { jsPDF } from 'jspdf';
import type { SalaryRecord, Employee } from '@/types/types';
import { formatLKR, round2 } from '@/lib/salaryCalc';
import { ESOL_LOGO_BASE64 } from '@/lib/logoBase64';

const COMPANY_NAME = 'ESOL Premier Campus (Pvt) Limited';
const COMPANY_ADDRESS = 'No 179, High Level Road, Pannipitiya, 10230';
const NAVY: [number, number, number] = [27, 59, 138];

export async function generateSlipPdf(record: SalaryRecord, employee: Employee): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 18; // Content width: 174mm (from x=18 to x=192)
  let y = 14;

  // Header: Crisp high-resolution cropped logo (aspect ratio 3.411:1)
  try {
    const logoW = 46;
    const logoH = logoW / 3.411; // ~13.48mm
    doc.addImage(ESOL_LOGO_BASE64, 'PNG', pageW / 2 - logoW / 2, y, logoW, logoH, undefined, 'FAST');
    y += logoH + 3.5;
  } catch {
    y += 2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(COMPANY_NAME, pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text(COMPANY_ADDRESS, pageW / 2, y + 4.5, { align: 'center' });
  y += 10;

  // Title bar (Full width between margins: 18mm to 192mm)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(margin, y, pageW - margin * 2, 8.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`SALARY SLIP — ${record.payroll_month.toUpperCase()}`, pageW / 2, y + 5.8, { align: 'center' });
  y += 15;
  doc.setTextColor(20, 20, 20);

  // Employee Information Grid (2 Columns cleanly aligned within 18mm to 192mm)
  // Left column: x = 18mm, width ~82mm (available space ends at 102mm)
  // Right column: x = 104mm, width ~88mm (ends at 192mm)
  const leftRows = [
    { label: 'Employee ID', value: employee.employee_id || '—', labelW: 28 },
    { label: 'Designation', value: employee.designation || '—', labelW: 28 },
    { label: 'Bank', value: employee.bank || '—', labelW: 28 },
    { label: 'Account Number', value: employee.bank_account_number || '—', labelW: 32 },
  ];
  const rightRows = [
    { label: 'Employee Name', value: employee.full_name || '—', labelW: 32 },
    { label: 'Commencement Date', value: employee.employment_commencement || '—', labelW: 40 },
    { label: 'Bank Branch', value: employee.bank_branch || '—', labelW: 25 },
    { label: 'Pay Period', value: record.payroll_period || record.payroll_month, labelW: 23 },
  ];

  doc.setFontSize(8.5);
  const rowCount = Math.max(leftRows.length, rightRows.length);
  const leftX = margin;
  const rightX = margin + 86; // 104mm
  const rightMaxX = pageW - margin; // 192mm

  for (let i = 0; i < rowCount; i++) {
    const rowY = y + i * 6.5;

    // Left Column
    if (leftRows[i]) {
      const item = leftRows[i];
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text(`${item.label}:`, leftX, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      const valX = leftX + item.labelW;
      const maxW = rightX - valX - 4;
      doc.text(String(item.value), valX, rowY, { maxWidth: maxW });
    }

    // Right Column
    if (rightRows[i]) {
      const item = rightRows[i];
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text(`${item.label}:`, rightX, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      const valX = rightX + item.labelW;
      const maxW = rightMaxX - valX; // Strictly capped to never exceed the 192mm right margin
      doc.text(String(item.value), valX, rowY, { maxWidth: maxW });
    }
  }

  y += rowCount * 6.5 + 6;

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(title.toUpperCase(), margin, y);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y + 1.5, pageW - margin, y + 1.5);
    doc.setTextColor(20, 20, 20);
    y += 7.5;
  };

  const tableRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.text(label, margin + 2, y);
    doc.text(value, pageW - margin - 2, y, { align: 'right' });
    y += 6.5;
  };

  // Earnings
  const days = record.total_days_entitled;
  const earnedAllowances = [
    { label: 'Transport Allowance', amount: round2((record.transportation_allowance / 30) * days) },
    { label: 'Education Allowance', amount: round2((record.education_allowance / 30) * days) },
    { label: 'Attendance Allowance', amount: round2((record.attendance_allowance / 30) * days) },
  ].filter(a => a.amount > 0);

  section('Earnings');
  tableRow(`Basic Salary (${days} days)`, formatLKR(record.basic_salary_earned));
  earnedAllowances.forEach(a => tableRow(a.label, formatLKR(a.amount)));
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y - 3, pageW - margin, y - 3);
  tableRow('Total Gross Pay', formatLKR(record.total_gross_earning), true);
  y += 4;

  // Deductions
  section('Deductions');
  tableRow('EPF — Employee (8%)', formatLKR(record.epf_employee));
  if (record.stamp_duty > 0) {
    tableRow('Stamp Duty', formatLKR(record.stamp_duty));
  }
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y - 3, pageW - margin, y - 3);
  tableRow('Total Deductions', formatLKR(record.total_deductions), true);
  y += 5;

  // Net pay box
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.6);
  doc.rect(margin, y, pageW - margin * 2, 14);
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NET PAYABLE', margin + 4, y + 8.5);
  doc.setFontSize(13);
  doc.text(formatLKR(record.net_pay), pageW - margin - 4, y + 9, { align: 'right' });
  y += 24;

  // NOTE: EMPLOYER CONTRIBUTIONS (STATUTORY RECORD) SECTION HAS BEEN COMPLETELY REMOVED PER USER REQUIREMENT

  // Signatory
  doc.setDrawColor(120, 120, 120);
  doc.line(margin, y + 10, margin + 60, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('HR Manager', margin, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(8);
  doc.text(COMPANY_NAME, margin, y + 18);
  doc.text(`Date: ${new Date().toLocaleDateString('en-LK')}`, margin, y + 22);
  doc.setFontSize(7.5);
  doc.text('This is a computer-generated document.', pageW - margin, y + 22, { align: 'right' });

  doc.save(`Salary_Slip_${employee.employee_id}_${record.payroll_month.replace(/\s+/g, '_')}.pdf`);
}
