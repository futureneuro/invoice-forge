// ============================================================
// InvoiceForge - Zustand Store
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    TimeEntry, InvoiceConfig, AppSettings, AIMessage, Project,
    RoleRate, ClientInfo, CompanyInfo, PaymentInfo, PhasePlan,
    InvoiceType,
} from '@/types';

// --- Utility ---
const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Default Values ---
const defaultClient: ClientInfo = {
    name: 'NALC Health Benefit Plan',
    address: '20547 Waverly Ct,',
    city: 'Ashburn',
    state: 'VA',
    zip: '20149-0001',
    country: 'United States',
};

const defaultCompany: CompanyInfo = {
    name: 'Ou2there LCC',
    address: '5830 E 2ND ST, STE 7000',
    city: '#22058, CASPER',
    state: 'WY',
    zip: '82609',
    country: 'United States',
};

const defaultPayment: PaymentInfo = {
    accountHolder: 'Anuyan Kugavarathan',
    bankName: '',
    accountNumber: '509033337568062',
    routingNumber: '084009519',
    accountType: 'Deposit',
    notes: 'Please find attached the completed Form W-8ECI, as Form W-9 does not apply in this case. The EIN application is currently in progress; upon consultation with the IRS, it was confirmed that indicating "applied for" on the form is acceptable at this stage.',
    contactEmail: 'accounting@outthere.solutions',
    contactPhone: '647-873-4788',
};

const defaultRoles: RoleRate[] = [
    { id: '1', role: 'developer', label: 'Developers', rate: 120 },
    { id: '2', role: 'qa', label: 'QA', rate: 120 },
    { id: '3', role: 'uxui', label: 'UX/UI', rate: 120 },
    { id: '4', role: 'content', label: 'Content Design', rate: 120 },
    { id: '5', role: 'pm', label: 'Project Management', rate: 160 },
    { id: '6', role: 'advisor', label: 'Technical Advisor', rate: 140 },
];

// ============================================================
// Settings Store
// ============================================================
interface SettingsState {
    settings: AppSettings;
    updateSettings: (partial: Partial<AppSettings>) => void;
    updateTempo: (tempo: Partial<AppSettings['tempo']>) => void;
    updateClockify: (clockify: Partial<AppSettings['clockify']>) => void;
    updateAI: (ai: Partial<AppSettings['ai']>) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: {
                tempo: { apiToken: '', jiraBaseUrl: '', jiraEmail: '', jiraApiToken: '' },
                clockify: { apiKey: '', workspaceId: '' },
                ai: { anthropicApiKey: '', model: 'claude-sonnet-4-20250514' },
                defaultClient,
                company: defaultCompany,
                payment: defaultPayment,
                defaultRoles,
                defaultCategories: ['Development', 'QA', 'Design', 'Meeting', 'DevOps', 'Content', 'Project Management'],
                resourceRoleMappings: [],
                logoDataUrl: undefined,
            },
            updateSettings: (partial) =>
                set((s) => ({ settings: { ...s.settings, ...partial } })),
            updateTempo: (tempo) =>
                set((s) => ({
                    settings: { ...s.settings, tempo: { ...s.settings.tempo, ...tempo } },
                })),
            updateClockify: (clockify) =>
                set((s) => ({
                    settings: {
                        ...s.settings,
                        clockify: { ...s.settings.clockify, ...clockify },
                    },
                })),
            updateAI: (ai) =>
                set((s) => ({
                    settings: { ...s.settings, ai: { ...s.settings.ai, ...ai } },
                })),
        }),
        { name: 'invoice-forge-settings' }
    )
);

// ============================================================
// Time Entries Store (with Version History)
// ============================================================
interface EntryVersion {
    id: string;
    label: string;
    timestamp: number;
    entries: TimeEntry[];
}

interface TimeEntriesState {
    entries: TimeEntry[];
    versions: EntryVersion[];
    setEntries: (entries: TimeEntry[]) => void;
    addEntry: (entry: Omit<TimeEntry, 'id'>) => void;
    updateEntry: (id: string, updates: Partial<TimeEntry>) => void;
    deleteEntry: (id: string) => void;
    bulkUpdateEntries: (updates: { id: string; changes: Partial<TimeEntry> }[]) => void;
    clearEntries: () => void;
    snapshotVersion: (label: string) => void;
    restoreVersion: (versionId: string) => void;
    deleteVersion: (versionId: string) => void;
}

