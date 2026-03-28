'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            window.location.href = '/';
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logoRow}>
                    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="46" stroke="#e85d4a" strokeWidth="4" fill="none" />
                        <path d="M30 65 L50 30 L70 65" stroke="#e85d4a" strokeWidth="4" fill="none" strokeLinejoin="round" />
                        <path d="M40 65 L55 42 L70 65" stroke="#e85d4a" strokeWidth="3" fill="none" strokeLinejoin="round" />
                    </svg>
                    <span style={styles.logoText}>InvoiceForge</span>
                </div>
                <p style={styles.subtitle}>Sign in to your account</p>

                <form onSubmit={handleLogin} style={styles.form}>
                    {error && <div style={styles.error}>{error}</div>}

                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={styles.input}
                            placeholder="you@example.com"
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={styles.input}
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.button}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    card: {
        background: '#fff',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px',
    },
    logoText: {
        fontSize: '24px',
        fontWeight: 700,
        color: '#111',
    },
    subtitle: {
        fontSize: '14px',
        color: '#666',
        marginBottom: '32px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
    },
    label: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#333',
    },
    input: {
        padding: '12px 14px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    button: {
        padding: '12px',
        background: '#e85d4a',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: '8px',
    },
    error: {
        background: '#fef2f2',
        color: '#dc2626',
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        border: '1px solid #fecaca',
    },
};
