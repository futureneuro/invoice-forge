// ============================================================
// InvoiceForge - Zustand Store (Supabase-backed)
// ============================================================
import { create } from 'zustand';
import type {
    TimeEntry, InvoiceConfig, AppSettings, AIMessage, Project,
    RoleRate, ClientInfo, CompanyInfo, PaymentInfo,
} from '@/types';
import * as db from '@/lib/supabase-data';
import type { DraftRow } from '@/lib/supabase-data';

// --- Utility ---
const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Debounce helper ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let timer: ReturnType<typeof setTimeout>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }) as unknown as T;
}

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

const defaultSettings: AppSettings = {
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
};

// ============================================================
// Global user ID tracking (set by AuthProvider)
// ============================================================
let _currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null) {
    _currentUserId = userId;
}

export function getCurrentUserId(): string | null {
    return _currentUserId;
}

// ============================================================
// Settings Store
// ============================================================
interface SettingsState {
    settings: AppSettings;
    _hydrated: boolean;
    updateSettings: (partial: Partial<AppSettings>) => void;
    updateTempo: (tempo: Partial<AppSettings['tempo']>) => void;
    updateClockify: (clockify: Partial<AppSettings['clockify']>) => void;
    updateAI: (ai: Partial<AppSettings['ai']>) => void;
    loadFromSupabase: (userId: string) => Promise<void>;
}

const debouncedSaveSettings = debounce((userId: string, settings: AppSettings) => {
    db.saveSettings(userId, settings);
}, 500);

