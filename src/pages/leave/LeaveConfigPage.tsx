import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getLeaveTypeConfigs, updateLeaveTypeConfig } from '@/db/api';
import type { LeaveTypeConfig } from '@/types/types';
import { toast } from 'sonner';
import { Save, Scale } from 'lucide-react';

const LeaveConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<LeaveTypeConfig[]>([]);
  const [edits, setEdits] = useState<Record<string, { annual_entitlement_days: number; is_active: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLeaveTypeConfigs().then(data => {
      setConfigs(data);
      const init: typeof edits = {};
      data.forEach(c => { init[c.id] = { annual_entitlement_days: c.annual_entitlement_days, is_active: c.is_active }; });
      setEdits(init);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(configs.map(c => updateLeaveTypeConfig(c.id, edits[c.id])));
    toast.success('Leave configuration saved');
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Leave Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure leave types and annual entitlements</p>
        </div>

        <Card className="border-border shadow-card bg-primary/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale size={16} className="text-primary" /> Sri Lankan Statutory Leave Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-foreground/80">
              <li className="flex gap-2"><span className="text-primary font-semibold shrink-0">Annual —</span> 14 days. Year 1: no entitlement. Year 2: pro-rated by commencement quarter (Jan–Mar: 14, Apr–Jun: 10, Jul–Sep: 7, Oct–Dec: 4). Year 3+: full 14 days. Must be taken as at least 7 consecutive days.</li>
              <li className="flex gap-2"><span className="text-primary font-semibold shrink-0">Casual —</span> 7 days. Year 1: 1 day earned per 2 completed months of service. Year 2+: full 7 days at the start of the calendar year. Unused casual leave lapses at year end.</li>
              <li className="flex gap-2"><span className="text-primary font-semibold shrink-0">Sick —</span> No separate statutory allocation; sickness is covered within the 7-day casual leave entitlement.</li>
              <li className="flex gap-2"><span className="text-primary font-semibold shrink-0">Maternity —</span> 84 days (14 days before and 70 days after confinement), or 42 days for a non-live birth or miscarriage.</li>
              <li className="flex gap-2"><span className="text-primary font-semibold shrink-0">Paternity —</span> No statutory allocation; up to 3 working days may be granted under company policy.</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">These rules are enforced automatically when employees apply for leave. The entitlement numbers below are for reference only.</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">Leave Types & Entitlements (Reference)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)
            ) : configs.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.leave_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Days/Year</Label>
                    <Input
                      type="number" min="0" max="365"
                      value={edits[c.id]?.annual_entitlement_days ?? c.annual_entitlement_days}
                      onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], annual_entitlement_days: parseInt(e.target.value) || 0 } }))}
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Label className="text-xs">Active</Label>
                    <input
                      type="checkbox"
                      checked={edits[c.id]?.is_active ?? c.is_active}
                      onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], is_active: e.target.checked } }))}
                      className="w-5 h-5 accent-primary mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save size={15} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default LeaveConfigPage;
