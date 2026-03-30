'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    Sparkles, Plus, Trash2, ChevronDown, ChevronRight,
    ArrowRight, GripVertical, Save, BarChart3
} from 'lucide-react';
import { useTimeEntriesStore, useNavStore } from '@/lib/store';
import { groupBy, totalHours, formatDate, uid } from '@/lib/utils';
import { AIPanel } from '@/components/editor/AIPanel';
import type { TimeEntry } from '@/types';

export function EditorView() {
    const { entries, updateEntry, addEntry, deleteEntry, setEntries, versions } = useTimeEntriesStore();
    const { setInvoiceFlowStep } = useNavStore();
    const [aiOpen, setAiOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [showPlan, setShowPlan] = useState(false);

    // Auto-restore: on mount, check if entries are stale vs the latest version
    useEffect(() => {
        if (versions.length === 0) return;
        const latest = versions[versions.length - 1];
        if (!latest.entries || latest.entries.length === 0) return;

        const currentCount = entries.length;
        const versionCount = latest.entries.length;

        if (currentCount !== versionCount) {
            console.log(`[EditorView] Auto-restoring "${latest.label}" (${versionCount} vs ${currentCount} current)`);
            setEntries(JSON.parse(JSON.stringify(latest.entries)));
        }
    }, []); // Only on mount

    // Group by role
    const grouped = groupBy(entries, 'role');
    const roleLabels: Record<string, string> = {
        developer: 'Developers',
        qa: 'QA',
        uxui: 'UX/UI Design',
        content: 'Content Design',
        pm: 'Project Management',
        advisor: 'Technical Advisor',
    };

    const toggleCollapse = (role: string) => {
        setCollapsed((p) => ({ ...p, [role]: !p[role] }));
    };

    const handleCellChange = useCallback(
        (id: string, field: keyof TimeEntry, value: string) => {
            if (field === 'timeSpent') {
                updateEntry(id, { [field]: parseFloat(value) || 0 });
            } else {
                updateEntry(id, { [field]: value });
            }
            setEditingCell(null);
        },
        [updateEntry]
    );

    const handleAddRow = (role: string) => {
        addEntry({
            date: new Date().toISOString().split('T')[0],
            category: 'Development',
            taskName: '',
            timeSpent: 0,
            description: '',
            resource: roleLabels[role] || role,
            role,
            source: 'manual',
            isRefined: false,
        });
    };

    if (entries.length === 0) {
        return (
            <div className="page-container">
                <div className="page-header">
                    <h1>Time Log Editor</h1>
                    <p>Refine and edit your time entries before generating the invoice</p>
                </div>
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Sparkles size={28} />
                    </div>
                    <h3>No Time Entries</h3>
                    <p>Import hours from Tempo, Clockify, or add them manually to get started.</p>
                    <button className="btn btn-primary" onClick={() => setInvoiceFlowStep('import')}>
                        <Plus size={16} /> Import Hours
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="page-container" style={{ marginRight: aiOpen ? '400px' : 0, transition: 'margin var(--transition-normal)' }}>
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1>Time Log Editor</h1>
                        <p>Refine and edit your time entries — {entries.length} entries, {totalHours(entries).toFixed(1)} total hours</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button className="btn btn-secondary" onClick={() => setInvoiceFlowStep('import')}>
                            <Plus size={16} />
                            Import More Hours
                        </button>
                        <button className="btn btn-secondary" onClick={() => setShowPlan(!showPlan)}>
                            <BarChart3 size={16} />
                            Plan Comparison
                        </button>
                        <button className="btn btn-secondary" onClick={() => setAiOpen(!aiOpen)}>
                            <Sparkles size={16} />
                            AI Refine
                        </button>
                        <button className="btn btn-primary" onClick={() => setInvoiceFlowStep('invoice')}>
                            Generate Invoice <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Plan Comparison Panel */}
                {showPlan && (
                    <div className="card animate-in" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header">
                            <h3><BarChart3 size={16} style={{ marginRight: '8px' }} />Phase Plan Comparison</h3>
                        </div>
                        <div className="card-body">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Role</th>
                                        <th className="cell-number">Actual Hours</th>
                                        <th className="cell-number">Planned Hours</th>
                                        <th className="cell-number">Variance</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(grouped).map(([role, roleEntries]) => {
                                        const actual = totalHours(roleEntries);
                                        const planned = 0; // Will be configurable
                                        const variance = planned ? actual - planned : 0;
                                        return (
                                            <tr key={role}>
                                                <td style={{ fontWeight: 600 }}>{roleLabels[role] || role}</td>
                                                <td className="cell-number">{actual.toFixed(1)}</td>
                                                <td className="cell-number">
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        defaultValue={planned || ''}
                                                        placeholder="—"
                                                        style={{ width: '80px', textAlign: 'right', padding: '4px 8px' }}
                                                    />
                                                </td>
                                                <td className="cell-number">
                                                    {planned ? (
                                                        <span className={variance > 0 ? 'variance-negative' : 'variance-positive'}>
                                                            {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {planned ? (
                                                        <span className={`badge ${variance > 0 ? 'badge-danger' : 'badge-success'}`}>
                                                            {variance > 0 ? 'Over' : 'Under'}
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-info">No plan</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Role Sections */}
                {Object.entries(grouped).map(([role, roleEntries]) => (
                    <div key={role} className="role-section">
                        <div className="role-section-header" onClick={() => toggleCollapse(role)}>
                            <div className="role-section-title">
                                {collapsed[role] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                <span>{roleLabels[role] || role}</span>
                                <span className="badge badge-info">{roleEntries.length} entries</span>
                            </div>
                            <span className="role-section-hours">{totalHours(roleEntries).toFixed(1)} hrs</span>
                        </div>

                        {!collapsed[role] && (
                            <div className="card" style={{ marginBottom: 0 }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '110px' }}>Date</th>
                                                <th style={{ width: '130px' }}>Category</th>
                                                <th style={{ width: '180px' }}>Task Name</th>
                                                <th style={{ width: '70px' }}>Hours</th>
                                                <th>Description</th>
                                                <th style={{ width: '120px' }}>Resource</th>
                                                <th style={{ width: '60px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {roleEntries.map((entry) => (
                                                <tr key={entry.id}>
                                                    <td>
                                                        <EditableCell
                                                            value={entry.date}
                                                            type="date"
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'date'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'date' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'date', v)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <EditableCell
                                                            value={entry.category}
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'category'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'category' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'category', v)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <EditableCell
                                                            value={entry.taskName}
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'taskName'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'taskName' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'taskName', v)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <EditableCell
                                                            value={String(entry.timeSpent)}
                                                            type="number"
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'timeSpent'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'timeSpent' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'timeSpent', v)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <EditableCell
                                                            value={entry.description}
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'description'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'description' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'description', v)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <EditableCell
                                                            value={entry.resource}
                                                            isEditing={editingCell?.id === entry.id && editingCell?.field === 'resource'}
                                                            onEdit={() => setEditingCell({ id: entry.id, field: 'resource' })}
                                                            onChange={(v) => handleCellChange(entry.id, 'resource', v)}
                                                        />
                                                    </td>
                                                    <td className="cell-actions">
                                                        <button
                                                            className="btn btn-icon btn-ghost"
                                                            onClick={() => deleteEntry(entry.id)}
                                                            title="Delete entry"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border)' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleAddRow(role)}>
                                        <Plus size={14} /> Add Entry
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Summary */}
                <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Grand Total: </span>
                            <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--accent)' }}>
                                {totalHours(entries).toFixed(1)} hours
                            </span>
                        </div>
                        <button className="btn btn-primary btn-lg" onClick={() => setInvoiceFlowStep('invoice')}>
                            Generate Invoice <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <AIPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
        </>
    );
}

// --- Editable Cell Component ---
function EditableCell({
    value,
    type = 'text',
    isEditing,
    onEdit,
    onChange,
}: {
    value: string;
    type?: string;
    isEditing: boolean;
    onEdit: () => void;
    onChange: (value: string) => void;
}) {
    const [localValue, setLocalValue] = useState(value);

    const handleBlur = () => onChange(localValue);
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onChange(localValue);
        } else if (e.key === 'Escape') {
            setLocalValue(value);
            onChange(value);
        }
    };

    if (isEditing) {
        return (
            <input
                className="form-input"
                type={type}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{ padding: '4px 8px', fontSize: 'var(--text-sm)', width: '100%' }}
                step={type === 'number' ? '0.5' : undefined}
            />
        );
    }

    return (
        <div className="editable-cell" onClick={onEdit}>
            {value || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
        </div>
    );
}
