'use client';

import React from 'react';
import { Clock, FileText, DollarSign, Users, TrendingUp, Plus, ArrowRight, Download, Eye, Trash2 } from 'lucide-react';
import { useTimeEntriesStore, useInvoiceStore, useSettingsStore, useNavStore } from '@/lib/store';
import { totalHours, formatCurrency } from '@/lib/utils';

export function DashboardView() {
    const { entries } = useTimeEntriesStore();
    const { invoiceHistory, setCurrentInvoice } = useInvoiceStore();
    const { settings } = useSettingsStore();
    const { setStep, enterInvoiceFlow, setInvoiceFlowStep } = useNavStore();

    const total = totalHours(entries);
    const roles = [...new Set(entries.map((e) => e.role))];
    const refined = entries.filter((e) => e.isRefined).length;

    const handleViewInvoice = (invoice: typeof invoiceHistory[0]) => {
        setCurrentInvoice(invoice);
        setInvoiceFlowStep('invoice');
        setStep('invoice-flow');
    };

    const handleReExportPDF = async (invoice: typeof invoiceHistory[0]) => {
        try {
            const { pdf } = await import('@react-pdf/renderer');
            const { InvoicePDF } = await import('@/lib/pdf/InvoicePDF');

            const rawBlob = await pdf(<InvoicePDF invoice={invoice} logoDataUrl={settings.logoDataUrl} />).toBlob();
            const arrayBuffer = await rawBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
            }
            const base64 = btoa(binary);
            const fileName = `Invoice_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

            const response = await fetch('/api/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64, fileName }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const { url } = await response.json();
            window.open(url, '_blank');
        } catch (err) {
            console.error('PDF re-export failed:', err);
            alert('PDF re-export failed. See console for details.');
        }
    };

    // Calculate total revenue from all saved invoices
    const totalRevenue = invoiceHistory.reduce((sum, inv) => {
        return sum + inv.roles.reduce((rSum, role) => {
            const roleHours = totalHours(inv.entries.filter((e) => e.role === role.role));
            return rSum + Math.round(roleHours * role.rate * 100) / 100;
        }, 0);
    }, 0);

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Welcome to InvoiceForge — your invoice generation pipeline</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        <Clock size={20} />
                    </div>
                    <span className="stat-card-label">Total Hours</span>
                    <span className="stat-card-value">{total.toFixed(1)}</span>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                        <Users size={20} />
                    </div>
                    <span className="stat-card-label">Active Roles</span>
                    <span className="stat-card-value">{roles.length}</span>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                        <TrendingUp size={20} />
                    </div>
                    <span className="stat-card-label">Entries Refined</span>
                    <span className="stat-card-value">{refined}/{entries.length}</span>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                        <DollarSign size={20} />
                    </div>
                    <span className="stat-card-label">Total Revenue</span>
                    <span className="stat-card-value">{formatCurrency(totalRevenue)}</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h2>Quick Actions</h2>
                </div>
                <div className="card-body">
                    <div className="source-grid">
                        <div className="source-card" onClick={() => setStep('projects')}>
                            <div className="source-card-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                                <Plus size={24} />
                            </div>
                            <h3>New Invoice</h3>
                            <p>Create a new invoice from a project</p>
                        </div>
                        <div className="source-card" onClick={() => setStep('projects')}>
                            <div className="source-card-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                                <FileText size={24} />
                            </div>
                            <h3>View Projects</h3>
                            <p>Manage projects, clients, and invoice history</p>
                        </div>
                        <div className="source-card" onClick={() => setStep('settings')}>
                            <div className="source-card-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                                <DollarSign size={24} />
                            </div>
                            <h3>Settings</h3>
                            <p>Configure rates, roles, integrations, and payment details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice History */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h2><FileText size={16} style={{ marginRight: '8px' }} />Invoice History</h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {invoiceHistory.length} invoice{invoiceHistory.length !== 1 ? 's' : ''} saved
                    </span>
                </div>
                <div className="card-body">
                    {invoiceHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                            <FileText size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>No invoices saved yet</p>
                            <p style={{ fontSize: '12px', marginTop: '4px' }}>
                                Generate and save invoices to see them here.
                            </p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Date</th>
                                    <th>Client</th>
                                    <th>Sprint/Phase</th>
                                    <th className="cell-number">Entries</th>
                                    <th className="cell-number">Total</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...invoiceHistory].reverse().map((inv) => {
                                    const invTotal = inv.roles.reduce((sum, role) => {
                                        const hrs = totalHours(inv.entries.filter((e) => e.role === role.role));
                                        return sum + Math.round(hrs * role.rate * 100) / 100;
                                    }, 0);
                                    return (
                                        <tr key={inv.id}>
                                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                                                {inv.invoiceNumber}
                                            </td>
                                            <td>{inv.date}</td>
                                            <td>{inv.client.name}</td>
                                            <td style={{ fontSize: '12px' }}>
                                                {inv.sprintName || '—'}
                                            </td>
                                            <td className="cell-number">{inv.entries.length}</td>
                                            <td className="cell-number" style={{ fontWeight: 700 }}>
                                                {formatCurrency(invTotal)}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    backgroundColor: inv.status === 'finalized' ? 'var(--success-soft)' : 'var(--warning-soft)',
                                                    color: inv.status === 'finalized' ? 'var(--success)' : 'var(--warning)',
                                                }}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="cell-actions" style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="btn btn-icon btn-ghost"
                                                    title="Re-export PDF"
                                                    onClick={() => handleReExportPDF(inv)}
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-ghost"
                                                    title="Load into editor"
                                                    onClick={() => handleViewInvoice(inv)}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Workflow */}
            <div className="card">
                <div className="card-header">
                    <h2>How It Works</h2>
                </div>
                <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        {[
                            { step: '1', title: 'Import', desc: 'Pull hours from Tempo or Clockify' },
                            { step: '2', title: 'Refine', desc: 'AI refines descriptions & categorizes' },
                            { step: '3', title: 'Edit', desc: 'Manual adjustments & review' },
                            { step: '4', title: 'Generate', desc: 'Create PDF invoice & time log' },
                            { step: '5', title: 'Export', desc: 'Download & send to client' },
                        ].map((item, i) => (
                            <React.Fragment key={item.step}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    flex: '1 1 120px',
                                    textAlign: 'center',
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'var(--accent-soft)',
                                        color: 'var(--accent)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: 'var(--text-sm)',
                                    }}>
                                        {item.step}
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.title}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.desc}</span>
                                </div>
                                {i < 4 && (
                                    <ArrowRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
