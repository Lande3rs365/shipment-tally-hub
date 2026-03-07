
-- Clean up existing test company so user can re-test onboarding
DELETE FROM stock_locations WHERE company_id = '3c702cae-f2ea-451b-aab3-8f284ad11c65';
DELETE FROM user_companies WHERE company_id = '3c702cae-f2ea-451b-aab3-8f284ad11c65';
DELETE FROM companies WHERE id = '3c702cae-f2ea-451b-aab3-8f284ad11c65';
