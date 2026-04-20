import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

// Singleton browser client
let _browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
    if (typeof window !== 'undefined') {
        if (!_browserClient) {
            _browserClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce',
                    // No-op lock — completely disables Web Locks API contention.
                    // This is safe because we use a singleton client and
                    // don't need cross-tab coordination.
                    lock: async <R,>(
                        _name: string,
                        _acquireTimeout: number,
                        fn: () => Promise<R>
                    ): Promise<R> => {
                        return await fn();
                    },
                },
            });
        }
        return _browserClient;
    }
    // Server-side — fresh client each time (no singleton needed)
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Server-side client for API routes
export function createServerClient(): SupabaseClient {
    return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { STORAGE_KEY };
