import { jsPDF } from 'jspdf';
import type { SalaryRecord, Employee } from '@/types/types';
import { round2 } from '@/lib/salaryCalc';
import { ESOL_LOGO_BASE64 } from '@/lib/logoBase64';

const COMPANY_NAME = 'ESOL Premier Campus (Pvt) Limited';
const COMPANY_ADDRESS = 'No 179, High Level Road, Pannipitiya, 10230';

// ── Brand palette ─────────────────────────────────────────────
const NAVY: [number, number, number] = [27, 59, 138];
const DARK: [number, number, number] = [33, 37, 41];
const GRAY: [number, number, number] = [122, 128, 136];
const LINE: [number, number, number] = [214, 219, 226];
const ZEBRA: [number, number, number] = [244, 246, 249];
const TINT: [number, number, number] = [235, 240, 249];

// ── Page geometry (A4, millimetres) ───────────────────────────
const PAGE_W = 210;
const MARGIN = 15;            // content: x 15 → 195 (180mm wide)
const CONTENT_R = PAGE_W - MARGIN;
const COL_GAP = 4;            // gap between the two detail boxes
const BOX_W = (CONTENT_R - MARGIN - COL_GAP) / 2; // 88mm each
const BOX_L = MARGIN;             // left box:  15 → 103
const BOX_R = MARGIN + BOX_W + COL_GAP; // right box: 107 → 195

// ── Number to words (for the net-pay line) ────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunkToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${chunkToWords(n % 100)}` : ''}`;
}

function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  return [
    millions ? `${chunkToWords(millions)} Million` : '',
    thousands ? `${chunkToWords(thousands)} Thousand` : '',
    rest ? chunkToWords(rest) : '',
  ].filter(Boolean).join(' ');
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const cents = Math.round((amount - rupees) * 100);
  let s = `Sri Lanka Rupees ${numberToWords(rupees)}`;
  if (cents > 0) s += ` and Cents ${numberToWords(cents)}`;
  return `${s} Only`;
}

