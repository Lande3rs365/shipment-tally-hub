
UPDATE profiles SET onboarding_completed = true WHERE user_id = '8f48c190-92ef-4001-b58d-a93778c860c9';

INSERT INTO user_companies (user_id, company_id, role)
VALUES ('8f48c190-92ef-4001-b58d-a93778c860c9', '96eddfc8-494d-48b7-8f5a-28fa90497ae2', 'owner')
ON CONFLICT DO NOTHING;
