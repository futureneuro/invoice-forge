'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
    useSettingsStore,
    useTimeEntriesStore,
    useInvoiceStore,
    useProjectStore,
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

    const hydrateStores = useCallback(async (userId: string) => {
        try {
            await Promise.all([
                useSettingsStore.getState().loadFromSupabase(userId),
                useTimeEntriesStore.getState().loadFromSupabase(userId),
                useInvoiceStore.getState().loadFromSupabase(userId),
                useProjectStore.getState().loadFromSupabase(userId),
            ]);
        } catch (err) {
            console.error('[AuthProvider] Failed to hydrate stores:', err);
        }
    }, []);

    useEffect(() => {
        const supabase = createClient();

        // Get initial user
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            setUser(user);
            if (user) {
                await hydrateStores(user.id);
            }
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                const newUser = session?.user ?? null;
                setUser(newUser);
                if (newUser) {
                    await hydrateStores(newUser.id);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [hydrateStores]);

    return (
        <AuthContext.Provider value={{ user, loading, userId: user?.id ?? null }}>
            {children}
        </AuthContext.Provider>
    );
}
