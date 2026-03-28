'use client';

import React from 'react';
import {
    LayoutDashboard,
    FolderKanban,
    Settings,
    ArrowLeft,
} from 'lucide-react';
import { useNavStore, useProjectStore, type AppStep } from '@/lib/store';

const navItems: { step: AppStep; label: string; icon: React.ReactNode }[] = [
    { step: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { step: 'projects', label: 'Projects', icon: <FolderKanban size={20} /> },
    { step: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

export function Sidebar() {
    const { currentStep, setStep, exitInvoiceFlow } = useNavStore();
    const { activeProjectId, projects } = useProjectStore();
    const activeProject = projects.find((p) => p.id === activeProjectId);

    const isInFlow = currentStep === 'invoice-flow';

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">IF</div>
                <span className="sidebar-title">InvoiceForge</span>
            </div>

            {/* Active Project Indicator */}
            {activeProject && (
                <div
                    style={{
                        margin: '0 12px 8px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--accent-soft)',
                        cursor: 'pointer',
                        fontSize: '11px',
                    }}
                    onClick={() => setStep('projects')}
                >
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)', marginBottom: '2px', letterSpacing: '0.5px' }}>
                        Active Project
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                        {activeProject.name}
                    </div>
                </div>
            )}

            {/* Back to Projects when in flow */}
            {isInFlow && (
                <button
                    className="btn btn-ghost btn-sm"
                    style={{
                        margin: '0 12px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        width: 'calc(100% - 24px)',
                        justifyContent: 'flex-start',
                        padding: '8px 12px',
                        color: 'var(--accent)',
                    }}
                    onClick={exitInvoiceFlow}
                >
                    <ArrowLeft size={14} /> Back to Projects
                </button>
            )}

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <button
                        key={item.step}
                        className={`sidebar-nav-item ${currentStep === item.step ? 'active' : ''}`}
                        onClick={() => setStep(item.step)}
                        style={isInFlow ? { opacity: 0.5 } : undefined}
                    >
                        {item.icon}
                        <span style={{ marginLeft: '8px' }}>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                InvoiceForge v1.0 — Ou2There
            </div>
        </aside>
    );
}
