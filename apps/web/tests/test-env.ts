export function setTestEnv() {
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-tests-1234567890';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-1234567890';
  process.env.OPENAI_API_KEY = 'openai-key-for-tests-1234567890';
  process.env.STRIPE_SECRET_KEY = 'stripe-secret-for-tests-1234567890';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'stripe-publishable-for-tests-1234567890';
  process.env.STRIPE_WEBHOOK_SECRET = 'stripe-webhook-for-tests-1234567890';
  process.env.PAYMONGO_SECRET_KEY = 'paymongo-secret-for-tests-1234567890';
  process.env.PAYMONGO_WEBHOOK_SECRET = 'paymongo-webhook-for-tests-1234567890';
  process.env.PAYMONGO_API_BASE_URL = 'https://api.paymongo.test/v1';
  process.env.EXTENSION_PAIRING_SECRET = 'pairing-secret-for-tests-1234567890';
}
