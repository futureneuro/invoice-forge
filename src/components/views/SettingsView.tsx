'use client';

import React, { useRef, useState } from 'react';
import { Save, Key, Building, User, CreditCard, DollarSign, Plus, Trash2, Upload, Users, Image } from 'lucide-react';
import { useSettingsStore } from '@/lib/store';
import type { RoleRate, ResourceRoleMapping } from '@/types';
import { uid } from '@/lib/utils';

export function SettingsView() {
    const { settings, updateSettings, updateTempo, updateClockify, updateAI } = useSettingsStore();
    const logoInputRef = useRef<HTMLInputElement>(null);

    const updateRole = (id: string, updates: Partial<RoleRate>) => {
        const newRoles = settings.defaultRoles.map((r) =>
            r.id === id ? { ...r, ...updates } : r
        );
        updateSettings({ defaultRoles: newRoles });
    };

    const addRole = () => {
        const newRoles = [...settings.defaultRoles, { id: uid(), role: '', label: '', rate: 120 }];
        updateSettings({ defaultRoles: newRoles });
    };

    const deleteRole = (id: string) => {
        updateSettings({ defaultRoles: settings.defaultRoles.filter((r) => r.id !== id) });
    };

    // --- Resource-to-Role mapping helpers ---
    const mappings = settings.resourceRoleMappings || [];

    const addMapping = () => {
        updateSettings({
            resourceRoleMappings: [...mappings, { resourceName: '', role: '' }],
        });
    };

    const updateMapping = (idx: number, updates: Partial<ResourceRoleMapping>) => {
        const newMappings = mappings.map((m, i) => (i === idx ? { ...m, ...updates } : m));
        updateSettings({ resourceRoleMappings: newMappings });
    };

    const deleteMapping = (idx: number) => {
        updateSettings({ resourceRoleMappings: mappings.filter((_, i) => i !== idx) });
    };

    // --- Logo upload ---
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            updateSettings({ logoDataUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const removeLogo = () => {
        updateSettings({ logoDataUrl: undefined });
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Settings</h1>
                <p>Configure API keys, company details, rates, and preferences</p>
            </div>

            {/* API Keys */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3><Key size={16} style={{ marginRight: '8px' }} />API Integrations</h3>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {/* AI */}
                    <div>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--accent)' }}>
                            🤖 AI (Anthropic Claude)
                        </h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">API Key</label>
                                <input className="form-input" type="password" value={settings.ai.anthropicApiKey} onChange={(e) => updateAI({ anthropicApiKey: e.target.value })} placeholder="sk-ant-..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Model</label>
                                <select className="form-select" value={settings.ai.model} onChange={(e) => updateAI({ model: e.target.value })}>
                                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                                    <option value="claude-opus-4-20250514">Claude Opus 4</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Tempo */}
                    <div>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: '#4C9AFF' }}>
                            ⏱ Tempo (Jira)
                        </h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Tempo API Token</label>
                                <input className="form-input" type="password" value={settings.tempo.apiToken} onChange={(e) => updateTempo({ apiToken: e.target.value })} placeholder="Your Tempo API token" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jira Base URL</label>
                                <input className="form-input" value={settings.tempo.jiraBaseUrl} onChange={(e) => updateTempo({ jiraBaseUrl: e.target.value })} placeholder="https://yourorg.atlassian.net" />
                            </div>
                        </div>
                        <div className="form-row" style={{ marginTop: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Jira Email</label>
                                <input className="form-input" value={settings.tempo.jiraEmail || ''} onChange={(e) => updateTempo({ jiraEmail: e.target.value })} placeholder="your-email@company.com" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jira API Token</label>
                                <input className="form-input" type="password" value={settings.tempo.jiraApiToken || ''} onChange={(e) => updateTempo({ jiraApiToken: e.target.value })} placeholder="Atlassian API token for user resolution" />
                            </div>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Jira email + API token are needed to resolve team member names from Tempo. <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Create API token →</a>
                        </p>
                    </div>

                    {/* Clockify */}
                    <div>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-3)', color: '#03A9F4' }}>
                            🕐 Clockify
                        </h4>
                        <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                            <label className="form-label">API Key</label>
                            <input className="form-input" type="password" value={settings.clockify.apiKey} onChange={(e) => updateClockify({ apiKey: e.target.value })} placeholder="Your Clockify API key" />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Workspace ID
                                {settings.clockify.apiKey && !settings.clockify.workspaceId && (
                                    <button
                                        className="btn btn-sm"
                                        style={{ padding: '2px 10px', fontSize: '10px', background: '#03A9F4', color: '#fff', border: 'none', borderRadius: '6px' }}
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('https://api.clockify.me/api/v1/workspaces', {
                                                    headers: { 'X-Api-Key': settings.clockify.apiKey },
                                                });
                                                if (!res.ok) throw new Error(`API error: ${res.status}`);
                                                const workspaces = await res.json();
                                                if (workspaces.length > 0) {
                                                    updateClockify({ workspaceId: workspaces[0].id });
                                                }
                                            } catch { /* silently fail */ }
                                        }}
                                    >
                                        ⚡ Auto-detect
                                    </button>
                                )}
                                {settings.clockify.workspaceId && (
                                    <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 400 }}>✓ Connected</span>
                                )}
                            </label>
                            <input className="form-input" value={settings.clockify.workspaceId} onChange={(e) => updateClockify({ workspaceId: e.target.value })} placeholder="Auto-detected or paste manually" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Company Info + Logo Upload */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3><Building size={16} style={{ marginRight: '8px' }} />Company Information</h3>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Logo Upload */}
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Image size={14} /> Company Logo
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                            {settings.logoDataUrl ? (
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    border: '2px solid var(--border)', overflow: 'hidden',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: '#fff',
                                }}>
                                    <img src={settings.logoDataUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                            ) : (
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '12px',
                                    border: '2px dashed var(--border)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-secondary)', fontSize: '10px', textAlign: 'center',
                                }}>
                                    No logo
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                <button className="btn btn-secondary btn-sm" onClick={() => logoInputRef.current?.click()}>
                                    <Upload size={14} /> Upload Logo
                                </button>
                                {settings.logoDataUrl && (
                                    <button className="btn btn-ghost btn-sm" onClick={removeLogo} style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={14} /> Remove
                                    </button>
                                )}
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    PNG or SVG recommended. Appears in PDF header.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Company Name</label>
                            <input className="form-input" value={settings.company.name} onChange={(e) => updateSettings({ company: { ...settings.company, name: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input className="form-input" value={settings.company.address} onChange={(e) => updateSettings({ company: { ...settings.company, address: e.target.value } })} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">City</label>
                            <input className="form-input" value={settings.company.city} onChange={(e) => updateSettings({ company: { ...settings.company, city: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">State</label>
                            <input className="form-input" value={settings.company.state} onChange={(e) => updateSettings({ company: { ...settings.company, state: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ZIP</label>
                            <input className="form-input" value={settings.company.zip} onChange={(e) => updateSettings({ company: { ...settings.company, zip: e.target.value } })} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Client Info */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3><User size={16} style={{ marginRight: '8px' }} />Default Client</h3>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Client Name</label>
                            <input className="form-input" value={settings.defaultClient.name} onChange={(e) => updateSettings({ defaultClient: { ...settings.defaultClient, name: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input className="form-input" value={settings.defaultClient.address} onChange={(e) => updateSettings({ defaultClient: { ...settings.defaultClient, address: e.target.value } })} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">City</label>
                            <input className="form-input" value={settings.defaultClient.city} onChange={(e) => updateSettings({ defaultClient: { ...settings.defaultClient, city: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">State</label>
                            <input className="form-input" value={settings.defaultClient.state} onChange={(e) => updateSettings({ defaultClient: { ...settings.defaultClient, state: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ZIP</label>
                            <input className="form-input" value={settings.defaultClient.zip} onChange={(e) => updateSettings({ defaultClient: { ...settings.defaultClient, zip: e.target.value } })} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Info */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3><CreditCard size={16} style={{ marginRight: '8px' }} />Payment Details</h3>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Account Holder</label>
                            <input className="form-input" value={settings.payment.accountHolder} onChange={(e) => updateSettings({ payment: { ...settings.payment, accountHolder: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bank Name</label>
                            <input className="form-input" value={settings.payment.bankName || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, bankName: e.target.value } })} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Account Number</label>
                            <input className="form-input" type="password" value={settings.payment.accountNumber || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, accountNumber: e.target.value } })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Routing Number</label>
                            <input className="form-input" value={settings.payment.routingNumber || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, routingNumber: e.target.value } })} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Account Type</label>
                            <input className="form-input" value={settings.payment.accountType || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, accountType: e.target.value } })} placeholder="Deposit" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contact Email (invoice footer)</label>
                            <input className="form-input" value={settings.payment.contactEmail || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, contactEmail: e.target.value } })} placeholder="accounting@outthere.solutions" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Contact Phone (invoice footer)</label>
                            <input className="form-input" value={settings.payment.contactPhone || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, contactPhone: e.target.value } })} placeholder="647-873-4788" />
                        </div>
                        <div className="form-group" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Default Note (appears on invoice)</label>
                        <textarea className="form-textarea" value={settings.payment.notes || ''} onChange={(e) => updateSettings({ payment: { ...settings.payment, notes: e.target.value } })} style={{ minHeight: '60px' }} placeholder="Any default notes/disclaimers for invoices..." />
                    </div>
                </div>
            </div>

            {/* Role Rates */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-header">
                    <h3><DollarSign size={16} style={{ marginRight: '8px' }} />Default Role Rates</h3>
                    <button className="btn btn-ghost btn-sm" onClick={addRole}><Plus size={14} /> Add Role</button>
                </div>
                <div className="card-body">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Role Key</th>
                                <th>Display Label</th>
                                <th>Hourly Rate ($)</th>
                                <th>Count</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings.defaultRoles.map((role) => (
                                <tr key={role.id}>
                                    <td>
                                        <input className="form-input" value={role.role} onChange={(e) => updateRole(role.id, { role: e.target.value })} style={{ padding: '4px 8px' }} />
                                    </td>
                                    <td>
                                        <input className="form-input" value={role.label} onChange={(e) => updateRole(role.id, { label: e.target.value })} style={{ padding: '4px 8px' }} />
                                    </td>
                                    <td>
                                        <input className="form-input" type="number" value={role.rate} onChange={(e) => updateRole(role.id, { rate: parseInt(e.target.value) || 0 })} style={{ padding: '4px 8px', width: '100px' }} />
                                    </td>
                                    <td>
                                        <input className="form-input" type="number" value={role.count || ''} onChange={(e) => updateRole(role.id, { count: parseInt(e.target.value) || undefined })} style={{ padding: '4px 8px', width: '70px' }} placeholder="—" />
                                    </td>
                                    <td className="cell-actions">
                                        <button className="btn btn-icon btn-ghost" onClick={() => deleteRole(role.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resource-to-Role Mapping */}
            <div className="card">
                <div className="card-header">
                    <h3><Users size={16} style={{ marginRight: '8px' }} />Resource → Role Mapping</h3>
                    <button className="btn btn-ghost btn-sm" onClick={addMapping}><Plus size={14} /> Add Mapping</button>
                </div>
                <div className="card-body">
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        Map team members from Clockify/Tempo to invoice roles. When importing, each person&apos;s entries will automatically be assigned to the corresponding role.
                    </p>
                    {mappings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                            <Users size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p style={{ fontSize: '13px' }}>No mappings defined yet.</p>
                            <p style={{ fontSize: '11px' }}>Add mappings to auto-assign roles on import.</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Resource Name (from Clockify/Tempo)</th>
                                    <th>Assigned Role</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappings.map((mapping, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <input
                                                className="form-input"
                                                value={mapping.resourceName}
                                                onChange={(e) => updateMapping(idx, { resourceName: e.target.value })}
                                                style={{ padding: '4px 8px' }}
                                                placeholder="e.g. John Doe"
                                            />
                                        </td>
                                        <td>
                                            <select
                                                className="form-select"
                                                value={mapping.role}
                                                onChange={(e) => updateMapping(idx, { role: e.target.value })}
                                                style={{ padding: '4px 8px' }}
                                            >
                                                <option value="">— Select Role —</option>
                                                {settings.defaultRoles.map((r) => (
                                                    <option key={r.id} value={r.role}>{r.label || r.role}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="cell-actions">
                                            <button className="btn btn-icon btn-ghost" onClick={() => deleteMapping(idx)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div style={{ height: 'var(--space-8)' }} />
        </div>
    );
}
