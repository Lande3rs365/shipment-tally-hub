
-- Fix 2 on-hold orders with wrong status
UPDATE public.orders SET status = 'on-hold' WHERE woo_status = 'on-hold' AND status = 'pending';

-- Create missing exceptions for these 2 orders
INSERT INTO public.exceptions (company_id, exception_type, title, status, severity, linked_order_id)
SELECT o.company_id, 'on_hold', 'On-hold: ' || o.order_number, 'open', 'medium', o.id
FROM public.orders o
WHERE o.woo_status = 'on-hold'
  AND NOT EXISTS (SELECT 1 FROM public.exceptions e WHERE e.linked_order_id = o.id AND e.status = 'open');
