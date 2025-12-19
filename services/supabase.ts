import { createClient } from '@supabase/supabase-js';

// Vercel se keys uthayega
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL aur Key missing hai!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
