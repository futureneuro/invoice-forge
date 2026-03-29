'use client';

import { useEffect, useState } from 'react';

export default function TransferPage() {
    const [status, setStatus] = useState('Loading...');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    useEffect(() => {
        const keys = [
            'invoice-forge-settings',
            'invoice-forge-entries',
            'invoice-forge-invoices',
            'invoice-forge-projects',
        ];
        const data: Record<string, string> = {};
        let count = 0;
        keys.forEach((k) => {
            const v = localStorage.getItem(k);
            if (v) {
                data[k] = v;
                count++;
            }
        });

        if (count === 0) {
            // Check if we're on Azure (import mode)
            setStatus('No local data found. Use the file picker below to import your backup.');
            return;
        }

        // Export mode
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setStatus(`Found ${count} data stores ready to export.`);
    }, []);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string);
                let count = 0;
                Object.entries(data).forEach(([k, v]) => {
                    if (k.startsWith('invoice-forge-')) {
                        localStorage.setItem(k, v as string);
                        count++;
                    }
                });
                setStatus(`✅ Imported ${count} data stores! Reloading in 2 seconds...`);
                setTimeout(() => { window.location.href = '/'; }, 2000);
            } catch {
                setStatus('❌ Invalid file format.');
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
                <h2 style={{ margin: '0 0 8px' }}>Data Transfer</h2>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>{status}</p>

                {downloadUrl && (
                    <a
                        href={downloadUrl}
                        download="invoiceforge-backup.json"
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
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '14px',
                    }}>
                        ⬆ Import Backup
                        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                    </label>
                </div>

                <p style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
                    Step 1: Open this page on localhost → Download backup<br />
                    Step 2: Open this page on Azure → Import backup
                </p>
            </div>
        </div>
    );
}