export const useTimeEntriesStore = create<TimeEntriesState>()(
    persist(
        (set, get) => ({
            entries: [],
            versions: [],
            setEntries: (entries) => set({ entries }),
            addEntry: (entry) =>
                set((s) => ({
                    entries: [...s.entries, { ...entry, id: generateId() }],
                })),
            updateEntry: (id, updates) =>
                set((s) => ({
                    entries: s.entries.map((e) =>
                        e.id === id ? { ...e, ...updates } : e
                    ),
                })),
            deleteEntry: (id) =>
                set((s) => ({
                    entries: s.entries.filter((e) => e.id !== id),
                })),
            bulkUpdateEntries: (updates) =>
                set((s) => ({
                    entries: s.entries.map((e) => {
                        const update = updates.find((u) => u.id === e.id);
                        return update ? { ...e, ...update.changes } : e;
                    }),
                })),
            clearEntries: () => set({ entries: [] }),
            snapshotVersion: (label) =>
                set((s) => ({
                    versions: [...s.versions, {
                        id: generateId(),
                        label,
                        timestamp: Date.now(),
                        entries: JSON.parse(JSON.stringify(s.entries)),
                    }],
                })),
            restoreVersion: (versionId) => {
                const version = get().versions.find(v => v.id === versionId);
                if (version) {
                    set({ entries: JSON.parse(JSON.stringify(version.entries)) });
                }
            },
            deleteVersion: (versionId) =>
                set((s) => ({
                    versions: s.versions.filter(v => v.id !== versionId),
                })),
        }),
        { name: 'invoice-forge-entries' }
    )
);

// ============================================================
// Invoice Store (with Draft Persistence)
// ============================================================
export interface DraftInvoice {
    projectId: string;
    invoice: InvoiceConfig | null;
    entries: TimeEntry[];
    flowStep: 'import' | 'editor' | 'invoice';
    updatedAt: string;
}

interface InvoiceState {
    currentInvoice: InvoiceConfig | null;
    invoiceHistory: InvoiceConfig[];
    drafts: Record<string, DraftInvoice>;
    createInvoice: (config: Partial<InvoiceConfig>) => InvoiceConfig;
    updateInvoice: (updates: Partial<InvoiceConfig>) => void;
    setCurrentInvoice: (invoice: InvoiceConfig | null) => void;
    saveInvoice: () => void;
    saveDraft: (projectId: string, flowStep: 'import' | 'editor' | 'invoice') => void;
    loadDraft: (projectId: string) => DraftInvoice | null;
    deleteDraft: (projectId: string) => void;
}

export const useInvoiceStore = create<InvoiceState>()(
    persist(
        (set, get) => ({
            currentInvoice: null,
            invoiceHistory: [],
            drafts: {},
            createInvoice: (config) => {
                const settings = useSettingsStore.getState().settings;
                const entries = useTimeEntriesStore.getState().entries;
                const nextNum = get().invoiceHistory.length + 13;
                const invoice: InvoiceConfig = {
                    id: generateId(),
                    invoiceNumber: config.invoiceNumber || `OU-2025-${nextNum}`,
                    date: config.date || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
                    reference: config.reference || `INV-OU-2025-${nextNum}`,
                    sprintName: config.sprintName || '',
                    dateRange: config.dateRange || '',
                    type: config.type || 'sprint',
                    summary: config.summary || '',
                    note: config.note || settings.payment.notes || '',
                    dueDate: config.dueDate || '',
                    client: config.client || settings.defaultClient,
                    company: config.company || settings.company,
                    payment: config.payment || settings.payment,
                    roles: config.roles || settings.defaultRoles,
                    entries: config.entries || entries,
                    phasePlan: config.phasePlan,
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                set({ currentInvoice: invoice });
                return invoice;
            },
            updateInvoice: (updates) =>
                set((s) => ({
                    currentInvoice: s.currentInvoice
                        ? { ...s.currentInvoice, ...updates, updatedAt: new Date().toISOString() }
                        : null,
                })),
            setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),
            saveInvoice: () =>
                set((s) => {
                    if (!s.currentInvoice) return s;
                    // Dedup by invoiceNumber — update existing instead of creating duplicate
                    const existing = s.invoiceHistory.findIndex(
                        (i) => i.invoiceNumber === s.currentInvoice!.invoiceNumber
                    );
                    const history =
                        existing >= 0
                            ? s.invoiceHistory.map((i, idx) =>
                                idx === existing ? { ...s.currentInvoice!, updatedAt: new Date().toISOString() } : i
                            )
                            : [...s.invoiceHistory, s.currentInvoice!];
                    return { invoiceHistory: history };
                }),
            saveDraft: (projectId, flowStep) =>
                set((s) => {
                    const entries = useTimeEntriesStore.getState().entries;
                    // Only save if there's something worth saving
                    if (entries.length === 0 && !s.currentInvoice) return s;
                    return {
                        drafts: {
                            ...s.drafts,
                            [projectId]: {
                                projectId,
                                invoice: s.currentInvoice,
                                entries,
                                flowStep,
                                updatedAt: new Date().toISOString(),
                            },
                        },
                    };
                }),
            loadDraft: (projectId) => {
                const draft = get().drafts[projectId];
                if (!draft) return null;
                // Restore entries and current invoice from draft
                useTimeEntriesStore.getState().setEntries(draft.entries);
                if (draft.invoice) {
                    set({ currentInvoice: draft.invoice });
                }
                return draft;
            },
            deleteDraft: (projectId) =>
                set((s) => {
                    const { [projectId]: _, ...remaining } = s.drafts;
                    return { drafts: remaining };
                }),
        }),
        {
            name: 'invoice-forge-invoices',
            version: 1,
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as { invoiceHistory?: Array<{ invoiceNumber: string; updatedAt?: string }> };
                if (version === 0 && state.invoiceHistory) {
                    // Dedup invoices by invoiceNumber — keep only the most recent one
                    const seen = new Map<string, number>();
                    const deduped = state.invoiceHistory.filter((inv, idx) => {
                        const existing = seen.get(inv.invoiceNumber);
                        if (existing !== undefined) {
                            // Keep the later one (higher index = more recent)
                            return false;
                        }
                        seen.set(inv.invoiceNumber, idx);
                        return true;
                    });
                    // Keep only the last entry for each invoiceNumber
                    const byNumber = new Map<string, typeof deduped[0]>();
                    for (const inv of state.invoiceHistory) {
                        byNumber.set(inv.invoiceNumber, inv);
                    }
                    state.invoiceHistory = Array.from(byNumber.values());
                }
                return state;
            },
        }
    )
);

