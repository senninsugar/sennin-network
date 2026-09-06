const config = window.SENNIN_CONFIG;
export const supabase = window.supabase.createClient(config.url, config.key);
