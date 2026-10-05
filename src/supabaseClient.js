import { createClient } from '@supabase/supabase-js';
import { createDemoClient } from './demo/demoClient.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const forceDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

// With no Supabase keys (or ?demo in the address), run in demo mode: sample data, nothing saved.
export const isDemo = forceDemo || !url || !anonKey;
export const supabase = isDemo ? createDemoClient() : createClient(url, anonKey);