// ============================================================
// Project Store
// ============================================================
interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    createProject: (name: string, client?: ClientInfo, description?: string) => Project;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    setActiveProject: (id: string | null) => void;
    getActiveProject: () => Project | null;
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            projects: [],
            activeProjectId: null,
            createProject: (name, client, description) => {
                const settings = useSettingsStore.getState().settings;
                const project: Project = {
                    id: generateId(),
                    name,
                    client: client || settings.defaultClient,
                    description,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                set((s) => ({
                    projects: [...s.projects, project],
                    activeProjectId: project.id,
                }));
                return project;
            },
            updateProject: (id, updates) =>
                set((s) => ({
                    projects: s.projects.map((p) =>
                        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
                    ),
                })),
            deleteProject: (id) =>
                set((s) => ({
                    projects: s.projects.filter((p) => p.id !== id),
                    activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
                })),
            setActiveProject: (id) => set({ activeProjectId: id }),
            getActiveProject: () => {
                const state = get();
                return state.projects.find((p) => p.id === state.activeProjectId) || null;
            },
        }),
        { name: 'invoice-forge-projects' }
    )
);

// ============================================================
// AI Chat Store
// ============================================================
interface AIChatState {
    messages: AIMessage[];
    isProcessing: boolean;
    addMessage: (msg: Omit<AIMessage, 'id' | 'timestamp'>) => void;
    setProcessing: (v: boolean) => void;
    clearMessages: () => void;
}

export const useAIChatStore = create<AIChatState>()((set) => ({
    messages: [],
    isProcessing: false,
    addMessage: (msg) =>
        set((s) => ({
            messages: [
                ...s.messages,
                { ...msg, id: generateId(), timestamp: new Date().toISOString() },
            ],
        })),
    setProcessing: (v) => set({ isProcessing: v }),
    clearMessages: () => set({ messages: [] }),
}));

// ============================================================
// Navigation Store (with auto-save/restore drafts)
// ============================================================
export type AppStep = 'dashboard' | 'projects' | 'settings' | 'invoice-flow';
export type InvoiceFlowStep = 'import' | 'editor' | 'invoice';

interface NavState {
    currentStep: AppStep;
    invoiceFlowStep: InvoiceFlowStep;
    setStep: (step: AppStep) => void;
    setInvoiceFlowStep: (step: InvoiceFlowStep) => void;
    enterInvoiceFlow: () => void;
    exitInvoiceFlow: () => void;
}

export const useNavStore = create<NavState>()((set, get) => ({
    currentStep: 'dashboard',
    invoiceFlowStep: 'import',
    setStep: (step) => {
        // Auto-save draft when navigating away from invoice flow
        const state = get();
        if (state.currentStep === 'invoice-flow' && step !== 'invoice-flow') {
            const projectId = useProjectStore.getState().activeProjectId;
            if (projectId) {
                useInvoiceStore.getState().saveDraft(projectId, state.invoiceFlowStep);
            }
        }
        set({ currentStep: step });
    },
    setInvoiceFlowStep: (step) => set({ invoiceFlowStep: step }),
    enterInvoiceFlow: () => {
        const projectId = useProjectStore.getState().activeProjectId;
        if (projectId) {
            // Try to restore a draft for this project
            const draft = useInvoiceStore.getState().loadDraft(projectId);
            if (draft) {
                set({ currentStep: 'invoice-flow', invoiceFlowStep: draft.flowStep });
                return;
            }
        }
        // No draft — start fresh
        useTimeEntriesStore.getState().clearEntries();
        useInvoiceStore.getState().setCurrentInvoice(null);
        set({ currentStep: 'invoice-flow', invoiceFlowStep: 'import' });
    },
    exitInvoiceFlow: () => {
        // Auto-save draft before exiting
        const state = get();
        const projectId = useProjectStore.getState().activeProjectId;
        if (projectId) {
            useInvoiceStore.getState().saveDraft(projectId, state.invoiceFlowStep);
        }
        set({ currentStep: 'projects', invoiceFlowStep: 'import' });
    },
}));
