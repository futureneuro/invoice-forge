'use client';

import React, { useState, useMemo } from 'react';
import {
    FolderKanban, Plus, ChevronRight, FileText, Download,
    Clock, DollarSign, MoreVertical, Archive, Trash2, Edit3, Eye
} from 'lucide-react';
import { useProjectStore, useInvoiceStore, useSettingsStore, useNavStore } from '@/lib/store';
import type { DraftInvoice } from '@/lib/store';
import { totalHours, formatCurrency } from '@/lib/utils';
import type { Project } from '@/types';

export function ProjectsView() {
    const { projects, createProject, updateProject, deleteProject, setActiveProject, activeProjectId } = useProjectStore();
    const { invoiceHistory, setCurrentInvoice, drafts, deleteDraft } = useInvoiceStore();
    const { settings } = useSettingsStore();
    const { setStep, enterInvoiceFlow, setInvoiceFlowStep } = useNavStore();

    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleCreate = () => {
        if (!newName.trim()) return;
        createProject(newName.trim(), settings.defaultClient, newDesc.trim() || undefined);
        setNewName('');
        setNewDesc('');
        setShowNewForm(false);
    };

    const handleSelect = (project: Project) => {
        setActiveProject(project.id);
    };

    const handleNewInvoice = (projectId: string) => {
        // Delete any existing draft so we start fresh
        deleteDraft(projectId);
        setActiveProject(projectId);
        enterInvoiceFlow();
    };

    const handleResumeDraft = (projectId: string) => {
        setActiveProject(projectId);
        enterInvoiceFlow();
    };

    const getProjectInvoices = (projectId: string) => {
        return invoiceHistory.filter((inv) => inv.projectId === projectId);
    };

    const getProjectTotal = (projectId: string) => {
        return getProjectInvoices(projectId).reduce((sum, inv) => {
            return sum + inv.roles.reduce((rSum, role) => {
                const hrs = totalHours(inv.entries.filter((e) => e.role === role.role));
                return rSum + hrs * role.rate;
            }, 0);
        }, 0);
    };

    const handleReExport = async (invoice: typeof invoiceHistory[0]) => {
        try {
            const { pdf } = await import('@react-pdf/renderer');
            const { InvoicePDF } = await import('@/lib/pdf/InvoicePDF');
            const blob = await pdf(<InvoicePDF invoice={invoice} logoDataUrl={settings.logoDataUrl} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice ${invoice.invoiceNumber}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF export failed:', err);
        }
    };

    const handleViewInvoice = (invoice: typeof invoiceHistory[0]) => {
        setCurrentInvoice(invoice);
        setInvoiceFlowStep('invoice');
        setStep('invoice-flow');
    };

    const startEdit = (project: Project) => {
        setEditingId(project.id);
        setEditName(project.name);
    };

    const saveEdit = (id: string) => {
        if (editName.trim()) {
            updateProject(id, { name: editName.trim() });
        }
        setEditingId(null);
    };

    const activeProject = projects.find((p) => p.id === activeProjectId);
    const activeInvoices = activeProjectId ? getProjectInvoices(activeProjectId) : [];
    const sprintInvoices = activeInvoices.filter((inv) => inv.type === 'sprint');
    const maintenanceInvoices = activeInvoices.filter((inv) => inv.type === 'maintenance');

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Projects</h1>
                    <p>Organize invoices by project phase, sprint, and maintenance period</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
                    <Plus size={16} /> New Project
                </button>
            </div>

            {/* New Project Form */}
            {showNewForm && (
                <div className="card" style={{ marginBottom: 'var(--space-6)', border: '2px solid var(--accent)' }}>
                    <div className="card-header">
                        <h3>Create New Project</h3>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label">Project Name</label>
                                <input
                                    className="form-input"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Phase 4 — NALC Portal"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description (optional)</label>
                            <textarea
                                className="form-textarea"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                placeholder="Brief project description..."
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                                Create Project
                            </button>
                            <button className="btn btn-ghost" onClick={() => setShowNewForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-6)' }}>
                {/* Left: Project List */}
                <div>
                    <div className="card">
                        <div className="card-header">
                            <h3 style={{ fontSize: '13px' }}>All Projects</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{projects.length}</span>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {projects.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                                    <FolderKanban size={28} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                    <p style={{ fontSize: '13px' }}>No projects yet</p>
                                    <p style={{ fontSize: '11px' }}>Create your first project to start organizing invoices.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {projects.map((project) => {
                                        const invCount = getProjectInvoices(project.id).length;
                                        const projTotal = getProjectTotal(project.id);
                                        const isActive = activeProjectId === project.id;
                                        const hasDraft = !!drafts[project.id];

                                        return (
                                            <div
                                                key={project.id}
                                                onClick={() => handleSelect(project)}
                                                style={{
                                                    padding: '14px 16px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                                                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    {editingId === project.id ? (
                                                        <input
                                                            className="form-input"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onBlur={() => saveEdit(project.id)}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(project.id)}
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{ padding: '2px 6px', fontSize: '13px' }}
                                                        />
                                                    ) : (
                                                        <span style={{ fontWeight: 700, fontSize: '13px', color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                                                            {project.name}
                                                        </span>
                                                    )}
                                                    <ChevronRight size={14} style={{ opacity: 0.4 }} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    <span>{invCount} invoice{invCount !== 1 ? 's' : ''}</span>
                                                    {projTotal > 0 && <span style={{ fontWeight: 600 }}>{formatCurrency(projTotal)}</span>}
                                                </div>
                                                {project.description && (
                                                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: 1.3 }}>
                                                        {project.description}
                                                    </p>
                                                )}
                                                <div style={{
                                                    display: 'inline-block', marginTop: '6px',
                                                    padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                                                    backgroundColor: project.status === 'active' ? 'var(--success-soft)' : project.status === 'completed' ? 'var(--info-soft)' : 'var(--surface-elevated)',
                                                    color: project.status === 'active' ? 'var(--success)' : project.status === 'completed' ? 'var(--info)' : 'var(--text-secondary)',
                                                }}>
                                                    {project.status}
                                                </div>
                                                {hasDraft && (
                                                    <div style={{
                                                        display: 'inline-block', marginTop: '6px', marginLeft: '6px',
                                                        padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                                                        backgroundColor: 'rgba(255, 165, 0, 0.15)',
                                                        color: '#f5a623',
                                                    }}>
                                                        ✏️ draft
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Project Detail */}
                <div>
                    {!activeProject ? (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                                <FolderKanban size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Select a Project</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                                    Choose a project from the left panel, or create a new one.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Project Header */}
                            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                                <div className="card-header">
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '20px' }}>{activeProject.name}</h2>
                                        {activeProject.description && (
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {activeProject.description}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(activeProject)}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => updateProject(activeProject.id, { status: activeProject.status === 'active' ? 'completed' : 'active' })}>
                                            <Archive size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { deleteProject(activeProject.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileText size={16} style={{ color: 'var(--accent)' }} />
                                            <span style={{ fontWeight: 700, fontSize: '18px' }}>{activeInvoices.length}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>invoices</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <DollarSign size={16} style={{ color: 'var(--success)' }} />
                                            <span style={{ fontWeight: 700, fontSize: '18px' }}>{formatCurrency(getProjectTotal(activeProject.id))}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>total billed</span>
                                        </div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={() => handleNewInvoice(activeProject.id)}>
                                        <Plus size={14} /> New Invoice for this Project
                                    </button>
                                </div>
                            </div>

                            {/* Draft In Progress */}
                            {drafts[activeProject.id] && (
                                <div className="card" style={{ marginBottom: 'var(--space-6)', border: '2px solid #f5a623' }}>
                                    <div className="card-header" style={{ backgroundColor: 'rgba(255, 165, 0, 0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>✏️</span>
                                            <div>
                                                <h3 style={{ fontSize: '14px', color: '#f5a623', margin: 0 }}>Draft In Progress</h3>
                                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                                                    {drafts[activeProject.id].entries.length} entries · Step: {drafts[activeProject.id].flowStep} · Last saved {new Date(drafts[activeProject.id].updatedAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-body" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleResumeDraft(activeProject.id)}>
                                            ▶ Resume Draft
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ color: 'var(--danger)' }}
                                            onClick={() => deleteDraft(activeProject.id)}
                                        >
                                            Discard
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Client Details (per-project) */}
                            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                                <div className="card-header">
                                    <h3 style={{ fontSize: '14px' }}>🏢 Client Details</h3>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Bill To — saved per project</span>
                                </div>
                                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Client Name</label>
                                        <input
                                            className="form-input"
                                            value={activeProject.client.name}
                                            onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, name: e.target.value } })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Address</label>
                                        <input
                                            className="form-input"
                                            value={activeProject.client.address}
                                            onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, address: e.target.value } })}
                                            placeholder="123 Main St"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">City</label>
                                            <input
                                                className="form-input"
                                                value={activeProject.client.city}
                                                onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, city: e.target.value } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">State</label>
                                            <input
                                                className="form-input"
                                                value={activeProject.client.state}
                                                onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, state: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">ZIP Code</label>
                                            <input
                                                className="form-input"
                                                value={activeProject.client.zip}
                                                onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, zip: e.target.value } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Country</label>
                                            <input
                                                className="form-input"
                                                value={activeProject.client.country}
                                                onChange={(e) => updateProject(activeProject.id, { client: { ...activeProject.client, country: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                                <div className="card-header">
                                    <h3 style={{ fontSize: '14px' }}>🚀 Sprint Invoices</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sprintInvoices.length}</span>
                                </div>
                                <div className="card-body">
                                    {sprintInvoices.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: 'var(--space-6)' }}>
                                            No sprint invoices yet for this project.
                                        </p>
                                    ) : (
                                        <InvoiceTable invoices={sprintInvoices} onReExport={handleReExport} onView={handleViewInvoice} />
                                    )}
                                </div>
                            </div>

                            {/* Maintenance Invoices */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 style={{ fontSize: '14px' }}>🔧 Maintenance Invoices</h3>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{maintenanceInvoices.length}</span>
                                </div>
                                <div className="card-body">
                                    {maintenanceInvoices.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: 'var(--space-6)' }}>
                                            No maintenance invoices yet for this project.
                                        </p>
                                    ) : (
                                        <InvoiceTable invoices={maintenanceInvoices} onReExport={handleReExport} onView={handleViewInvoice} />
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Shared Invoice Table ---
function InvoiceTable({
    invoices,
    onReExport,
    onView,
}: {
    invoices: any[];
    onReExport: (inv: any) => void;
    onView: (inv: any) => void;
}) {
    return (
        <table className="data-table">
            <thead>
                <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Sprint / Period</th>
                    <th className="cell-number">Entries</th>
                    <th className="cell-number">Total</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {invoices.map((inv) => {
                    const invTotal = inv.roles.reduce((sum: number, role: any) => {
                        const hrs = totalHours(inv.entries.filter((e: any) => e.role === role.role));
                        return sum + hrs * role.rate;
                    }, 0);
                    return (
                        <tr key={inv.id}>
                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{inv.invoiceNumber}</td>
                            <td>{inv.date}</td>
                            <td style={{ fontSize: '12px' }}>{inv.sprintName || '—'}</td>
                            <td className="cell-number">{inv.entries.length}</td>
                            <td className="cell-number" style={{ fontWeight: 700 }}>{formatCurrency(invTotal)}</td>
                            <td>
                                <span style={{
                                    display: 'inline-block', padding: '2px 8px', borderRadius: '12px',
                                    fontSize: '11px', fontWeight: 600,
                                    backgroundColor: inv.status === 'finalized' ? 'var(--success-soft)' : 'var(--warning-soft)',
                                    color: inv.status === 'finalized' ? 'var(--success)' : 'var(--warning)',
                                }}>
                                    {inv.status}
                                </span>
                            </td>
                            <td className="cell-actions" style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-icon btn-ghost" title="Re-export PDF" onClick={() => onReExport(inv)}>
                                    <Download size={14} />
                                </button>
                                <button className="btn btn-icon btn-ghost" title="View / Edit" onClick={() => onView(inv)}>
                                    <Eye size={14} />
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
