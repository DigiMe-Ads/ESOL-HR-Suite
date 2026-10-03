import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuditLog, getAllProfiles } from '@/db/api';
import type { AuditLogEntry } from '@/types/types';
import { leaveTypeLabel } from '@/types/types';

const AREAS: Record<string, string> = {
  employees: 'Employees',
  salary_records: 'Salary',
  leave_requests: 'Leave requests',
  profiles: 'User accounts',
  leave_type_config: 'Leave configuration',
  employee_documents: 'Documents',
  employee_leave_grants: 'Leave grants',
  salary_slip_requests: 'Slip requests',
};

const ACTION_LABEL: Record<AuditLogEntry['action'], { text: string; pill: string }> = {
  INSERT: { text: 'Added', pill: 'pill pill-success' },
  UPDATE: { text: 'Changed', pill: 'pill pill-info' },
  DELETE: { text: 'Deleted', pill: 'pill pill-danger' },
};

// Columns that are noise in a change log
const HIDDEN_FIELDS = new Set(['id', 'created_at', 'updated_at']);

const fieldLabel = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const show = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** One-line description of the affected record */
function describe(e: AuditLogEntry): string {
  const d = { ...(e.old_data ?? {}), ...(e.new_data ?? {}) } as Record<string, unknown>;
  switch (e.table_name) {
    case 'employees': return `${show(d.full_name)}${d.employee_id ? ` (${d.employee_id})` : ''}`;
    case 'salary_records': return `Salary ${show(d.payroll_month)}`;
    case 'leave_requests': return `${d.leave_type ? leaveTypeLabel(String(d.leave_type)) : 'Leave'}${d.start_date ? ` ${d.start_date} → ${d.end_date}` : ''}${d.status ? ` · ${d.status}` : ''}`;
    case 'profiles': return `${show(d.full_name ?? d.email)}`;
    case 'leave_type_config': return `${show(d.label ?? d.leave_type)}`;
    case 'employee_documents': return `${show(d.title)}`;
    case 'employee_leave_grants': return `${d.leave_type ? leaveTypeLabel(String(d.leave_type)) : 'Leave'} grant`;
    case 'salary_slip_requests': return `Slip request ${show(d.payroll_month)}${d.status ? ` · ${d.status}` : ''}`;
    default: return e.record_id ?? '';
  }
}

/**
 * Admin-only activity log: every add / change / delete made through the portal (or directly in the database),
 * with who did it and the before/after values — for cross-checking mistakes or unexpected changes.
 */
const ActivityLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState('all');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [people, setPeople] = useState<Record<string, string>>({});

  // Show names instead of account IDs (reviewed_by, profile_id, …)
  useEffect(() => {
    getAllProfiles().then(ps => setPeople(Object.fromEntries(ps.map(p => [p.id, p.full_name ?? p.email ?? p.id]))));
  }, []);
  const display = (key: string, v: unknown) => (/(_by|profile_id)$/.test(key) && typeof v === 'string' && people[v] ? people[v] : show(v));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAuditLog({ table: area === 'all' ? undefined : area, action: action === 'all' ? undefined : action, from: from || undefined, to: to || undefined, limit: 500 })
      .then(rows => { if (!cancelled) { setEntries(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, [area, action, from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e => `${e.actor_name ?? ''} ${e.actor_role ?? ''} ${describe(e)} ${JSON.stringify(e.new_data ?? {})} ${JSON.stringify(e.old_data ?? {})}`.toLowerCase().includes(q));
  }, [entries, search]);

  const toggle = (id: number) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const changes = (e: AuditLogEntry) => {
    const keys = Object.keys({ ...(e.old_data ?? {}), ...(e.new_data ?? {}) }).filter(k => !HIDDEN_FIELDS.has(k));
    return keys.map(k => ({ key: k, before: e.old_data?.[k], after: e.new_data?.[k] }));
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="page-title flex items-center gap-2"><History size={22} className="text-primary" /> Activity Log</h1>
          <p className="page-subtitle">Every change made by staff, finance, HR or admins — who, when and what changed. Read-only; entries can't be edited or deleted.</p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search person, record, value…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {Object.entries(AREAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="INSERT">Added</SelectItem>
                  <SelectItem value="UPDATE">Changed</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" aria-label="From date" />
                to
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" aria-label="To date" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="w-8" />
                    <th className="text-left px-4 py-3 whitespace-nowrap">When</th>
                    <th className="text-left px-4 py-3">Who</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Area</th>
                    <th className="text-left px-4 py-3">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>)}</tr>)
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No activity found for these filters.</td></tr>
                  ) : filtered.map(e => {
                    const isOpen = open.has(e.id);
                    const rows = changes(e);
                    return (
                      <React.Fragment key={e.id}>
                        <tr className="cursor-pointer" onClick={() => toggle(e.id)}>
                          <td className="pl-4 py-3 text-muted-foreground">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {new Date(e.occurred_at).toLocaleString('en-LK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{e.actor_name ?? 'System'}</p>
                            {e.actor_role && <p className="text-xs text-muted-foreground capitalize">{e.actor_role.replace('_', ' ')}</p>}
                          </td>
                          <td className="px-4 py-3"><span className={ACTION_LABEL[e.action].pill}>{ACTION_LABEL[e.action].text}</span></td>
                          <td className="px-4 py-3 whitespace-nowrap">{AREAS[e.table_name] ?? e.table_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {describe(e)}
                            {e.action === 'UPDATE' && <span className="block text-xs">{rows.map(r => fieldLabel(r.key)).join(', ')}</span>}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/30">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              {rows.length === 0 ? <p className="text-xs text-muted-foreground">No field details.</p> : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left font-medium py-1 pr-4 w-48">Field</th>
                                      {e.action !== 'INSERT' && <th className="text-left font-medium py-1 pr-4">Before</th>}
                                      {e.action !== 'DELETE' && <th className="text-left font-medium py-1">After</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map(r => (
                                      <tr key={r.key} className="align-top">
                                        <td className="py-1 pr-4 font-medium text-foreground">{fieldLabel(r.key)}</td>
                                        {e.action !== 'INSERT' && <td className="py-1 pr-4 text-rose-700 dark:text-rose-300 break-all">{display(r.key, r.before)}</td>}
                                        {e.action !== 'DELETE' && <td className="py-1 text-emerald-700 dark:text-emerald-300 break-all">{display(r.key, r.after)}</td>}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && entries.length >= 500 && (
              <p className="px-4 py-3 text-xs text-muted-foreground border-t border-border">Showing the latest 500 entries — narrow the dates or area to see older activity.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ActivityLogPage;
