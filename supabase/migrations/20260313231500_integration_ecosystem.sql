-- ============================================================
-- Integration Ecosystem Schema
-- Covers: EasyPost, Xero/QuickBooks, Shopify/Amazon/Etsy,
-- PayPal/Afterpay/Stripe, Klaviyo/Mailchimp, Google Drive,
-- Slack/Trello/Telegram team ops.
-- ============================================================


-- ------------------------------------------------------------
-- 1. integration_configs
-- One row per active integration per company.
-- Stores non-sensitive config (store URLs, account IDs, folder
-- IDs). Secrets live in Supabase Vault / Edge Function env vars.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  integration_type text NOT NULL CHECK (integration_type IN (
    -- Shipping & carriers
    'easypost', 'shippo', 'australia_post',
    -- E-commerce channels
    'shopify', 'amazon', 'etsy', 'woocommerce',
    -- Accounting
    'xero', 'quickbooks', 'myob',
    -- Payments
    'paypal', 'stripe', 'afterpay', 'klarna', 'square',
    -- Marketing
    'klaviyo', 'mailchimp',
    -- Helpdesk
    'tawk', 'zendesk', 'freshdesk', 'intercom',
    -- Team ops
    'slack', 'trello', 'telegram', 'google_drive',
    -- Email
    'google_workspace', 'microsoft_365', 'sendgrid', 'postmark'
  )),

  display_name text,          -- Human label e.g. "Main Shopify Store"
  is_active boolean NOT NULL DEFAULT true,

  -- Non-sensitive config: store URLs, account IDs, folder IDs, webhook endpoints etc.
  -- Sensitive keys stored in Supabase Vault or Edge Function env vars only.
  config jsonb NOT NULL DEFAULT '{}'::jsonb,

  last_sync_at timestamptz,
  last_sync_status text CHECK (last_sync_status IN ('success', 'failed', 'partial')),
  last_sync_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, integration_type, display_name)
);

CREATE INDEX IF NOT EXISTS integration_configs_company_id_idx ON public.integration_configs(company_id);
CREATE INDEX IF NOT EXISTS integration_configs_type_idx ON public.integration_configs(integration_type);
CREATE INDEX IF NOT EXISTS integration_configs_active_idx ON public.integration_configs(is_active);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_configs_company_isolation" ON public.integration_configs
  FOR ALL USING (public.user_belongs_to_company(company_id));

CREATE TRIGGER set_integration_configs_updated_at
  BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ------------------------------------------------------------
-- 2. sales_channels
-- Represents a selling channel (Shopify store, Amazon
-- marketplace, Etsy shop, WooCommerce site etc.).
-- Orders reference their source channel via sales_channel_id.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_config_id uuid REFERENCES public.integration_configs(id) ON DELETE SET NULL,

  channel_type text NOT NULL CHECK (channel_type IN (
    'shopify', 'amazon', 'etsy', 'woocommerce', 'manual', 'other'
  )),

  name text NOT NULL,               -- e.g. "US Shopify Store"
  external_store_id text,           -- Shopify shop ID, Amazon marketplace ID etc.
  store_url text,                   -- e.g. mystore.myshopify.com
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,

  last_order_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_channels_company_id_idx ON public.sales_channels(company_id);
CREATE INDEX IF NOT EXISTS sales_channels_channel_type_idx ON public.sales_channels(channel_type);

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_channels_company_isolation" ON public.sales_channels
  FOR ALL USING (public.user_belongs_to_company(company_id));

CREATE TRIGGER set_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link orders to their source sales channel
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid REFERENCES public.sales_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_order_id text; -- order ID in the originating platform


-- ------------------------------------------------------------
-- 3. carrier_tracking_events
-- Granular tracking events from EasyPost / Shippo / carrier
-- webhooks. Gives full delivery timeline per shipment.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.carrier_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,

  source text NOT NULL CHECK (source IN ('easypost', 'shippo', 'australia_post', 'carrier_webhook', 'manual')),

  -- EasyPost / Shippo internal IDs for deduplication
  external_tracker_id text,
  external_event_id text,

  -- Tracking status codes (carrier-agnostic normalised values)
  status text NOT NULL CHECK (status IN (
    'pre_transit', 'in_transit', 'out_for_delivery',
    'delivered', 'available_for_pickup', 'return_to_sender',
    'failure', 'cancelled', 'unknown'
  )),
  status_detail text,           -- Carrier's raw status string
  description text,             -- Human-readable event description

  -- Location at time of event
  location jsonb,               -- { city, state, country, zip, coordinates }

  event_timestamp timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source, external_event_id)
);

