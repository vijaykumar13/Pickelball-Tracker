import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tdkrnwxxviooapcbyzne.supabase.co';
const supabaseAnonKey = 'sb_publishable_1K9RnON745rBftsoIxigwA_UIVwJHm7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
