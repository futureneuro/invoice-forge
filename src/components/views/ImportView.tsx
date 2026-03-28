'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Clock, Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, RefreshCw, Users } from 'lucide-react';
import { useTimeEntriesStore, useSettingsStore, useNavStore, useProjectStore } from '@/lib/store';
import { uid } from '@/lib/utils';
import type { TimeEntry, ResourceRoleMapping } from '@/types';

type Source = 'tempo' | 'clockify' | 'csv' | null;
type ImportStep = 'source' | 'mapping' | 'result';

interface ClockifyProject {
    id: string;
    name: string;
    clientName: string;
    color: string;
    archived: boolean;
}

interface TempoProject {
    id: string;
    key: string;
    name: string;
}

export function ImportView() {
    const { entries, setEntries, addEntry } = useTimeEntriesStore();
    const { settings } = useSettingsStore();
    const { setInvoiceFlowStep } = useNavStore();
    const { activeProjectId, projects, updateProject } = useProjectStore();

    const activeProject = projects.find(p => p.id === activeProjectId);

    const [source, setSource] = useState<Source>(null);
    const [importStep, setImportStep] = useState<ImportStep>('source');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ count: number; totalHours: number; entries: TimeEntry[] } | null>(null);
    const [error, setError] = useState('');
    const [csvText, setCsvText] = useState('');

    // Clockify-specific state
    const [clockifyProjects, setClockifyProjects] = useState<ClockifyProject[]>([]);
    const [selectedClockifyProject, setSelectedClockifyProject] = useState<string>('');
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [discoveredResources, setDiscoveredResources] = useState<string[]>([]);
    const [roleMappings, setRoleMappings] = useState<ResourceRoleMapping[]>([]);
    const [rawEntries, setRawEntries] = useState<TimeEntry[]>([]);

    // Tempo-specific state
    const [tempoProjects, setTempoProjects] = useState<TempoProject[]>([]);
    const [selectedTempoProject, setSelectedTempoProject] = useState<string>('');
    const [loadingTempoProjects, setLoadingTempoProjects] = useState(false);

    // Available roles from settings
    const availableRoles = settings.defaultRoles;

    // Pre-select saved project configs
    useEffect(() => {
        if (activeProject?.importSource) {
            setSource(activeProject.importSource);
        }
        if (activeProject?.clockifyProjectId) {
            setSelectedClockifyProject(activeProject.clockifyProjectId);
        }
        if (activeProject?.tempoProjectKey) {
            setSelectedTempoProject(activeProject.tempoProjectKey);
        }
        // Load per-source mappings
        const sourceMappings = activeProject?.importSource === 'tempo'
            ? activeProject?.tempoResourceMappings
            : activeProject?.importSource === 'clockify'
                ? activeProject?.clockifyResourceMappings
                : activeProject?.resourceRoleMappings;
        if (sourceMappings?.length) {
            setRoleMappings(sourceMappings);
        }
    }, [activeProject]);

    // Reload mappings when source changes
    useEffect(() => {
        if (!activeProject || !source) return;
        const mappings = source === 'tempo'
            ? activeProject.tempoResourceMappings
            : source === 'clockify'
                ? activeProject.clockifyResourceMappings
                : activeProject.resourceRoleMappings;
        if (mappings?.length) {
            setRoleMappings(mappings);
        } else {
            setRoleMappings([]);
        }
    }, [source, activeProject]);

    // Auto-fetch Clockify projects when source is selected
    const fetchClockifyProjects = useCallback(async () => {
        if (!settings.clockify.apiKey || !settings.clockify.workspaceId) return;
        setLoadingProjects(true);
        try {
            const res = await fetch('/api/clockify/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: settings.clockify.apiKey,
                    workspaceId: settings.clockify.workspaceId,
                }),
            });
            const data = await res.json();
            if (data.error) { setError(data.error); return; }
            setClockifyProjects(data.projects.filter((p: ClockifyProject) => !p.archived));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch Clockify projects');
        } finally {
            setLoadingProjects(false);
        }
    }, [settings.clockify.apiKey, settings.clockify.workspaceId]);

    useEffect(() => {
        if (source === 'clockify' && settings.clockify.apiKey && settings.clockify.workspaceId) {
            fetchClockifyProjects();
        }
    }, [source, fetchClockifyProjects]);

    // Auto-fetch Tempo/Jira projects when source is selected
    const fetchTempoProjects = useCallback(async () => {
        if (!settings.tempo.apiToken) return;
        setLoadingTempoProjects(true);
        try {
            const res = await fetch('/api/tempo/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiToken: settings.tempo.apiToken,
                    jiraBaseUrl: settings.tempo.jiraBaseUrl,
                    jiraEmail: settings.tempo.jiraEmail,
                    jiraApiToken: settings.tempo.jiraApiToken,
                }),
            });
            const data = await res.json();
            if (data.error) { /* silently fail — projects are optional */ }
            else { setTempoProjects(data.projects || []); }
        } catch { /* silently fail */ }
        finally { setLoadingTempoProjects(false); }
    }, [settings.tempo.apiToken, settings.tempo.jiraBaseUrl]);

    useEffect(() => {
        if (source === 'tempo' && settings.tempo.apiToken) {
            fetchTempoProjects();
        }
    }, [source, fetchTempoProjects]);

    const handleImport = async () => {
        setLoading(true);
        setError('');
        setResult(null);

        try {
            if (source === 'tempo') {
                const res = await fetch('/api/tempo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiToken: settings.tempo.apiToken,
                        jiraBaseUrl: settings.tempo.jiraBaseUrl,
                        jiraEmail: settings.tempo.jiraEmail,
                        jiraApiToken: settings.tempo.jiraApiToken,
                        startDate,
                        endDate,
                        projectId: selectedTempoProject || undefined,
                        resourceRoleMappings: roleMappings.length > 0 ? roleMappings : undefined,
                    }),
                });
                const data = await res.json();
                if (data.error) { setError(data.error); return; }

                // Same mapping flow as Clockify
                const resources: string[] = data.uniqueResources || [];

                // Always show mapping step so user can review
                setRawEntries(data.entries);
                setDiscoveredResources(resources);
                const existingMappings = [...roleMappings];
                resources.forEach(r => {
                    if (!existingMappings.some(m => m.resourceName.toLowerCase() === r.toLowerCase())) {
                        existingMappings.push({ resourceName: r, role: 'developer' });
                    }
                });
                setRoleMappings(existingMappings);
                setImportStep('mapping');
            } else if (source === 'clockify') {
                // First fetch without role mappings to discover resources
                const res = await fetch('/api/clockify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey: settings.clockify.apiKey,
                        workspaceId: settings.clockify.workspaceId,
                        startDate,
                        endDate,
                        projectId: selectedClockifyProject || undefined,
                        resourceRoleMappings: roleMappings.length > 0 ? roleMappings : undefined,
                    }),
                });
                const data = await res.json();
                if (data.error) { setError(data.error); return; }

                // Always show mapping step so user can review
                const resources: string[] = data.uniqueResources || [];

                setRawEntries(data.entries);
                setDiscoveredResources(resources);
                // Pre-fill unmapped resources with 'developer'
                const existingMappings = [...roleMappings];
                resources.forEach(r => {
                    if (!existingMappings.some(m => m.resourceName.toLowerCase() === r.toLowerCase())) {
                        existingMappings.push({ resourceName: r, role: 'developer' });
                    }
                });
                setRoleMappings(existingMappings);
                setImportStep('mapping');
            } else if (source === 'csv') {
                const parsed = parseCSV(csvText);
                setResult({ count: parsed.length, totalHours: parsed.reduce((s, e) => s + e.timeSpent, 0), entries: parsed });
                setImportStep('result');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyMappings = () => {
        // Re-apply mappings to raw entries with roleLabel
        const roleMap = new Map<string, { role: string; roleLabel?: string }>();
        roleMappings.forEach(m => {
            roleMap.set(m.resourceName.toLowerCase(), { role: m.role, roleLabel: m.roleLabel });
        });

        const mappedEntries = rawEntries.map(e => {
            const mapping = roleMap.get(e.resource.toLowerCase());
            return {
                ...e,
                role: mapping?.role || 'developer',
            };
        });

        // Save mappings to per-source field AND general field
        if (activeProjectId) {
            if (source === 'clockify') {
                const selectedProjObj = clockifyProjects.find(p => p.id === selectedClockifyProject);
                updateProject(activeProjectId, {
                    importSource: 'clockify',
                    clockifyProjectId: selectedClockifyProject,
                    clockifyProjectName: selectedProjObj?.name || '',
                    clockifyResourceMappings: roleMappings,
                    resourceRoleMappings: roleMappings, // legacy compat
                });
            } else if (source === 'tempo') {
                const selectedProjObj = tempoProjects.find(p => p.id === selectedTempoProject || p.key === selectedTempoProject);
                updateProject(activeProjectId, {
                    importSource: 'tempo',
                    tempoProjectKey: selectedTempoProject,
                    tempoProjectName: selectedProjObj?.name || '',
                    tempoResourceMappings: roleMappings,
                    resourceRoleMappings: roleMappings, // legacy compat
                });
            }
        }

        setResult({
            count: mappedEntries.length,
            totalHours: mappedEntries.reduce((s, e) => s + e.timeSpent, 0),
            entries: mappedEntries,
        });
        setImportStep('result');
    };

    const parseCSV = (text: string): TimeEntry[] => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        return lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = values[i] || ''; });
            return {
                id: uid(),
                date: row['date'] || '',
                category: row['category'] || 'Development',
                taskName: row['task'] || row['taskname'] || row['task name'] || '',
                taskId: row['taskid'] || row['task id'] || undefined,
                timeSpent: parseFloat(row['hours'] || row['time'] || row['timespent'] || '0'),
                description: row['description'] || row['desc'] || '',
                resource: row['resource'] || row['person'] || row['user'] || '',
                role: row['role'] || 'developer',
                source: 'manual' as const,
                isRefined: false,
            };
        });
    };

    const handleConfirm = () => {
        if (result?.entries) {
            const newEntries = [...entries, ...result.entries];
            setEntries(newEntries);
            setInvoiceFlowStep('editor');
        }
    };

    const handleAddSample = () => {
        const sampleEntries: Omit<TimeEntry, 'id'>[] = [
            { date: '2025-09-04', category: 'Development', taskName: 'Bug Fixes & Refinements', timeSpent: 3.0, description: 'Fixed bugs and refined codebase elements, including code cleanup and component stability', resource: 'Developer 1', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-04', category: 'Development', taskName: 'Page-level Integration', timeSpent: 2.5, description: 'Integrated and tested components within specific pages, transitioning to page-level build', resource: 'Developer 1', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-04', category: 'Development', taskName: 'Peer-to-Peer Sync', timeSpent: 1.0, description: 'Coordinated with team members on shared tasks and provided technical support', resource: 'Developer 1', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-05', category: 'Development', taskName: 'Component Enhancement & Refinement', timeSpent: 3.0, description: 'Enhanced existing components and built new features for various widgets', resource: 'Developer 1', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-05', category: 'Review', taskName: 'Cross-Browser Testing', timeSpent: 1.5, description: 'Performed cross-browser compatibility testing and resolved rendering issues', resource: 'Developer 1', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-04', category: 'QA', taskName: 'Content Review & Validation', timeSpent: 4.0, description: 'Conducted meticulous content and visual reviews across multiple pages', resource: 'QA Lead', role: 'qa', source: 'manual', isRefined: false },
            { date: '2025-09-05', category: 'QA', taskName: 'Accessibility Audit', timeSpent: 3.5, description: 'Performed accessibility audit using WAVE and axe tools', resource: 'QA Lead', role: 'qa', source: 'manual', isRefined: false },
            { date: '2025-09-04', category: 'Design', taskName: 'UI Component Refinement', timeSpent: 5.0, description: 'Refined UI components for visual consistency and accessibility compliance', resource: 'UX Designer', role: 'uxui', source: 'manual', isRefined: false },
            { date: '2025-09-04', category: 'Meeting', taskName: 'Sprint Planning', timeSpent: 2.0, description: 'Led sprint planning session, defined priorities and allocated resources', resource: 'Project Manager', role: 'pm', source: 'manual', isRefined: false },
            { date: '2025-09-05', category: 'Meeting', taskName: 'Client Sync', timeSpent: 1.5, description: 'Conducted client synchronization call to review progress and gather feedback', resource: 'Project Manager', role: 'pm', source: 'manual', isRefined: false },
            { date: '2025-09-05', category: 'Development', taskName: 'Architecture Review', timeSpent: 3.0, description: 'Reviewed system architecture and provided guidance on optimization strategies', resource: 'Tech Advisor', role: 'advisor', source: 'manual', isRefined: false },
            { date: '2025-09-06', category: 'Development', taskName: 'API Integration', timeSpent: 4.0, description: 'Developed and tested REST API integrations for third-party services', resource: 'Developer 2', role: 'developer', source: 'manual', isRefined: false },
            { date: '2025-09-06', category: 'Content', taskName: 'Content Writing', timeSpent: 3.5, description: 'Created and edited content for the knowledge center and help articles', resource: 'Content Designer', role: 'content', source: 'manual', isRefined: false },
        ];
        sampleEntries.forEach((e) => addEntry(e));
        setInvoiceFlowStep('editor');
    };

    const updateRoleMapping = (resourceName: string, newRole: string) => {
        const roleObj = availableRoles.find(r => r.role === newRole);
        setRoleMappings(prev =>
            prev.map(m =>
                m.resourceName === resourceName
                    ? { ...m, role: newRole, roleLabel: m.roleLabel || roleObj?.label || newRole }
                    : m
            )
        );
    };

    const updateRoleLabel = (resourceName: string, newLabel: string) => {
        setRoleMappings(prev =>
            prev.map(m =>
                m.resourceName === resourceName ? { ...m, roleLabel: newLabel } : m
            )
        );
    };

    const handleImportAnother = () => {
        // Commit current result entries to the store before resetting
        if (result?.entries) {
            const newEntries = [...entries, ...result.entries];
            setEntries(newEntries);
        }
        setSource(null);
        setImportStep('source');
        setResult(null);
        setDiscoveredResources([]);
        setRawEntries([]);
        setError('');
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>Import Hours</h1>
                <p>Pull time tracking data from your preferred source</p>
            </div>

            {/* === STEP 1: Source Selection & Config === */}
            {importStep === 'source' && (
                <>
                    <div className="source-grid" style={{ marginBottom: 'var(--space-6)' }}>
                        <div
                            className={`source-card ${source === 'tempo' ? 'selected' : ''}`}
                            onClick={() => setSource('tempo')}
                        >
                            <div className="source-card-icon" style={{ background: '#4C9AFF22', color: '#4C9AFF' }}>⏱</div>
                            <h3>Tempo (Jira)</h3>
                            <p>Import worklogs from Tempo time tracking in Jira</p>
                            {activeProject?.tempoProjectKey && (
                                <span style={{ fontSize: '10px', marginTop: '6px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-soft)', color: 'var(--success)' }}>
                                    Linked: Project #{activeProject.tempoProjectKey}
                                </span>
                            )}
                        </div>
                        <div
                            className={`source-card ${source === 'clockify' ? 'selected' : ''}`}
                            onClick={() => setSource('clockify')}
                        >
                            <div className="source-card-icon" style={{ background: '#03A9F422', color: '#03A9F4' }}>🕐</div>
                            <h3>Clockify</h3>
                            <p>Import time entries from Clockify workspace</p>
                            {activeProject?.clockifyProjectName && (
                                <span style={{ fontSize: '10px', marginTop: '6px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-soft)', color: 'var(--success)' }}>
                                    Linked: {activeProject.clockifyProjectName}
                                </span>
                            )}
                        </div>
                        <div
                            className={`source-card ${source === 'csv' ? 'selected' : ''}`}
                            onClick={() => setSource('csv')}
                        >
                            <div className="source-card-icon" style={{ background: '#4CAF5022', color: '#4CAF50' }}>
                                <FileSpreadsheet size={24} />
                            </div>
                            <h3>CSV Upload</h3>
                            <p>Import from CSV: date, category, task, hours, description, resource, role</p>
                        </div>
                    </div>

                    {/* Import Configuration */}
                    {source && (
                        <div className="card animate-in" style={{ marginBottom: 'var(--space-6)' }}>
                            <div className="card-header">
                                <h3>Configure Import</h3>
                            </div>
                            <div className="card-body">
                                {source === 'tempo' && !settings.tempo.apiToken && (
                                    <div style={{ padding: 'var(--space-4)', background: 'var(--warning-soft)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--warning)' }}>Tempo API token not configured. Go to Settings first.</span>
                                    </div>
                                )}
                                {source === 'clockify' && !settings.clockify.apiKey && (
                                    <div style={{ padding: 'var(--space-4)', background: 'var(--warning-soft)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--warning)' }}>Clockify API key not configured. Go to Settings first.</span>
                                    </div>
                                )}

                                {/* Tempo Project Picker */}
                                {source === 'tempo' && settings.tempo.apiToken && (
                                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Jira Project
                                            {loadingTempoProjects && <RefreshCw size={12} className="animate-pulse" />}
                                        </label>
                                        {tempoProjects.length > 0 ? (
                                            <select
                                                className="form-input"
                                                value={selectedTempoProject}
                                                onChange={(e) => setSelectedTempoProject(e.target.value)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <option value="">All Projects (no filter)</option>
                                                {tempoProjects.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.key} — {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px' }}>
                                                {loadingTempoProjects ? 'Loading Jira projects…' : 'No projects found. You can still import all worklogs.'}
                                            </div>
                                        )}
                                        {activeProject?.tempoProjectKey && selectedTempoProject === activeProject.tempoProjectKey && (
                                            <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
                                                ✓ Previously linked to this project
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Clockify Project Picker */}
                                {source === 'clockify' && settings.clockify.apiKey && (
                                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            Clockify Project
                                            {loadingProjects && <RefreshCw size={12} className="animate-pulse" />}
                                        </label>
                                        {clockifyProjects.length > 0 ? (
                                            <select
                                                className="form-input"
                                                value={selectedClockifyProject}
                                                onChange={(e) => setSelectedClockifyProject(e.target.value)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <option value="">All Projects (no filter)</option>
                                                {clockifyProjects.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}{p.clientName ? ` — ${p.clientName}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px' }}>
                                                {loadingProjects ? 'Loading projects…' : 'No projects found. Check your API key and workspace ID.'}
                                            </div>
                                        )}
                                        {activeProject?.clockifyProjectName && selectedClockifyProject === activeProject.clockifyProjectId && (
                                            <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
                                                ✓ Previously linked to this project
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Date Range */}
                                {(source === 'tempo' || source === 'clockify') && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Start Date</label>
                                            <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">End Date</label>
                                            <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                                {source === 'csv' && (
                                    <div className="form-group">
                                        <label className="form-label">Paste CSV Data</label>
                                        <textarea
                                            className="form-textarea"
                                            placeholder={"date,category,task,hours,description,resource,role\n2025-09-04,Development,Bug Fixes,3.0,Fixed navigation bugs,Developer 1,developer"}
                                            value={csvText}
                                            onChange={(e) => setCsvText(e.target.value)}
                                            style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="card-footer">
                                <button className="btn btn-primary" onClick={handleImport} disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Clock size={16} className="animate-pulse" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} />
                                            Import Hours
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="card animate-in" style={{ borderColor: 'var(--danger)', marginBottom: 'var(--space-6)' }}>
                            <div className="card-body" style={{ color: 'var(--danger)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sample Data */}
                    <div className="section-divider"><span>or</span></div>
                    <div style={{ textAlign: 'center' }}>
                        <button className="btn btn-secondary" onClick={handleAddSample}>
                            <Upload size={16} />
                            Load Sample Data
                        </button>
                        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            Load sample time entries to explore the editor
                        </p>
                    </div>
                </>
            )}

            {/* === STEP 2: Resource → Role Mapping === */}
            {importStep === 'mapping' && (
                <div className="card animate-in">
                    <div className="card-header">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={18} style={{ color: 'var(--accent)' }} />
                            Map Resources to Roles
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {discoveredResources.length} team members • {rawEntries.length} entries
                        </span>
                    </div>
                    <div className="card-body">
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                            Assign each team member to an invoice role. This mapping will be saved for future imports on this project.
                        </p>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr auto 1fr 1fr auto',
                            gap: '10px 12px',
                            alignItems: 'center',
                            padding: 'var(--space-4)',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-2)',
                        }}>
                            {/* Header */}
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Resource</span>
                            <span></span>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Billing Category</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Display Title</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>Hours</span>

                            {discoveredResources.map(resource => {
                                const mapping = roleMappings.find(m => m.resourceName === resource);
                                const resourceHours = rawEntries
                                    .filter(e => e.resource === resource)
                                    .reduce((s, e) => s + e.timeSpent, 0);
                                const defaultLabel = availableRoles.find(r => r.role === (mapping?.role || 'developer'))?.label || 'Developer';

                                return (
                                    <React.Fragment key={resource}>
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{resource}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                                ({rawEntries.filter(e => e.resource === resource).length} entries)
                                            </span>
                                        </div>
                                        <ArrowRight size={14} style={{ opacity: 0.3 }} />
                                        <select
                                            className="form-input"
                                            value={mapping?.role || 'developer'}
                                            onChange={(e) => updateRoleMapping(resource, e.target.value)}
                                            style={{ padding: '6px 10px', fontSize: '13px', cursor: 'pointer' }}
                                        >
                                            {availableRoles.map(r => (
                                                <option key={r.role} value={r.role}>{r.label} (${r.rate}/hr)</option>
                                            ))}
                                        </select>
                                        <input
                                            className="form-input"
                                            value={mapping?.roleLabel || defaultLabel}
                                            onChange={(e) => updateRoleLabel(resource, e.target.value)}
                                            placeholder="e.g. Backend Developer"
                                            style={{ padding: '6px 10px', fontSize: '13px' }}
                                        />
                                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent)', textAlign: 'right' }}>
                                            {resourceHours.toFixed(1)}h
                                        </span>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                    <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button className="btn btn-secondary" onClick={() => setImportStep('source')}>
                            ← Back
                        </button>
                        <button className="btn btn-primary" onClick={handleApplyMappings}>
                            Apply Mappings & Continue
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* === STEP 3: Import Result === */}
            {importStep === 'result' && result && (
                <div className="card animate-in">
                    <div className="card-header">
                        <h3>
                            <Check size={18} style={{ color: 'var(--success)', marginRight: '8px' }} />
                            Import Successful
                        </h3>
                    </div>
                    <div className="card-body">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <span className="stat-card-label">Entries Found</span>
                                <span className="stat-card-value">{result.count}</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-card-label">Total Hours</span>
                                <span className="stat-card-value">{result.totalHours.toFixed(1)}</span>
                            </div>
                        </div>

                        {/* Role summary */}
                        {result.entries.length > 0 && (
                            <div style={{ marginTop: 'var(--space-4)' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
                                    By Role
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: '8px' }}>
                                    {Object.entries(
                                        result.entries.reduce((acc, e) => {
                                            acc[e.role] = (acc[e.role] || 0) + e.timeSpent;
                                            return acc;
                                        }, {} as Record<string, number>)
                                    ).map(([role, hours]) => (
                                        <div key={role} style={{
                                            padding: '6px 12px', borderRadius: 'var(--radius-md)',
                                            background: 'var(--surface-elevated)', fontSize: '12px',
                                        }}>
                                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>
                                            <span style={{ marginLeft: '6px', color: 'var(--accent)' }}>
                                                {(hours as number).toFixed(1)}h
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => { setResult(null); setImportStep('source'); }}>
                            Back
                        </button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" onClick={handleImportAnother}>
                                <Upload size={14} />
                                Import from Another Source
                            </button>
                            <button className="btn btn-primary" onClick={handleConfirm}>
                                Continue to Editor
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
