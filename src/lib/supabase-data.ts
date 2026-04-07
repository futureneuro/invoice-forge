// ============================================================
// InvoiceForge - Supabase Data Layer
// All CRUD operations for persisting data to Supabase
// ============================================================
import { createClient } from './supabase';
import type { AppSettings, Project, InvoiceConfig, TimeEntry } from '@/types';

// --- Helpers ---
function getSupabase() {
    return createClient();
}

// ============================================================
// Settings
// ============================================================
export async function loadSettings(userId: string): Promise<AppSettings | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] loadSettings error:', error);
    }
    return data?.settings ?? null;
}

export async function saveSettings(userId: string, settings: AppSettings): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('user_settings')
        .upsert(
            { user_id: userId, settings },
            { onConflict: 'user_id' }
        );

    if (error) {
        console.error('[Supabase] saveSettings error:', error);
    }
}

// ============================================================
// Projects
// ============================================================
export async function loadProjects(userId: string): Promise<Project[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('projects')
        .select('project_id, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Supabase] loadProjects error:', error);
        return [];
    }
    return (data || []).map((row: { project_id: string; data: Record<string, unknown> }) => ({ ...row.data, id: row.project_id })) as Project[];
}

export async function saveProject(userId: string, project: Project): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('projects')
        .upsert(
            {
                user_id: userId,
                project_id: project.id,
                data: project,
            },
            { onConflict: 'user_id,project_id' }
        );

    if (error) {
        console.error('[Supabase] saveProject error:', error);
    }
}

export async function deleteProjectFromDB(userId: string, projectId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

    if (error) {
        console.error('[Supabase] deleteProject error:', error);
    }
}

// ============================================================
// Invoices (history)
// ============================================================
export async function loadInvoiceHistory(userId: string): Promise<InvoiceConfig[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('invoices')
        .select('data')
        .eq('user_id', userId)
        .eq('is_draft', false)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Supabase] loadInvoiceHistory error:', error);
        return [];
    }
    return (data || []).map((row: { data: unknown }) => row.data as InvoiceConfig);
}

export async function saveInvoiceToHistory(userId: string, invoice: InvoiceConfig): Promise<void> {
    const supabase = getSupabase();

    // Upsert by invoice_number to prevent duplicates
    // First try to find existing
    const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', userId)
        .eq('invoice_number', invoice.invoiceNumber)
        .eq('is_draft', false)
        .single();

    if (existing) {
        // Update
        await supabase
            .from('invoices')
            .update({
                data: invoice,
                status: invoice.status,
            })
            .eq('id', existing.id);
    } else {
        // Insert
        await supabase
            .from('invoices')
            .insert({
                user_id: userId,
                invoice_number: invoice.invoiceNumber,
                status: invoice.status,
                is_draft: false,
                data: invoice,
            });
    }
}

// ============================================================
// Drafts
// ============================================================
export interface DraftRow {
    projectId: string;
    invoice: InvoiceConfig | null;
    entries: TimeEntry[];
    flowStep: 'import' | 'editor' | 'invoice';
    updatedAt: string;
}

export async function loadDrafts(userId: string): Promise<Record<string, DraftRow>> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('invoices')
        .select('draft_project_id, data')
        .eq('user_id', userId)
        .eq('is_draft', true);

    if (error) {
        console.error('[Supabase] loadDrafts error:', error);
        return {};
    }

    const drafts: Record<string, DraftRow> = {};
    for (const row of data || []) {
        if (row.draft_project_id) {
            drafts[row.draft_project_id] = row.data as DraftRow;
        }
    }
    return drafts;
}

export async function saveDraftToDB(userId: string, projectId: string, draft: DraftRow): Promise<void> {
    const supabase = getSupabase();

    const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', userId)
        .eq('draft_project_id', projectId)
        .eq('is_draft', true)
        .single();

    if (existing) {
        await supabase
            .from('invoices')
            .update({ data: draft })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('invoices')
            .insert({
                user_id: userId,
                draft_project_id: projectId,
                is_draft: true,
                status: 'draft',
                data: draft,
            });
    }
}

export async function deleteDraftFromDB(userId: string, projectId: string): Promise<void> {
    const supabase = getSupabase();
    await supabase
        .from('invoices')
        .delete()
        .eq('user_id', userId)
        .eq('draft_project_id', projectId)
        .eq('is_draft', true);
}

// ============================================================
// Time Entries
// ============================================================
interface TimeEntriesRow {
    entries: TimeEntry[];
    versions: { id: string; label: string; timestamp: number; entries: TimeEntry[] }[];
}

export async function loadTimeEntries(userId: string): Promise<TimeEntriesRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('time_entries')
        .select('entries, versions')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('[Supabase] loadTimeEntries error:', error);
    }
    return data ?? null;
}

export async function saveTimeEntries(
    userId: string,
    entries: TimeEntry[],
    versions: { id: string; label: string; timestamp: number; entries: TimeEntry[] }[]
): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('time_entries')
        .upsert(
            { user_id: userId, entries, versions },
            { onConflict: 'user_id' }
        );

    if (error) {
        console.error('[Supabase] saveTimeEntries error:', error);
    }
}
