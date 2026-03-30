'use client';

import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, ArrowLeft, CreditCard, Edit3, Users, Building2, CheckCircle2 } from 'lucide-react';
import { useTimeEntriesStore, useInvoiceStore, useSettingsStore, useNavStore, useProjectStore } from '@/lib/store';
import { groupBy, totalHours, formatCurrency, uid } from '@/lib/utils';
import type { InvoiceType, RoleRate, ClientInfo } from '@/types';

export function InvoiceView() {
    const { entries } = useTimeEntriesStore();
    const { currentInvoice, createInvoice, updateInvoice, saveInvoice } = useInvoiceStore();
    const { settings } = useSettingsStore();
    const { activeProjectId, projects } = useProjectStore();
    const { setInvoiceFlowStep } = useNavStore();

    // Get project client or fall back to global default
    const activeProject = projects.find((p) => p.id === activeProjectId);
    const projectClient = activeProject?.client || settings.defaultClient;

    const [invoiceType, setInvoiceType] = useState<InvoiceType>('sprint');
    const [invoiceNumber, setInvoiceNumber] = useState('OU-2025-19');
    const [sprintName, setSprintName] = useState('Sprint 5 Development');
    const [dateRange, setDateRange] = useState('September 1-12, 2025');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }));
    const [dueDate, setDueDate] = useState('');
    const [summary, setSummary] = useState('');
    const [note, setNote] = useState(settings.payment.notes || '');

    // Client details - initialized from project's client
    const [clientName, setClientName] = useState(projectClient.name);
    const [clientAddress, setClientAddress] = useState(projectClient.address);
    const [clientCity, setClientCity] = useState(projectClient.city);
    const [clientState, setClientState] = useState(projectClient.state);
    const [clientZip, setClientZip] = useState(projectClient.zip);
    const [clientCountry, setClientCountry] = useState(projectClient.country);

    // Editable roles/rates
    const [invoiceRoles, setInvoiceRoles] = useState<RoleRate[]>(() =>
        settings.defaultRoles.map((r) => ({ ...r }))
    );

    // Payment details
    const [payAccountHolder, setPayAccountHolder] = useState(settings.payment.accountHolder || '');
    const [payAccountNumber, setPayAccountNumber] = useState(settings.payment.accountNumber || '');
    const [payRoutingNumber, setPayRoutingNumber] = useState(settings.payment.routingNumber || '');
    const [payAccountType, setPayAccountType] = useState(settings.payment.accountType || 'Deposit');
    const [payEmail, setPayEmail] = useState(settings.payment.contactEmail || 'accounting@outthere.solutions');
    const [payPhone, setPayPhone] = useState(settings.payment.contactPhone || '647-873-4788');

    const grouped = groupBy(entries, 'role');

    const { updateSettings } = useSettingsStore();
    const updateRoleRate = (roleId: string, newRate: number) => {
        const updated = invoiceRoles.map((r) => (r.id === roleId ? { ...r, rate: newRate } : r));
        setInvoiceRoles(updated);
        // Also persist to global settings so rates survive across reloads
        updateSettings({ defaultRoles: updated });
    };

    const roleStats = useMemo(() => {
        return Object.entries(grouped).map(([role, roleEntries]) => {
            const hours = totalHours(roleEntries);
            const rateConfig = invoiceRoles.find((r) => r.role === role);
            const rate = rateConfig?.rate || 120;
            const resources = [...new Set(roleEntries.map((e) => e.resource))];
            return {
                role,
                label: rateConfig?.label || role,
                roleId: rateConfig?.id || role,
                count: resources.length > 1 ? resources.length : undefined,
                hours,
                rate,
                total: Math.round(hours * rate * 100) / 100,
            };
        });
    }, [grouped, invoiceRoles]);

    const grandTotal = roleStats.reduce((sum, r) => sum + r.total, 0);
    const grandHours = roleStats.reduce((sum, r) => sum + r.hours, 0);

    // Category grouping for preview table (matching template format)
    const categoryGroups = useMemo(() => {
        return Object.entries(groupBy(entries, 'category')).map(([category, catEntries]) => {
            const hours = totalHours(catEntries);
            const taskDescriptions = [...new Set(catEntries.map((e) => {
                if (e.ticketKey && e.ticketSummary) {
                    return `[${e.ticketKey}] ${e.ticketSummary}`;
                }
                return e.taskName || e.description;
            }).filter(Boolean))];
            return { category, hours, taskDescriptions };
        });
    }, [entries]);

    const buildClientInfo = (): ClientInfo => ({
        name: clientName,
        address: clientAddress,
        city: clientCity,
        state: clientState,
        zip: clientZip,
        country: clientCountry,
    });

    const buildInvoiceData = () => ({
        id: uid(),
        projectId: activeProjectId || undefined,
        invoiceNumber,
        date: invoiceDate,
        reference: `INV-${invoiceNumber}`,
        sprintName,
        dateRange,
        type: invoiceType,
        summary,
        note,
        dueDate,
        client: buildClientInfo(),
        company: settings.company,
        payment: {
            accountHolder: payAccountHolder,
            accountNumber: payAccountNumber,
            routingNumber: payRoutingNumber,
            accountType: payAccountType,
            contactEmail: payEmail,
            contactPhone: payPhone,
            notes: note,
        },
        roles: invoiceRoles,
        entries,
        logoDataUrl: settings.logoDataUrl,
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    const [saved, setSaved] = useState(false);

    const handleGenerate = () => {
        // Persist all invoice settings back to store for future invoices
        persistCurrentSettings();

        if (currentInvoice) {
            updateInvoice(buildInvoiceData());
        } else {
            createInvoice(buildInvoiceData());
        }
        saveInvoice();

        // Show confirmation feedback
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Save current invoice field values back to settings so they auto-populate next time
    const persistCurrentSettings = () => {
        updateSettings({
            defaultClient: buildClientInfo(),
            payment: {
                accountHolder: payAccountHolder,
                accountNumber: payAccountNumber,
                routingNumber: payRoutingNumber,
                accountType: payAccountType,
                contactEmail: payEmail,
                contactPhone: payPhone,
                notes: note,
            },
            defaultRoles: invoiceRoles,
        });
        // Also update project-level client if we have an active project
        if (activeProjectId && activeProject) {
            const { updateProject } = useProjectStore.getState();
            updateProject(activeProjectId, { client: buildClientInfo() });
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportPDF = async () => {
        if (exporting) return;
        setExporting(true);
        persistCurrentSettings();
        try {
            const { pdf } = await import('@react-pdf/renderer');
            const { InvoicePDF } = await import('@/lib/pdf/InvoicePDF');

            const invoiceData = buildInvoiceData();
            const pdfDoc = pdf(<InvoicePDF invoice={invoiceData} logoDataUrl={settings.logoDataUrl} />);
            const rawBlob = await pdfDoc.toBlob();

            if (!rawBlob || rawBlob.size === 0) {
                throw new Error('Generated PDF blob is empty');
            }

            // Convert blob to base64 for server transport
            const arrayBuffer = await rawBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
            }
            const base64 = btoa(binary);

            const fileName = `Invoice_${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

            // POST to server which writes the file to public/exports/
            const response = await fetch('/api/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64, fileName }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server error ${response.status}: ${errText}`);
            }

            const { url } = await response.json();

            // Navigate to the file URL — this is a real file on disk, guaranteed download
            window.open(url, '_blank');

            console.log('[PDF] File written to server, opening:', url);
            setExporting(false);
        } catch (err) {
            console.error('[PDF] Generation failed:', err);
            setExporting(false);
            alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    if (entries.length === 0) {
        return (
            <div className="page-container">
                <div className="page-header">
                    <h1>Generate Invoice</h1>
                    <p>Create and export publication-quality PDF invoices</p>
                </div>
                <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={28} /></div>
                    <h3>No Time Entries</h3>
                    <p>Import and edit time entries before generating an invoice.</p>
                    <button className="btn btn-primary" onClick={() => setInvoiceFlowStep('import')}>Import Hours</button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Generate Invoice</h1>
                    <p>
                        Configure and export your invoice
                        {activeProject && (
                            <span style={{ marginLeft: '8px', padding: '2px 10px', borderRadius: '12px', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
                                📁 {activeProject.name}
                            </span>
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn btn-secondary" onClick={() => setInvoiceFlowStep('editor')}>
                        <ArrowLeft size={16} /> Back to Editor
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                {/* Left: Configuration */}
                <div>
                    {/* Invoice Config */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3>Invoice Configuration</h3></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Invoice Type</label>
                                    <select className="form-select" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}>
                                        <option value="sprint">Sprint-Based</option>
                                        <option value="maintenance">Maintenance</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Invoice Number</label>
                                    <input className="form-input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Invoice Date</label>
                                    <input className="form-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="10/15/2025" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Date Range</label>
                                    <input className="form-input" value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="September 1-12, 2025" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sprint / Phase Name</label>
                                    <input className="form-input" value={sprintName} onChange={(e) => setSprintName(e.target.value)} placeholder="Sprint 5 Development" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Invoice Summary</label>
                                <textarea className="form-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief description of the work covered in this invoice..." style={{ minHeight: '80px' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note (appears above payment details)</label>
                                <textarea className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any notes or disclaimers to include..." style={{ minHeight: '60px' }} />
                            </div>
                        </div>
                    </div>

                    {/* Client Details (Bill To) */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header">
                            <h3><Building2 size={16} style={{ marginRight: '8px' }} />Client Details (Bill To)</h3>
                            {activeProject && (
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>from: {activeProject.name}</span>
                            )}
                        </div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Client Name</label>
                                <input className="form-input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input className="form-input" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="123 Main St" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">City</label>
                                    <input className="form-input" value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">State</label>
                                    <input className="form-input" value={clientState} onChange={(e) => setClientState(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">ZIP Code</label>
                                    <input className="form-input" value={clientZip} onChange={(e) => setClientZip(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Country</label>
                                    <input className="form-input" value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3><CreditCard size={16} style={{ marginRight: '8px' }} />Payment Details</h3></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Account Holder Name</label>
                                    <input className="form-input" value={payAccountHolder} onChange={(e) => setPayAccountHolder(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Account Type</label>
                                    <input className="form-input" value={payAccountType} onChange={(e) => setPayAccountType(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Account Number</label>
                                    <input className="form-input" value={payAccountNumber} onChange={(e) => setPayAccountNumber(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Routing Number</label>
                                    <input className="form-input" value={payRoutingNumber} onChange={(e) => setPayRoutingNumber(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Contact Email</label>
                                    <input className="form-input" value={payEmail} onChange={(e) => setPayEmail(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contact Phone</label>
                                    <input className="form-input" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rate Configuration */}
                    <div className="card">
                        <div className="card-header">
                            <h3><Edit3 size={16} style={{ marginRight: '8px' }} />Rate Configuration</h3>
                        </div>
                        <div className="card-body">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Role</th>
                                        <th className="cell-number">Hours</th>
                                        <th className="cell-number">Rate ($/hr)</th>
                                        <th className="cell-number">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roleStats.map((rs) => (
                                        <tr key={rs.role}>
                                            <td style={{ fontWeight: 600 }}>{rs.label}{rs.count ? ` (${rs.count})` : ''}</td>
                                            <td className="cell-number">{rs.hours.toFixed(1)}</td>
                                            <td className="cell-number">
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={rs.rate}
                                                    onChange={(e) => updateRoleRate(rs.roleId, parseInt(e.target.value) || 0)}
                                                    style={{
                                                        width: '90px', padding: '4px 8px', textAlign: 'right',
                                                        fontWeight: 600, backgroundColor: 'var(--surface-elevated)',
                                                        border: '1px solid var(--accent)',
                                                    }}
                                                    min={0}
                                                />
                                            </td>
                                            <td className="cell-number" style={{ fontWeight: 700 }}>{formatCurrency(rs.total)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border-light)' }}>
                                        <td style={{ fontWeight: 800 }}>Grand Total</td>
                                        <td className="cell-number" style={{ fontWeight: 700 }}>{grandHours.toFixed(1)}</td>
                                        <td></td>
                                        <td className="cell-number" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 'var(--text-lg)' }}>
                                            {formatCurrency(grandTotal)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Preview */}
                <div>
                    <div className="card" style={{ position: 'sticky', top: 'var(--space-8)' }}>
                        <div className="card-header">
                            <h3><Eye size={16} style={{ marginRight: '8px' }} />Invoice Preview</h3>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            <div className="invoice-preview" style={{ transform: 'scale(0.72)', transformOrigin: 'top center', margin: '-80px 0' }}>
                                <div className="invoice-accent-bar" />
                                <div className="invoice-preview-page" style={{ padding: '32px', minHeight: '620px' }}>
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {settings.logoDataUrl ? (
                                                <img src={settings.logoDataUrl} alt="Logo" style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '8px' }} />
                                            ) : (
                                                <div style={{
                                                    width: '44px', height: '44px', borderRadius: '50%',
                                                    border: '3px solid #222', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: '12px', fontWeight: 800
                                                }}>
                                                    <svg width="24" height="24" viewBox="0 0 100 100">
                                                        <circle cx="50" cy="50" r="46" stroke="#222" strokeWidth="4" fill="none" />
                                                        <path d="M30 65 L50 30 L70 65" stroke="#222" strokeWidth="4" fill="none" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            )}
                                            <span style={{ fontSize: '20px', fontWeight: 600, color: '#333' }}>{settings.company.name}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '22px', fontWeight: 700 }}>Invoice  </span>
                                            <span style={{ fontSize: '14px', color: '#e85d4a' }}>N° </span>
                                            <span style={{ fontSize: '22px', fontWeight: 700, color: '#e85d4a' }}>{invoiceNumber}</span>
                                        </div>
                                    </div>

                                    {/* Billing — Full Details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '18px', fontSize: '10px', color: '#444' }}>
                                        <div>
                                            <strong style={{ color: '#e85d4a', textTransform: 'uppercase', fontSize: '9px' }}>To:</strong><br />
                                            <strong>{clientName}</strong><br />
                                            {clientAddress}<br />
                                            {clientCity}, {clientState}<br />
                                            {clientZip}<br />
                                            {clientCountry}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#333', textTransform: 'uppercase', fontSize: '9px', textDecoration: 'underline' }}>From:</strong><br />
                                            <strong>{settings.company.name}</strong><br />
                                            {settings.company.address}<br />
                                            {settings.company.city}, {settings.company.state}<br />
                                            {settings.company.zip}<br />
                                            {settings.company.country}
                                        </div>
                                        <div>
                                            <strong style={{ color: '#333', textTransform: 'uppercase', fontSize: '9px', textDecoration: 'underline' }}>Info:</strong><br />
                                            Date: {invoiceDate}<br />
                                            Ref: INV-{invoiceNumber}
                                            {dueDate && <><br />Due: {dueDate}</>}
                                        </div>
                                    </div>

                                    {/* Invoice Summary */}
                                    {summary && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '6px' }}>Invoice Summary</div>
                                            <div style={{ fontSize: '10px', color: '#333', lineHeight: 1.6 }}>{summary}</div>
                                        </div>
                                    )}

                                    {/* Summary Table — Role-based line items */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                        <thead>
                                            <tr style={{ background: '#f5f5f5' }}>
                                                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Resource</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Hrs</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Rate</th>
                                                <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roleStats.map((rs) => (
                                                <tr key={rs.role}>
                                                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
                                                        {rs.label}{rs.count ? ` (${rs.count})` : ''}
                                                    </td>
                                                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                                                        {rs.hours.toFixed(1)}
                                                    </td>
                                                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right', color: '#666' }}>
                                                        ${rs.rate}/hr
                                                    </td>
                                                    <td style={{ padding: '5px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700 }}>
                                                        {formatCurrency(rs.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Total */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', marginBottom: '14px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>
                                            Total <span style={{ color: '#888' }}>(USD)</span>
                                        </span>
                                        <span style={{ fontSize: '26px', fontWeight: 800, color: '#e85d4a' }}>{formatCurrency(grandTotal)}</span>
                                    </div>

                                    {/* Payment Box */}
                                    <div style={{
                                        backgroundColor: '#f5f3f0', borderRadius: '6px', padding: '12px 16px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px'
                                    }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#e85d4a' }}>Payment Details</span>
                                        <div style={{ textAlign: 'right' }}>
                                            {payAccountHolder && <div><strong>NAME:</strong> {payAccountHolder}</div>}
                                            {payAccountNumber && <div><strong>ACCOUNT NO:</strong> {payAccountNumber}</div>}
                                            {payRoutingNumber && <div><strong>ROUTING NO:</strong> {payRoutingNumber}</div>}
                                            {payAccountType && <div><strong>ACCOUNT TYPE:</strong> {payAccountType}</div>}
                                            {dueDate && <div style={{ color: '#e85d4a', fontWeight: 700, fontSize: '10px', marginTop: '4px' }}>DUE: {dueDate}</div>}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ borderTop: '1px solid #ddd', marginTop: '14px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#888' }}>
                                        <span style={{ textDecoration: 'underline' }}>{payEmail}</span>
                                        <span>{payPhone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-footer" style={{ flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <button className="btn btn-primary btn-lg" onClick={handleExportPDF} disabled={exporting} style={{ width: '100%', opacity: exporting ? 0.7 : 1 }}>
                                {exporting ? (
                                    <><span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating PDF...</>
                                ) : (
                                    <><Download size={18} /> Export as PDF</>
                                )}
                            </button>
                            <button className="btn btn-secondary" onClick={handleGenerate} style={{ width: '100%', transition: 'all 0.3s' }}>
                                {saved ? (
                                    <><CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> Saved!</>
                                ) : (
                                    <><FileText size={16} /> Save Invoice</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
