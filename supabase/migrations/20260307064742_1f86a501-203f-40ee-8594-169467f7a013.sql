
-- Clean up test data so user can test onboarding fresh
DELETE FROM stock_locations WHERE company_id = 'c46e5c8e-b538-4556-9dad-2f74c7e41e31';
DELETE FROM user_companies WHERE company_id = 'c46e5c8e-b538-4556-9dad-2f74c7e41e31';
DELETE FROM companies WHERE id = 'c46e5c8e-b538-4556-9dad-2f74c7e41e31';
