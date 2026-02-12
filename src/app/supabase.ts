import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xpggmrkipeernskkmorj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ2dtcmtpcGVlcm5za2ttb3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MDgyNDcsImV4cCI6MjA4NjQ4NDI0N30.dh9rNmC81AxZTlJkxKUsIj14MH06wPMCTLB6qoY2dfU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
