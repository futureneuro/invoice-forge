'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import * as db from '@/lib/supabase-data';

export default function TransferPage() {
    const [status, setStatus] = useState('Checking authentication...');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const user = session?.user;
            if (!user) {
                setStatus('Not logged in. Please sign in first to export/import data.');
                return;
            }
            setUserId(user.id);

            // Load all data from Supabase
            try {
                const [settings, projects, invoices, drafts, entries] = await Promise.all([
                    db.loadSettings(user.id),
                    db.loadProjects(user.id),
                    db.loadInvoiceHistory(user.id),
                    db.loadDrafts(user.id),
                    db.loadTimeEntries(user.id),
                ]);

                const backup = {
                    exportedAt: new Date().toISOString(),
                    userId: user.id,
                    email: user.email,
                    settings,
                    projects,
                    invoices,
                    drafts,
                    entries: entries?.entries || [],
                    versions: entries?.versions || [],
                };

                const hasData = settings || projects.length > 0 || invoices.length > 0;

                if (!hasData) {
                    setStatus('No data found in your account. Use the Import button to restore a backup.');
                    return;
                }

                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                setDownloadUrl(url);
                setStatus(`Found data ready to export: ${projects.length} projects, ${invoices.length} invoices.`);
            } catch (err) {
                console.error('Export error:', err);
                setStatus('Error loading data. See console for details.');
            }
        });
    }, []);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const backup = JSON.parse(reader.result as string);
                setStatus('Importing data...');

                // Restore settings
                if (backup.settings) {
                    await db.saveSettings(userId, backup.settings);
                }

                // Restore projects
                if (backup.projects?.length) {
                    for (const project of backup.projects) {
                        await db.saveProject(userId, project);
                    }
                }

                // Restore invoices
                if (backup.invoices?.length) {
                    for (const invoice of backup.invoices) {
                        await db.saveInvoiceToHistory(userId, invoice);
                    }
                }

                // Restore drafts
                if (backup.drafts) {
                    for (const [projectId, draft] of Object.entries(backup.drafts)) {
                        await db.saveDraftToDB(userId, projectId, draft as db.DraftRow);
                    }
                }

                // Restore time entries
                if (backup.entries?.length || backup.versions?.length) {
                    await db.saveTimeEntries(
                        userId,
                        backup.entries || [],
                        backup.versions || []
                    );
                }

                // Also handle legacy localStorage format
                if (backup['invoice-forge-settings']) {
                    const legacySettings = JSON.parse(backup['invoice-forge-settings']);
                    if (legacySettings.state?.settings) {
                        await db.saveSettings(userId, legacySettings.state.settings);
                    }
                }

                setStatus(`✅ Import complete! Redirecting in 2 seconds...`);
                setTimeout(() => { window.location.href = '/'; }, 2000);
            } catch (err) {
                console.error('Import error:', err);
                setStatus('❌ Import failed. Check the file format.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
            fontFamily: "'Inter', sans-serif",
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '40px',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'center',
            }}>
                <h2 style={{ margin: '0 0 8px' }}>Data Backup & Restore</h2>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{status}</p>

                {downloadUrl && (
                    <a
                        href={downloadUrl}
                        download={`invoiceforge-backup-${new Date().toISOString().split('T')[0]}.json`}
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            background: '#e85d4a',
                            color: '#fff',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '15px',
                            marginBottom: '16px',
                        }}
                    >
                        ⬇ Download Backup
                    </a>
                )}

                <div style={{ marginTop: '16px' }}>
                    <label style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        background: '#f0f0f0',
                        borderRadius: '8px',
                        cursor: userId ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        fontSize: '14px',
                        opacity: userId ? 1 : 0.5,
                    }}>
                        ⬆ Import Backup
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            disabled={!userId}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>

                <p style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
                    Export creates a complete backup of all your settings, projects,<br />
                    invoices, and time entries from your Supabase account.
                </p>
            </div>
        </div>
    );
}
