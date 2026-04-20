'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import {
    useSettingsStore,
    useTimeEntriesStore,
    useInvoiceStore,
    useProjectStore,
    setCurrentUserId,
} from '@/lib/store';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    userId: string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    userId: null,
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const hydrationDone = useRef(false);

    const hydrateStores = useCallback(async (userId: string) => {
        if (hydrationDone.current) return;
        hydrationDone.current = true;
        setCurrentUserId(userId);
        console.log('[AuthProvider] Starting store hydration for:', userId);
        try {
            // Load SEQUENTIALLY to avoid overwhelming the client
            console.log('[AuthProvider] Loading settings...');
            await useSettingsStore.getState().loadFromSupabase(userId);
            console.log('[AuthProvider] ✅ Settings loaded');

            console.log('[AuthProvider] Loading time entries...');
            await useTimeEntriesStore.getState().loadFromSupabase(userId);
            console.log('[AuthProvider] ✅ Time entries loaded');

            console.log('[AuthProvider] Loading invoices...');
            await useInvoiceStore.getState().loadFromSupabase(userId);
            console.log('[AuthProvider] ✅ Invoices loaded');

            console.log('[AuthProvider] Loading projects...');
            await useProjectStore.getState().loadFromSupabase(userId);
            console.log('[AuthProvider] ✅ Projects loaded');

            console.log('[AuthProvider] ✅ All stores hydrated!');
        } catch (err: unknown) {
            console.error('[AuthProvider] Hydration error:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        // DO NOT hydrate inside onAuthStateChange — it causes a deadlock
        // because the Supabase client's getSession() waits for onAuthStateChange
        // to complete, but onAuthStateChange is waiting for the data queries
        // that internally call getSession().
        //
        // Instead: just capture the user from the auth event, then hydrate
        // in a separate microtask.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log('[AuthProvider] Auth event:', event, session?.user?.email);
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser && !hydrationDone.current) {
                    // Schedule hydration OUTSIDE the onAuthStateChange callback
                    // to avoid the getSession() deadlock
                    setTimeout(() => {
                        if (!cancelled) {
                            hydrateStores(currentUser.id);
                        }
                    }, 0);
                } else if (!currentUser) {
                    setCurrentUserId(null);
                    setLoading(false);
                }
            }
        );

        // Safety timeout
        const timeout = setTimeout(() => {
            if (!hydrationDone.current) {
                console.warn('[AuthProvider] Timed out — forcing load.');
                setLoading(false);
            }
        }, 15000);

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydrateStores]);

    return (
        <AuthContext.Provider value={{ user, loading, userId: user?.id ?? null }}>
            {children}
        </AuthContext.Provider>
    );
}
