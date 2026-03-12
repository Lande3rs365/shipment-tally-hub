-- WooCommerce direct API integration credentials, one row per company.
-- consumer_key / consumer_secret are stored as plain text and protected by RLS.
-- The anon key can only read rows where the authenticated user belongs to the company.

CREATE TABLE IF NOT EXISTS woocommerce_integrations (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id             uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_url              text        NOT NULL,
  consumer_key           text        NOT NULL,
  consumer_secret        text        NOT NULL,
  is_active              boolean     NOT NULL DEFAULT true,
  last_sync_at           timestamptz,
  last_sync_order_count  integer,
  last_sync_status       text,       -- 'success' | 'error' | null
  last_sync_error        text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (company_id)   -- one integration per company
);

ALTER TABLE woocommerce_integrations ENABLE ROW LEVEL SECURITY;

-- Members of the company can read their own integration settings
CREATE POLICY "Company members can view woocommerce integration"
  ON woocommerce_integrations FOR SELECT
  USING (user_belongs_to_company(company_id));

-- Members of the company can insert/update/delete their own integration settings
CREATE POLICY "Company members can manage woocommerce integration"
  ON woocommerce_integrations FOR ALL
  USING (user_belongs_to_company(company_id));

-- Auto-update updated_at timestamp on every row change
CREATE TRIGGER update_woocommerce_integrations_updated_at
  BEFORE UPDATE ON woocommerce_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