// Plain number format — the "LKR" prefix lives in column headers / net band
const fmt = (n: number) => n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateSlipPdf(record: SalaryRecord, employee: Employee): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');

  // Draw text that never overflows `maxW`: shrink, then ellipsize as a last resort
  const fitText = (text: string, x: number, y: number, maxW: number, align: 'left' | 'right' = 'left') => {
    let t = String(text);
    let size = doc.getFontSize();
    while (doc.getTextWidth(t) > maxW && size > 5.8) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    if (doc.getTextWidth(t) > maxW) {
      while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
      t += '…';
    }
    doc.text(t, x, y, { align });
  };

  // ════════════════════════════════════════════════════════════
  // 1 · HEADER — logo left, company block beside it, navy rule
  // ════════════════════════════════════════════════════════════
  let y = 16;
  let textX = MARGIN;
  try {
    const logoW = 44;
    const logoH = logoW / 3.411; // original aspect ratio
    doc.addImage(ESOL_LOGO_BASE64, 'PNG', MARGIN, y, logoW, logoH, undefined, 'FAST');
    textX = MARGIN + logoW + 5;
  } catch { /* keep text at left margin */ }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(COMPANY_NAME, textX, y + 5.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(COMPANY_ADDRESS, textX, y + 9.8);

  y += 15;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, CONTENT_R, y);
  y += 4;

  // ════════════════════════════════════════════════════════════
  // 2 · TITLE BAND — "SALARY SLIP" + month, balanced left/right
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, CONTENT_R - MARGIN, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SALARY SLIP', MARGIN + 4, y + 6);
  doc.setFontSize(9.5);
  doc.text(record.payroll_month.toUpperCase(), CONTENT_R - 4, y + 6, { align: 'right' });
  y += 14;

  // ════════════════════════════════════════════════════════════
  // 3 · EMPLOYEE INFO — boxed 2×4 grid, fixed label columns
  // ════════════════════════════════════════════════════════════
  // Compact pay period ("25 Aug 2026 to 24 Sep 2026") so it fits the column at the same size as the other values
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = record.payroll_month_number - 1;
  const payPeriod = m >= 0 && m < 12 && record.payroll_year
    ? `25 ${SHORT_MONTHS[(m + 11) % 12]} ${m === 0 ? record.payroll_year - 1 : record.payroll_year} to 24 ${SHORT_MONTHS[m]} ${record.payroll_year}`
    : record.payroll_period || record.payroll_month;

  const infoRows: Array<{ lL: string; vL: string; lR: string; vR: string }> = [
    { lL: 'Employee ID', vL: employee.employee_id || '—', lR: 'Employee Name', vR: employee.full_name || '—' },
    { lL: 'Designation', vL: employee.designation || '—', lR: 'Commencement Date', vR: employee.employment_commencement || '—' },
    { lL: 'Bank', vL: employee.bank || '—', lR: 'Bank Branch', vR: employee.bank_branch || '—' },
    { lL: 'Account Number', vL: employee.bank_account_number || '—', lR: 'Pay Period', vR: payPeriod },
  ];
  const infoRowH = 7.4;
  const infoH = infoRows.length * infoRowH;
  const midX = PAGE_W / 2;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, y, CONTENT_R - MARGIN, infoH);           // outer frame
  for (let i = 1; i < infoRows.length; i++) {               // row separators
    doc.line(MARGIN, y + i * infoRowH, CONTENT_R, y + i * infoRowH);
  }
  doc.line(midX, y, midX, y + infoH);                       // centre divider

  infoRows.forEach((r, i) => {
    const rowY = y + i * infoRowH;
    const baseY = rowY + infoRowH / 2 + 1.1;                // vertical centring
    const labelX = MARGIN + 3;
    const valueLX = MARGIN + 36;
    const valueRX = midX + 40;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(r.lL, labelX, baseY);
    doc.text(r.lR, midX + 3, baseY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    fitText(r.vL, valueLX, baseY, midX - valueLX - 3);
    fitText(r.vR, valueRX, baseY, CONTENT_R - valueRX - 3);
  });
  y += infoH + 6;

  // ════════════════════════════════════════════════════════════
  // 4 · EARNINGS & DEDUCTIONS — two aligned side-by-side boxes
  // ════════════════════════════════════════════════════════════
  const days = record.total_days_entitled;
  const div = record.working_days_constant || 30;

  const earnings: Array<{ label: string; amount: number }> = [
    { label: `Basic Salary (${days} days)`, amount: record.basic_salary_earned },
    { label: 'Transport Allowance', amount: round2((record.transportation_allowance / div) * days) },
    { label: 'Education Allowance', amount: round2((record.education_allowance / div) * days) },
    { label: 'Attendance Allowance', amount: round2((record.attendance_allowance / div) * days) },
  ].filter(a => a.amount > 0);

  const deductions: Array<{ label: string; amount: number }> = [
    { label: 'EPF — Employee (8%)', amount: record.epf_employee },
    { label: 'Stamp Duty', amount: record.stamp_duty },
  ].filter(d => d.amount > 0);

  const detailHeaderH = 7.5;
  const detailRowH = 6.6;
  const subtotalH = 8;
  const maxRows = Math.max(earnings.length, deductions.length);
  const detailH = detailHeaderH + maxRows * detailRowH + subtotalH;

  const drawDetailBox = (
    x: number, title: string,
    rows: Array<{ label: string; amount: number }>,
    totalLabel: string, totalAmount: number,
  ) => {
    // Frame
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.35);
    doc.rect(x, y, BOX_W, detailH);

    // Header strip
    doc.setFillColor(...TINT);
    doc.rect(x, y, BOX_W, detailHeaderH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(title, x + 3, y + detailHeaderH / 2 + 1.1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text('AMOUNT (LKR)', x + BOX_W - 3, y + detailHeaderH / 2 + 1.1, { align: 'right' });

    let ry = y + detailHeaderH;
    for (let i = 0; i < maxRows; i++) {
      if (i % 2 === 1) {                                   // zebra stripe
        doc.setFillColor(...ZEBRA);
        doc.rect(x, ry, BOX_W, detailRowH, 'F');
      }
      const row = rows[i];
      if (row) {
        const baseY = ry + detailRowH / 2 + 1.05;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK);
        fitText(row.label, x + 3, baseY, BOX_W - 45);
        doc.text(fmt(row.amount), x + BOX_W - 3, baseY, { align: 'right' });
      }
      ry += detailRowH;
    }

    // Subtotal row
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(x, ry, x + BOX_W, ry);
    doc.setFillColor(...TINT);
    doc.rect(x, ry, BOX_W, subtotalH, 'F');
    const baseY = ry + subtotalH / 2 + 1.1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(totalLabel, x + 3, baseY);
    doc.text(fmt(totalAmount), x + BOX_W - 3, baseY, { align: 'right' });
  };

  drawDetailBox(BOX_L, 'EARNINGS', earnings, 'Total Gross Earnings', record.total_gross_earning);
  drawDetailBox(BOX_R, 'DEDUCTIONS', deductions, 'Total Deductions', record.total_deductions);
  y += detailH + 6;

  // ════════════════════════════════════════════════════════════
  // 5 · NET PAY BAND — full width, prominent
  // ════════════════════════════════════════════════════════════
  const netH = 11.5;
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, CONTENT_R - MARGIN, netH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAYABLE', MARGIN + 4, y + netH / 2 + 1.4);
  doc.setFontSize(13);
  doc.text(`LKR ${fmt(record.net_pay)}`, CONTENT_R - 4, y + netH / 2 + 1.6, { align: 'right' });
  y += netH + 5;

  // ════════════════════════════════════════════════════════════
  // 6 · AMOUNT IN WORDS
  // ════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('In words:', MARGIN, y + 3);
  doc.setFont('helvetica', 'italic');
  const words = doc.splitTextToSize(amountInWords(record.net_pay), CONTENT_R - MARGIN - 22);
  doc.text(words, MARGIN + 22, y + 3);

  // ════════════════════════════════════════════════════════════
  // 7 · FOOTER — signature + system note, anchored to page bottom
  // ════════════════════════════════════════════════════════════
  const sigY = 262;
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, sigY, MARGIN + 62, sigY);
  doc.line(CONTENT_R - 62, sigY, CONTENT_R, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('HR Manager', MARGIN, sigY + 4.5);
  doc.text('Employee Signature', CONTENT_R, sigY + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' })}`, MARGIN, 285);
  doc.text('This is a computer-generated document.', CONTENT_R, 285, { align: 'right' });

  doc.save(`Salary_Slip_${employee.employee_id}_${record.payroll_month.replace(/\s+/g, '_')}.pdf`);
}
