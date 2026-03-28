'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Upload, FileEdit, FileText, Check } from 'lucide-react';
import { useNavStore, useProjectStore, useTimeEntriesStore } from '@/lib/store';
import type { InvoiceFlowStep } from '@/lib/store';
import { ImportView } from './ImportView';
import { EditorView } from './EditorView';
import { InvoiceView } from './InvoiceView';

const flowSteps: { key: InvoiceFlowStep; label: string; icon: React.ReactNode }[] = [
    { key: 'import', label: 'Import Hours', icon: <Upload size={16} /> },
    { key: 'editor', label: 'Edit Time Log', icon: <FileEdit size={16} /> },
    { key: 'invoice', label: 'Generate Invoice', icon: <FileText size={16} /> },
];

export function InvoiceFlowView() {
    const { invoiceFlowStep, setInvoiceFlowStep, exitInvoiceFlow } = useNavStore();
    const { activeProjectId, projects } = useProjectStore();
    const { entries } = useTimeEntriesStore();
    const activeProject = projects.find((p) => p.id === activeProjectId);

    const currentIndex = flowSteps.findIndex((s) => s.key === invoiceFlowStep);

    const canGoNext = () => {
        if (invoiceFlowStep === 'import') return entries.length > 0;
        if (invoiceFlowStep === 'editor') return entries.length > 0;
        return false;
    };

    const goNext = () => {
        if (currentIndex < flowSteps.length - 1) {
            setInvoiceFlowStep(flowSteps[currentIndex + 1].key);
        }
    };

    const goBack = () => {
        if (currentIndex > 0) {
            setInvoiceFlowStep(flowSteps[currentIndex - 1].key);
        } else {
            exitInvoiceFlow();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Flow Header */}
            <div style={{
                padding: '16px 32px',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                flexShrink: 0,
            }}>
                {/* Project Context */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={exitInvoiceFlow}
                            style={{ padding: '4px 8px' }}
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
                                Creating Invoice
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                                {activeProject?.name || 'Untitled Project'}
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Step {currentIndex + 1} of {flowSteps.length}
                    </div>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {flowSteps.map((step, idx) => {
                        const isActive = idx === currentIndex;
                        const isCompleted = idx < currentIndex;
                        const isClickable = idx <= currentIndex || (idx === currentIndex + 1 && canGoNext());

                        return (
                            <React.Fragment key={step.key}>
                                {idx > 0 && (
                                    <div style={{
                                        flex: 1,
                                        height: '2px',
                                        backgroundColor: isCompleted ? 'var(--accent)' : 'var(--border)',
                                        transition: 'background-color 0.3s ease',
                                    }} />
                                )}
                                <button
                                    onClick={() => isClickable && setInvoiceFlowStep(step.key)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                                        backgroundColor: isActive
                                            ? 'var(--accent-soft)'
                                            : isCompleted
                                                ? 'rgba(232, 93, 74, 0.15)'
                                                : 'var(--surface-elevated)',
                                        color: isActive
                                            ? 'var(--accent)'
                                            : isCompleted
                                                ? 'var(--accent)'
                                                : 'var(--text-secondary)',
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '13px',
                                        cursor: isClickable ? 'pointer' : 'default',
                                        opacity: isClickable ? 1 : 0.5,
                                        transition: 'all 0.2s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {isCompleted ? <Check size={14} /> : step.icon}
                                    {step.label}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Flow Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {invoiceFlowStep === 'import' && <ImportView />}
                {invoiceFlowStep === 'editor' && <EditorView />}
                {invoiceFlowStep === 'invoice' && <InvoiceView />}
            </div>

            {/* Flow Navigation Footer */}
            <div style={{
                padding: '12px 32px',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
            }}>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={goBack}
                >
                    <ArrowLeft size={14} />
                    {currentIndex === 0 ? 'Back to Project' : `Back: ${flowSteps[currentIndex - 1].label}`}
                </button>

                {currentIndex < flowSteps.length - 1 && (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={goNext}
                        disabled={!canGoNext()}
                        style={{ opacity: canGoNext() ? 1 : 0.5 }}
                    >
                        Next: {flowSteps[currentIndex + 1].label}
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
