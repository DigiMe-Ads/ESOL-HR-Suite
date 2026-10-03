import React, { useEffect, useState } from 'react';
import { leaveTypeLabel } from '@/types/types';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLeaveRequests, getEmployeeDirectory, reviewLeaveRequest, getEmployeeByProfileId } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveRequest, Employee } from '@/types/types';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const statusColor: Record<string, string> = {
  pending: 'pill pill-warning',
  approved: 'pill pill-success',
  rejected: 'pill pill-danger',
};

const LeaveRequestsPage: React.FC = () => {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ leave: LeaveRequest; action: 'approved' | 'rejected' } | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ownEmployeeId, setOwnEmployeeId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [lvs, emps, own] = await Promise.all([
      getLeaveRequests(),
      getEmployeeDirectory(),
      profile ? getEmployeeByProfileId(profile.id) : Promise.resolve(null),
    ]);
    setLeaves(lvs);
    setEmployees(emps);
    setOwnEmployeeId(own?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const filtered = leaves.filter(l => filterStatus === 'all' || l.status === filterStatus);

  const openReview = (leave: LeaveRequest, action: 'approved' | 'rejected') => {
    setComment('');
    setReviewDialog({ leave, action });
  };

  const handleReview = async () => {
    if (!reviewDialog || !profile) return;
    setSubmitting(true);
    const result = await reviewLeaveRequest(reviewDialog.leave.id, reviewDialog.action, profile.id, comment);
    setSubmitting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Leave request ${reviewDialog.action}`);
    setReviewDialog(null);
    load();
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="page-subtitle">Review and manage employee leave applications</p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3">Employee</th>
                    <th className="text-left px-6 py-3">Type</th>
                    <th className="text-left px-6 py-3">Dates</th>
                    <th className="text-right px-6 py-3">Days</th>
                    <th className="text-left px-6 py-3">Reason</th>
                    <th className="text-left px-6 py-3">Status</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No leave requests found.</td></tr>
                  ) : filtered.map(l => {
                    const emp = empMap[l.employee_id];
                    return (
                      <tr key={l.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium text-foreground">{emp?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{emp?.employee_id}</p>
                        </td>
                        <td className="px-6 py-3">{leaveTypeLabel(l.leave_type)}</td>
                        <td className="px-6 py-3 text-muted-foreground">{l.start_date} → {l.end_date}</td>
                        <td className="px-6 py-3 text-right">{l.total_days}</td>
                        <td className="px-6 py-3 text-muted-foreground max-w-[140px] truncate">{l.reason ?? '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`${statusColor[l.status]}`}>{l.status}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {l.status === 'pending' && l.employee_id === ownEmployeeId && (
                              <span className="text-xs text-muted-foreground italic px-2">Your request — another reviewer must decide</span>
                            )}
                            {l.status === 'pending' && l.employee_id !== ownEmployeeId && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => openReview(l, 'approved')}>
                                  <CheckCircle size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openReview(l, 'rejected')}>
                                  <XCircle size={16} />
                                </Button>
                              </>
                            )}
                            {l.status !== 'pending' && (
                              <span className="text-xs text-muted-foreground italic px-2">{l.review_comment ? `"${l.review_comment}"` : 'No comment'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={Boolean(reviewDialog)} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === 'approved' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
                <p><span className="font-medium">Employee:</span> {empMap[reviewDialog.leave.employee_id]?.full_name}</p>
                <p><span className="font-medium">Type:</span> {leaveTypeLabel(reviewDialog.leave.leave_type)}</p>
                <p><span className="font-medium">Dates:</span> {reviewDialog.leave.start_date} to {reviewDialog.leave.end_date} ({reviewDialog.leave.total_days} days)</p>
                {reviewDialog.leave.reason && <p><span className="font-medium">Reason:</span> {reviewDialog.leave.reason}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Comment (optional)</label>
                <Textarea placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={reviewDialog?.action === 'rejected' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {submitting ? 'Processing...' : reviewDialog?.action === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default LeaveRequestsPage;
