'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Send, X, Sparkles, Loader2, AlertCircle, CheckCircle2,
    Zap, Cpu, History, RotateCcw, Trash2, Wand2
} from 'lucide-react';
import { useAIChatStore, useTimeEntriesStore, useSettingsStore } from '@/lib/store';

interface StatusStep {
    step: string;
    detail: string;
}

export function AIPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { messages, isProcessing, addMessage, setProcessing } = useAIChatStore();
    const {
        entries, updateEntry, addEntry, deleteEntry,
        snapshotVersion, restoreVersion, deleteVersion, versions
    } = useTimeEntriesStore();
    const { settings } = useSettingsStore();
    const [input, setInput] = useState('');
    const [streamingText, setStreamingText] = useState('');
    const [statusSteps, setStatusSteps] = useState<StatusStep[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [changesSummary, setChangesSummary] = useState('');
    const [changeProgress, setChangeProgress] = useState<{ current: number; total: number } | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isProcessing || streamingText) {
            scrollToBottom();
        }
    }, [isProcessing, streamingText, statusSteps]);

    const runAI = async (userMessage: string) => {
        if (isProcessing) return;

        setStreamingText('');
        setStatusSteps([]);
        setErrorMsg('');
        setChangesSummary('');
        setChangeProgress(null);
        addMessage({ role: 'user', content: userMessage });
        setProcessing(true);

        // Snapshot before AI changes
        snapshotVersion(`Before: "${userMessage.slice(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

        try {
            const response = await fetch('/api/ai/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    entries,
                    apiKey: settings.ai.anthropicApiKey,
                    model: settings.ai.model,
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                setErrorMsg(`HTTP ${response.status}: ${errText}`);
                addMessage({ role: 'assistant', content: `Error: HTTP ${response.status}` });
                setProcessing(false);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                setErrorMsg('No response stream available');
                setProcessing(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let fullStreamText = '';
            let appliedCount = 0;
            let failedCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (currentEvent === 'status') {
                                setStatusSteps(prev => [...prev, {
                                    step: data.step,
                                    detail: data.detail,
                                }]);
                            } else if (currentEvent === 'token') {
                                fullStreamText += data.text;
                                // Strip JSON blocks from display
                                const clean = fullStreamText
                                    .replace(/```json[\s\S]*?```/g, '')
                                    .replace(/```json[\s\S]*/g, '')
                                    .trim();
                                setStreamingText(clean);
                            } else if (currentEvent === 'message') {
                                addMessage({ role: 'assistant', content: data.text });
                                setStreamingText('');
                            } else if (currentEvent === 'change') {
                                setChangeProgress({ current: data.index + 1, total: data.total });
                                setStatusSteps(prev => {
                                    const filtered = prev.filter(s => s.step !== 'applying_item');
                                    return [...filtered, {
                                        step: 'applying_item',
                                        detail: `Applying change ${data.index + 1} of ${data.total}...`,
                                    }];
                                });

                                try {
                                    if (data.action === 'update' && data.entryId) {
                                        const exists = entries.find(e => e.id === data.entryId);
                                        if (exists) {
                                            updateEntry(data.entryId, data.updates);
                                            appliedCount++;
                                        } else {
                                            failedCount++;
                                        }
                                    } else if (data.action === 'add' && data.entry) {
                                        addEntry(data.entry);
                                        appliedCount++;
                                    } else if (data.action === 'delete' && data.entryId) {
                                        const exists = entries.find(e => e.id === data.entryId);
                                        if (exists) {
                                            deleteEntry(data.entryId);
                                            appliedCount++;
                                        } else {
                                            failedCount++;
                                        }
                                    }
                                } catch (changeErr) {
                                    console.error('[AI Refine] Change error:', changeErr);
                                    failedCount++;
                                }
                            } else if (currentEvent === 'error') {
                                setErrorMsg(data.error);
                                addMessage({ role: 'assistant', content: `Error: ${data.error}` });
                            } else if (currentEvent === 'done') {
                                const parts = [];
                                if (appliedCount) parts.push(`${appliedCount} applied`);
                                if (failedCount) parts.push(`${failedCount} failed`);
                                if (data.changesApplied === 0 && appliedCount === 0) parts.push('No changes needed');
                                setChangesSummary(parts.join(', '));
                                setChangeProgress(null);
                                setStatusSteps([]);
                            }
                        } catch (parseErr) {
                            console.error('[AI Refine] Parse error:', parseErr);
                        }
                        currentEvent = '';
                    }
                }
            }
        } catch (err) {
            const errMessage = err instanceof Error ? err.message : 'Connection failed';
            setErrorMsg(errMessage);
            addMessage({
                role: 'assistant',
                content: `Failed to connect: ${errMessage}. Check your API key in Settings.`,
            });
        } finally {
            setProcessing(false);
            setStreamingText('');
            setTimeout(scrollToBottom, 100);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;
        const msg = input.trim();
        setInput('');
        await runAI(msg);
    };

    const handleCleanUp = () => {
        const categories = settings.defaultCategories?.length
            ? settings.defaultCategories.join(', ')
            : 'Development, QA, Design, Meeting, DevOps, Content, Project Management';

        const cleanupPrompt = `Clean up and professionalize ALL time log entries. For EVERY entry across ALL roles:

1. **Enrich descriptions**: Make each description professional and client-ready. Include the Jira ticket reference and what was actually worked on. Remove vague language.
2. **Split multi-task entries**: If an entry has multiple hours logged with a vague description that seems to cover multiple tasks, SPLIT it into separate entries — one per distinct task. Keep the same date, resource, and role but divide the hours logically.
3. **Fix categories**: Each entry MUST be assigned one of these configured categories ONLY: ${categories}. Choose the most appropriate category based on the work described. Do NOT use any categories outside this list.
4. **Remove duplicates**: If two entries on the same date by the same person describe the same work, consolidate them.
5. **Standardize task names**: Use the Jira ticket key (e.g., "PROJ-123") as the task name where available.

Process ALL entries across ALL role groups. Do not skip any entries.`;

        runAI(cleanupPrompt);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleRestore = (versionId: string) => {
        restoreVersion(versionId);
        setChangesSummary('Restored to previous version');
    };

    const stepIcon = (step: string) => {
        switch (step) {
            case 'preparing': return <Cpu size={12} />;
            case 'calling_api': return <Zap size={12} />;
            case 'streaming': return <Sparkles size={12} />;
            case 'parsing': return <Loader2 size={12} className="animate-pulse" />;
            case 'applying': return <CheckCircle2 size={12} />;
            case 'applying_item': return <Loader2 size={12} className="animate-pulse" />;
            default: return <Loader2 size={12} className="animate-pulse" />;
        }
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`ai-panel ${isOpen ? 'open' : ''}`}>
            <div className="ai-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 700 }}>AI Assistant</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={() => setShowHistory(!showHistory)}
                        title="Version History"
                        style={{ color: showHistory ? 'var(--accent)' : undefined }}
                    >
                        <History size={16} />
                    </button>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Version History Panel */}
            {showHistory && (
                <div style={{
                    borderBottom: '1px solid var(--border)',
                    maxHeight: '250px',
                    overflowY: 'auto',
                }}>
                    <div style={{
                        padding: '10px 14px 6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        color: 'var(--text-tertiary)',
                    }}>
                        Version History
                    </div>
                    {versions.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            No versions yet. Versions are created automatically before each AI edit.
                        </div>
                    ) : (
                        <div style={{ padding: '0 8px 8px' }}>
                            {[...versions].reverse().map((v) => (
                                <div key={v.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {v.label}
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                                            {formatTime(v.timestamp)} · {v.entries.length} entries
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleRestore(v.id)}
                                        title="Restore this version"
                                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                                    >
                                        <RotateCcw size={12} /> Restore
                                    </button>
                                    <button
                                        className="btn btn-icon btn-ghost"
                                        onClick={() => deleteVersion(v.id)}
                                        title="Delete version"
                                        style={{ padding: '4px' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="ai-panel-messages">
                {messages.length === 0 && !isProcessing && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <Sparkles size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                        <p style={{ fontSize: 'var(--text-sm)', marginBottom: '8px' }}>
                            AI-powered time log refinement
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', marginBottom: '16px' }}>
                            Ask me to refine descriptions, adjust hours, or analyze your time log. Changes are applied directly and you can revert anytime.
                        </p>

                        {/* Quick Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={handleCleanUp}
                                disabled={isProcessing || entries.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    justifyContent: 'flex-start',
                                    textAlign: 'left',
                                }}
                            >
                                <Wand2 size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>🧹 Clean Up &amp; Enrich</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        Professionalize descriptions, split multi-task entries, fix categories
                                    </div>
                                </div>
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => runAI('Refine all descriptions to be clear, professional, and client-ready. Keep all hours and assignments the same.')}
                                disabled={isProcessing || entries.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    justifyContent: 'flex-start',
                                    textAlign: 'left',
                                }}
                            >
                                <Sparkles size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>✨ Refine Descriptions</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        Make descriptions professional without changing hours or roles
                                    </div>
                                </div>
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => runAI('Analyze the time log and provide a summary: total hours by resource, by category, and any entries that look like potential duplicates or inconsistencies.')}
                                disabled={isProcessing || entries.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    justifyContent: 'flex-start',
                                    textAlign: 'left',
                                }}
                            >
                                <Cpu size={16} style={{ color: 'var(--info)', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>📊 Analyze Hours</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        Breakdown by resource and category, spot duplicates
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`ai-message ${msg.role}`}>
                        {msg.role === 'assistant' ? (
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                        ) : (
                            msg.content
                        )}
                    </div>
                ))}

                {/* Changes applied summary */}
                {changesSummary && !isProcessing && (
                    <div style={{
                        padding: '8px 14px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '12px',
                        color: '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        margin: '4px 12px 8px',
                    }}>
                        <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                        <span>{changesSummary}</span>
                        {versions.length > 0 && (
                            <button
                                onClick={() => setShowHistory(true)}
                                style={{
                                    marginLeft: 'auto',
                                    background: 'none',
                                    border: 'none',
                                    color: '#22c55e',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    textDecoration: 'underline',
                                    padding: 0,
                                }}
                            >
                                Undo
                            </button>
                        )}
                    </div>
                )}

                {/* Live status & streaming area */}
                {isProcessing && (
                    <div className="ai-message assistant" style={{ padding: 0 }}>
                        {statusSteps.length > 0 && (
                            <div style={{
                                padding: '10px 14px',
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: streamingText ? '8px' : 0,
                                fontSize: '12px',
                            }}>
                                {statusSteps.map((s, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '3px 0',
                                        color: i === statusSteps.length - 1 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                        opacity: i === statusSteps.length - 1 ? 1 : 0.6,
                                    }}>
                                        {i === statusSteps.length - 1 ? stepIcon(s.step) : (
                                            <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                                        )}
                                        <span>{s.detail}</span>
                                    </div>
                                ))}

                                {changeProgress && (
                                    <div style={{ marginTop: '6px' }}>
                                        <div style={{
                                            height: '3px',
                                            background: 'var(--border)',
                                            borderRadius: '2px',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${(changeProgress.current / changeProgress.total) * 100}%`,
                                                background: 'var(--accent)',
                                                borderRadius: '2px',
                                                transition: 'width 0.2s ease',
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {streamingText && (
                            <div style={{
                                padding: '10px 14px',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.6,
                                fontSize: '13px',
                            }}>
                                {streamingText}
                                <span className="animate-pulse" style={{
                                    display: 'inline-block',
                                    width: '6px',
                                    height: '14px',
                                    background: 'var(--accent)',
                                    marginLeft: '2px',
                                    verticalAlign: 'text-bottom',
                                    borderRadius: '1px',
                                }} />
                            </div>
                        )}

                        {statusSteps.length === 0 && !streamingText && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                                <Loader2 size={14} className="animate-pulse" />
                                Connecting...
                            </div>
                        )}
                    </div>
                )}

                {/* Error display */}
                {errorMsg && !isProcessing && (
                    <div style={{
                        padding: '10px 14px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '12px',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        margin: '0 12px 12px',
                    }}>
                        <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                        <div style={{ wordBreak: 'break-word' }}>{errorMsg}</div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="ai-panel-input">
                <input
                    className="form-input"
                    placeholder="Refine descriptions, adjust hours..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    style={{ flex: 1 }}
                />
                <button
                    className="btn btn-primary btn-icon"
                    onClick={handleSend}
                    disabled={isProcessing || !input.trim()}
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
