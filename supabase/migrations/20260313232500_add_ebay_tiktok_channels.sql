-- ============================================================
-- Add eBay and TikTok Shop as supported sales channels
-- and integration types.
-- ============================================================

-- integration_configs: extend allowed integration types
ALTER TABLE public.integration_configs
  DROP CONSTRAINT IF EXISTS integration_configs_integration_type_check;

ALTER TABLE public.integration_configs
  ADD CONSTRAINT integration_configs_integration_type_check CHECK (integration_type IN (
    -- Shipping & carriers
    'easypost', 'shippo', 'australia_post',
    -- E-commerce channels
    'shopify', 'amazon', 'etsy', 'woocommerce', 'ebay', 'tiktok_shop',
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
  ));

-- sales_channels: extend allowed channel types
ALTER TABLE public.sales_channels
  DROP CONSTRAINT IF EXISTS sales_channels_channel_type_check;

ALTER TABLE public.sales_channels
  ADD CONSTRAINT sales_channels_channel_type_check CHECK (channel_type IN (
    'shopify', 'amazon', 'etsy', 'woocommerce', 'ebay', 'tiktok_shop', 'manual', 'other'
  ));

-- incoming_webhooks: extend allowed sources
ALTER TABLE public.incoming_webhooks
  DROP CONSTRAINT IF EXISTS incoming_webhooks_source_check;

ALTER TABLE public.incoming_webhooks
  ADD CONSTRAINT incoming_webhooks_source_check CHECK (source IN (
    'shipping_email', 'tawk', 'zendesk', 'carrier',
    'easypost', 'shopify', 'amazon', 'etsy', 'ebay', 'tiktok_shop',
    'paypal', 'stripe', 'afterpay', 'klarna',
    'klaviyo', 'mailchimp', 'xero', 'google_drive',
    'other'
  ));

-- agent_actions: add channel import types for new platforms
ALTER TABLE public.agent_actions
  DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;

ALTER TABLE public.agent_actions
  ADD CONSTRAINT agent_actions_action_type_check CHECK (action_type IN (
    'tracking_chase', 'tracking_extract', 'customer_notify', 'customer_chase',
    'ticket_match', 'whatsapp_cob_summary', 'whatsapp_urgent', 'record_update',
    'exception_flag', 'easypost_sync', 'xero_invoice_sync', 'payment_reconcile',
    'channel_order_import', 'klaviyo_send', 'mailchimp_send', 'drive_file_import',
    'trello_card_create', 'slack_notify', 'telegram_notify'
  ));
