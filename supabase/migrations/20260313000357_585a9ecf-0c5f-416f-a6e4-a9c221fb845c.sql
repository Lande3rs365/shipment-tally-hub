-- Add unique constraint on shipments for ShipStation upsert
-- Only apply to rows that have a non-null shipment_number
CREATE UNIQUE INDEX IF NOT EXISTS shipments_company_shipment_number_unique 
ON public.shipments (company_id, shipment_number) 
WHERE shipment_number IS NOT NULL;