export const useSettingsStore = create<SettingsState>()((set, get) => ({
    settings: { ...defaultSettings },
    _hydrated: false,
    updateSettings: (partial) => {
        set((s) => ({ settings: { ...s.settings, ...partial } }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveSettings(userId, get().settings);
    },
    updateTempo: (tempo) => {
        set((s) => ({
            settings: { ...s.settings, tempo: { ...s.settings.tempo, ...tempo } },
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveSettings(userId, get().settings);
    },
    updateClockify: (clockify) => {
        set((s) => ({
            settings: {
                ...s.settings,
                clockify: { ...s.settings.clockify, ...clockify },
            },
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveSettings(userId, get().settings);
    },
    updateAI: (ai) => {
        set((s) => ({
            settings: { ...s.settings, ai: { ...s.settings.ai, ...ai } },
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveSettings(userId, get().settings);
    },
    loadFromSupabase: async (userId: string) => {
        setCurrentUserId(userId);
        const loaded = await db.loadSettings(userId);
        if (loaded) {
            // Deep merge with defaults to handle new fields
            set({
                settings: {
                    ...defaultSettings,
                    ...loaded,
                    tempo: { ...defaultSettings.tempo, ...loaded.tempo },
                    clockify: { ...defaultSettings.clockify, ...loaded.clockify },
                    ai: { ...defaultSettings.ai, ...loaded.ai },
                    company: { ...defaultSettings.company, ...loaded.company },
                    defaultClient: { ...defaultSettings.defaultClient, ...loaded.defaultClient },
                    payment: { ...defaultSettings.payment, ...loaded.payment },
                },
                _hydrated: true,
            });
        } else {
            // First time — save defaults to Supabase
            await db.saveSettings(userId, defaultSettings);
            set({ _hydrated: true });
        }
    },
}));

// ============================================================
// Time Entries Store (with Version History)
// ============================================================
interface EntryVersion {
    id: string;
    label: string;
    timestamp: number;
    entries: TimeEntry[];
}

const MAX_VERSIONS = 5;

interface TimeEntriesState {
    entries: TimeEntry[];
    versions: EntryVersion[];
    _hydrated: boolean;
    setEntries: (entries: TimeEntry[]) => void;
    addEntry: (entry: Omit<TimeEntry, 'id'>) => void;
    updateEntry: (id: string, updates: Partial<TimeEntry>) => void;
    deleteEntry: (id: string) => void;
    bulkUpdateEntries: (updates: { id: string; changes: Partial<TimeEntry> }[]) => void;
    clearEntries: () => void;
    snapshotVersion: (label: string) => void;
    restoreVersion: (versionId: string) => void;
    deleteVersion: (versionId: string) => void;
    loadFromSupabase: (userId: string) => Promise<void>;
}

const debouncedSaveEntries = debounce((userId: string, entries: TimeEntry[], versions: EntryVersion[]) => {
    db.saveTimeEntries(userId, entries, versions);
}, 500);


export const useTimeEntriesStore = create<TimeEntriesState>()((set, get) => ({
    entries: [],
    versions: [],
    _hydrated: false,
    setEntries: (entries) => {
        set({ entries });
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, entries, get().versions);
    },
    addEntry: (entry) => {
        set((s) => ({
            entries: [...s.entries, { ...entry, id: generateId() }],
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, get().entries, get().versions);
    },
    updateEntry: (id, updates) => {
        set((s) => ({
            entries: s.entries.map((e) =>
                e.id === id ? { ...e, ...updates } : e
            ),
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, get().entries, get().versions);
    },
    deleteEntry: (id) => {
        set((s) => ({
            entries: s.entries.filter((e) => e.id !== id),
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, get().entries, get().versions);
    },
    bulkUpdateEntries: (updates) => {
        set((s) => ({
            entries: s.entries.map((e) => {
                const update = updates.find((u) => u.id === e.id);
                return update ? { ...e, ...update.changes } : e;
            }),
        }));
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, get().entries, get().versions);
    },
    clearEntries: () => {
        set({ entries: [] });
        const userId = getCurrentUserId();
        if (userId) debouncedSaveEntries(userId, [], get().versions);
    },
    snapshotVersion: (label) => {
        const currentEntries = get().entries;
        const newVersion: EntryVersion = {
            id: generateId(),
            label,
            timestamp: Date.now(),
            entries: JSON.parse(JSON.stringify(currentEntries)),
        };
        const updated = [...get().versions, newVersion].slice(-MAX_VERSIONS);
        set({ versions: updated });
        // Save immediately for snapshots
        const userId = getCurrentUserId();
        if (userId) db.saveTimeEntries(userId, get().entries, updated);
    },
    restoreVersion: (versionId) => {
        const version = get().versions.find(v => v.id === versionId);
        if (version) {
            const restored = JSON.parse(JSON.stringify(version.entries));
            set({ entries: restored });
            const userId = getCurrentUserId();
            if (userId) db.saveTimeEntries(userId, restored, get().versions);
        }
    },
    deleteVersion: (versionId) => {
        const updated = get().versions.filter(v => v.id !== versionId);
        set({ versions: updated });
        const userId = getCurrentUserId();
        if (userId) db.saveTimeEntries(userId, get().entries, updated);
    },
    loadFromSupabase: async (userId: string) => {
        const data = await db.loadTimeEntries(userId);
        if (data) {
            set({
                entries: data.entries || [],
                versions: data.versions || [],
                _hydrated: true,
            });
        } else {
            set({ _hydrated: true });
        }
    },
}));

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
    _hydrated: boolean;
    createInvoice: (config: Partial<InvoiceConfig>) => InvoiceConfig;
    updateInvoice: (updates: Partial<InvoiceConfig>) => void;
    setCurrentInvoice: (invoice: InvoiceConfig | null) => void;
    saveInvoice: () => void;
    saveDraft: (projectId: string, flowStep: 'import' | 'editor' | 'invoice') => void;
    loadDraft: (projectId: string) => DraftInvoice | null;
    deleteDraft: (projectId: string) => void;
    loadFromSupabase: (userId: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>()((set, get) => ({
    currentInvoice: null,
    invoiceHistory: [],
    drafts: {},
    _hydrated: false,
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
    saveInvoice: () => {
        const state = get();
        if (!state.currentInvoice) return;

        // Dedup by invoiceNumber
        const existing = state.invoiceHistory.findIndex(
            (i) => i.invoiceNumber === state.currentInvoice!.invoiceNumber
        );
        const updatedInvoice = { ...state.currentInvoice, updatedAt: new Date().toISOString() };
        const history =
            existing >= 0
                ? state.invoiceHistory.map((i, idx) => idx === existing ? updatedInvoice : i)
                : [...state.invoiceHistory, state.currentInvoice];

        set({ invoiceHistory: history });

        // Persist to Supabase
        const userId = getCurrentUserId();
        if (userId) {
            db.saveInvoiceToHistory(userId, updatedInvoice);
        }
    },
    saveDraft: (projectId, flowStep) => {
        const entries = useTimeEntriesStore.getState().entries;
        const state = get();
        if (entries.length === 0 && !state.currentInvoice) return;

        const draft: DraftInvoice = {
            projectId,
            invoice: state.currentInvoice,
            entries,
            flowStep,
            updatedAt: new Date().toISOString(),
        };

        set((s) => ({
            drafts: { ...s.drafts, [projectId]: draft },
        }));

        const userId = getCurrentUserId();
        if (userId) {
            db.saveDraftToDB(userId, projectId, draft);
        }
    },
    loadDraft: (projectId) => {
        const draft = get().drafts[projectId];
        if (!draft) return null;
        useTimeEntriesStore.getState().setEntries(draft.entries);
        if (draft.invoice) {
            set({ currentInvoice: draft.invoice });
        }
        return draft;
    },
    deleteDraft: (projectId) => {
        set((s) => {
            const { [projectId]: _, ...remaining } = s.drafts;
            return { drafts: remaining };
        });
        const userId = getCurrentUserId();
        if (userId) {
            db.deleteDraftFromDB(userId, projectId);
        }
    },
    loadFromSupabase: async (userId: string) => {
        const [history, drafts] = await Promise.all([
            db.loadInvoiceHistory(userId),
            db.loadDrafts(userId),
        ]);
        set({
            invoiceHistory: history,
            drafts: drafts as Record<string, DraftInvoice>,
            _hydrated: true,
        });
    },
}));

// ============================================================
// Project Store
// ============================================================
interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    _hydrated: boolean;
    createProject: (name: string, client?: ClientInfo, description?: string) => Project;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    setActiveProject: (id: string | null) => void;
    getActiveProject: () => Project | null;
    loadFromSupabase: (userId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
    projects: [],
    activeProjectId: null,
    _hydrated: false,
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
        const userId = getCurrentUserId();
        if (userId) db.saveProject(userId, project);
        return project;
    },
    updateProject: (id, updates) => {
        let updatedProject: Project | null = null;
        set((s) => ({
            projects: s.projects.map((p) => {
                if (p.id === id) {
                    updatedProject = { ...p, ...updates, updatedAt: new Date().toISOString() };
                    return updatedProject;
                }
                return p;
            }),
        }));
        const userId = getCurrentUserId();
        if (userId && updatedProject) db.saveProject(userId, updatedProject);
    },
    deleteProject: (id) => {
        set((s) => ({
            projects: s.projects.filter((p) => p.id !== id),
            activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        }));
        const userId = getCurrentUserId();
        if (userId) db.deleteProjectFromDB(userId, id);
    },
    setActiveProject: (id) => set({ activeProjectId: id }),
    getActiveProject: () => {
        const state = get();
        return state.projects.find((p) => p.id === state.activeProjectId) || null;
    },
    loadFromSupabase: async (userId: string) => {
        const projects = await db.loadProjects(userId);
        set({ projects, _hydrated: true });
    },
}));

// ============================================================
// AI Chat Store (no persistence needed — ephemeral per session)
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
// Navigation Store (no persistence needed)
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
            const draft = useInvoiceStore.getState().loadDraft(projectId);
            if (draft) {
                set({ currentStep: 'invoice-flow', invoiceFlowStep: draft.flowStep });
                return;
            }
        }
        useTimeEntriesStore.getState().clearEntries();
        useInvoiceStore.getState().setCurrentInvoice(null);
        set({ currentStep: 'invoice-flow', invoiceFlowStep: 'import' });
    },
    exitInvoiceFlow: () => {
        const state = get();
        const projectId = useProjectStore.getState().activeProjectId;
        if (projectId) {
            useInvoiceStore.getState().saveDraft(projectId, state.invoiceFlowStep);
        }
        set({ currentStep: 'projects', invoiceFlowStep: 'import' });
    },
}));