CREATE INDEX IF NOT EXISTS carrier_tracking_events_company_id_idx ON public.carrier_tracking_events(company_id);
CREATE INDEX IF NOT EXISTS carrier_tracking_events_shipment_id_idx ON public.carrier_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS carrier_tracking_events_status_idx ON public.carrier_tracking_events(status);
CREATE INDEX IF NOT EXISTS carrier_tracking_events_timestamp_idx ON public.carrier_tracking_events(event_timestamp);

ALTER TABLE public.carrier_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_tracking_events_company_isolation" ON public.carrier_tracking_events
  FOR ALL USING (public.user_belongs_to_company(company_id));

-- Store EasyPost tracker ID on the shipment for webhook matching
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS easypost_tracker_id text,
  ADD COLUMN IF NOT EXISTS easypost_shipment_id text;


-- ------------------------------------------------------------
-- 4. payment_transactions
-- Payment records from PayPal, Stripe, Afterpay, Klarna etc.
-- Linked to orders for reconciliation.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,

  provider text NOT NULL CHECK (provider IN (
    'paypal', 'stripe', 'afterpay', 'klarna', 'square', 'manual'
  )),

  external_transaction_id text,    -- Provider's transaction/charge ID
  external_payment_id text,        -- Provider's payment object ID (may differ)
  external_invoice_id text,        -- For providers that issue invoices

  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',

  status text NOT NULL CHECK (status IN (
    'pending', 'authorised', 'completed', 'partially_refunded',
    'refunded', 'failed', 'disputed', 'cancelled'
  )),

  payment_method text,             -- 'card', 'paypal_balance', 'afterpay', etc.
  payment_date timestamptz,
  refund_amount numeric(12, 2),
  refund_date timestamptz,

  raw_payload jsonb,               -- Full provider webhook payload

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_transactions_company_id_idx ON public.payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS payment_transactions_order_id_idx ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS payment_transactions_provider_idx ON public.payment_transactions(provider);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS payment_transactions_external_id_idx ON public.payment_transactions(external_transaction_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_company_isolation" ON public.payment_transactions
  FOR ALL USING (public.user_belongs_to_company(company_id));

CREATE TRIGGER set_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ------------------------------------------------------------
-- 5. accounting_sync_log
-- Tracks Xero / QuickBooks / MYOB sync state per order.
-- One row per order per accounting provider sync attempt.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.accounting_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,

  provider text NOT NULL CHECK (provider IN ('xero', 'quickbooks', 'myob')),

  -- IDs in the accounting system
  external_invoice_id text,
  external_contact_id text,
  external_payment_id text,

  sync_type text NOT NULL CHECK (sync_type IN (
    'invoice_create', 'invoice_update', 'payment_record', 'contact_sync', 'credit_note'
  )),

  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'synced', 'failed', 'skipped'
  )),

  synced_at timestamptz,
  error_message text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_sync_log_company_id_idx ON public.accounting_sync_log(company_id);
CREATE INDEX IF NOT EXISTS accounting_sync_log_order_id_idx ON public.accounting_sync_log(order_id);
CREATE INDEX IF NOT EXISTS accounting_sync_log_provider_idx ON public.accounting_sync_log(provider);
CREATE INDEX IF NOT EXISTS accounting_sync_log_status_idx ON public.accounting_sync_log(status);

ALTER TABLE public.accounting_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_sync_log_company_isolation" ON public.accounting_sync_log
  FOR ALL USING (public.user_belongs_to_company(company_id));

-- Tenant-level accounting identifiers (stored on company config via integration_configs)
-- Xero tenant_id and QuickBooks realm_id live in integration_configs.config jsonb


