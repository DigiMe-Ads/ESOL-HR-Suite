import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLeaveRequests, getEmployeeDirectory, reviewLeaveRequest } from '@/db/api';
import type { EmployeeDirectoryEntry } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveRequest, Employee } from '@/types/types';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
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

  const load = async () => {
    setLoading(true);
    const [lvs, emps] = await Promise.all([getLeaveRequests(), getEmployeeDirectory()]);
    setLeaves(lvs);
    setEmployees(emps);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Leave Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and manage employee leave applications</p>
        </div>

        <Card className="border-border shadow-card">
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
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Employee</th>
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Type</th>
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Dates</th>
                    <th className="text-right px-6 py-3 font-semibold text-foreground">Days</th>
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Reason</th>
                    <th className="text-left px-6 py-3 font-semibold text-foreground">Status</th>
                    <th className="text-right px-6 py-3 font-semibold text-foreground">Actions</th>
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
                        <td className="px-6 py-3 capitalize">{l.leave_type} Leave</td>
                        <td className="px-6 py-3 text-muted-foreground">{l.start_date} → {l.end_date}</td>
                        <td className="px-6 py-3 text-right">{l.total_days}</td>
                        <td className="px-6 py-3 text-muted-foreground max-w-[140px] truncate">{l.reason ?? '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[l.status]}`}>{l.status}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {l.status === 'pending' && (
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
                <p><span className="font-medium">Type:</span> {reviewDialog.leave.leave_type} Leave</p>
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
