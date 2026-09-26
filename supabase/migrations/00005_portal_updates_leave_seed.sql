-- Migration B: seed leave types per Sri Lankan statutory policy

-- Sick leave: no separate statutory allocation (covered by casual)
UPDATE public.leave_type_config
SET annual_entitlement_days = 0,
    label = 'Sick Leave (covered by Casual Leave)'
WHERE leave_type = 'sick';

-- Maternity: 84 days (14 before + 70 after delivery, full pay)
INSERT INTO public.leave_type_config (leave_type, label, annual_entitlement_days, is_active)
VALUES ('maternity', 'Maternity Leave', 84, true);

-- Paternity: 3 days company policy (no statutory requirement)
INSERT INTO public.leave_type_config (leave_type, label, annual_entitlement_days, is_active)
VALUES ('paternity', 'Paternity Leave', 3, true);
