// ============================================================
// InvoiceForge - Utility Functions
// ============================================================

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format a date string as MM/DD/YYYY
 */
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
    });
}

/**
 * Format date as MM/DD/YY
 */
export function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
    });
}

/**
 * Calculate total hours for a set of entries
 * Rounds to 2 decimal places to avoid floating-point accumulation errors
 */
export function totalHours(entries: { timeSpent: number }[]): number {
    const raw = entries.reduce((sum, e) => sum + e.timeSpent, 0);
    return Math.round(raw * 100) / 100;
}

/**
 * Group entries by a given key
 */
export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((groups, item) => {
        const k = String(item[key]);
        if (!groups[k]) groups[k] = [];
        groups[k].push(item);
        return groups;
    }, {} as Record<string, T[]>);
}

/**
 * Sort entries by date, then by category
 */
export function sortEntries<T extends { date: string; category: string }>(
    entries: T[]
): T[] {
    return [...entries].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.category.localeCompare(b.category);
    });
}

/**
 * Generate a unique ID
 */
export function uid(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