-- ------------------------------------------------------------
-- 6. marketing_events
-- Tracks Klaviyo / Mailchimp sends and engagement per order.
-- Lets the agent know whether a customer already received a
-- dispatch email before chasing them again.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,

  platform text NOT NULL CHECK (platform IN ('klaviyo', 'mailchimp')),

  event_type text NOT NULL CHECK (event_type IN (
    'order_confirmation', 'dispatch_notification', 'delivery_confirmation',
    'customer_chase', 'return_confirmation', 'marketing_campaign', 'other'
  )),

  external_message_id text,        -- Klaviyo message ID / Mailchimp campaign ID
  external_profile_id text,        -- Klaviyo profile ID / Mailchimp subscriber ID

  recipient_email text,
  subject text,

  -- Engagement tracking (populated via webhook callbacks)
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  unsubscribed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_events_company_id_idx ON public.marketing_events(company_id);
CREATE INDEX IF NOT EXISTS marketing_events_order_id_idx ON public.marketing_events(order_id);
CREATE INDEX IF NOT EXISTS marketing_events_platform_idx ON public.marketing_events(platform);
CREATE INDEX IF NOT EXISTS marketing_events_event_type_idx ON public.marketing_events(event_type);

ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_events_company_isolation" ON public.marketing_events
  FOR ALL USING (public.user_belongs_to_company(company_id));


-- ------------------------------------------------------------
-- 7. google_drive_sync
-- Tracks which Drive files have been seen and processed.
-- Prevents re-importing the same spreadsheet twice.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.google_drive_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_config_id uuid REFERENCES public.integration_configs(id) ON DELETE SET NULL,

  -- Google Drive identifiers
  folder_id text NOT NULL,
  file_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text,                  -- 'application/vnd.ms-excel', 'text/csv' etc.
  drive_modified_at timestamptz,   -- Drive's last modified timestamp

  -- Processing state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'imported', 'skipped', 'failed'
  )),
  processed_at timestamptz,

  -- Link to the import log created during processing
  intake_log_id uuid REFERENCES public.data_intake_logs(id) ON DELETE SET NULL,

  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, file_id)     -- Never import the same Drive file twice per company
);

CREATE INDEX IF NOT EXISTS google_drive_sync_company_id_idx ON public.google_drive_sync(company_id);
CREATE INDEX IF NOT EXISTS google_drive_sync_folder_id_idx ON public.google_drive_sync(folder_id);
CREATE INDEX IF NOT EXISTS google_drive_sync_status_idx ON public.google_drive_sync(status);

ALTER TABLE public.google_drive_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_drive_sync_company_isolation" ON public.google_drive_sync
  FOR ALL USING (public.user_belongs_to_company(company_id));


-- ------------------------------------------------------------
-- 8. Extend agent_actions with new action types
-- Drop and recreate the check constraint to add new types.
-- ------------------------------------------------------------

ALTER TABLE public.agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;

ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_action_type_check CHECK (action_type IN (
    -- Original types
    'tracking_chase',
    'tracking_extract',
    'customer_notify',
    'customer_chase',
    'ticket_match',
    'whatsapp_cob_summary',
    'whatsapp_urgent',
    'record_update',
    'exception_flag',
    -- New integration types
    'easypost_sync',          -- Synced tracking event from EasyPost
    'xero_invoice_sync',      -- Created/updated invoice in Xero
    'payment_reconcile',      -- Matched payment transaction to order
    'channel_order_import',   -- Pulled new orders from Shopify/Amazon/Etsy
    'klaviyo_send',           -- Triggered a Klaviyo email flow
    'mailchimp_send',         -- Sent a Mailchimp campaign/transactional email
    'drive_file_import',      -- Processed a file from Google Drive
    'trello_card_create',     -- Created a Trello card for exception/urgent item
    'slack_notify',           -- Posted a Slack message
    'telegram_notify'         -- Sent a Telegram bot message
  ));

-- Extend incoming_webhooks source types for new integrations
ALTER TABLE public.incoming_webhooks
  DROP CONSTRAINT IF EXISTS incoming_webhooks_source_check;

ALTER TABLE public.incoming_webhooks
  ADD CONSTRAINT incoming_webhooks_source_check CHECK (source IN (
    'shipping_email', 'tawk', 'zendesk', 'carrier',
    'easypost', 'shopify', 'amazon', 'etsy',
    'paypal', 'stripe', 'afterpay', 'klarna',
    'klaviyo', 'mailchimp', 'xero', 'google_drive',
    'other'
  ));
