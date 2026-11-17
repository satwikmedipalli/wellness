// Supabase Edge Function entry point. All logic lives in core.js.
import { makeHandler } from './core.js';

Deno.serve(makeHandler({
  env: {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    WELLNESS_KEY: Deno.env.get('WELLNESS_KEY') ?? '',
    WELLNESS_TZ: Deno.env.get('WELLNESS_TZ') ?? 'America/New_York'
  }
}));
