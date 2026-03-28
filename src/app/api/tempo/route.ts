import { NextRequest, NextResponse } from 'next/server';

interface RoleMapping {
    resourceName: string;
    role: string;
}

export async function POST(req: NextRequest) {
    try {
        const { apiToken, jiraBaseUrl, jiraEmail, jiraApiToken, startDate, endDate, projectId, resourceRoleMappings } = await req.json();

        if (!apiToken) {
            return NextResponse.json({ error: 'Tempo API token is required' });
        }

        // Build the Tempo API URL — optionally filter by project
        let tempoUrl: string;
        if (projectId) {
            tempoUrl = `https://api.tempo.io/4/worklogs/project/${projectId}?from=${startDate}&to=${endDate}&limit=5000`;
        } else {
            tempoUrl = `https://api.tempo.io/4/worklogs?from=${startDate}&to=${endDate}&limit=5000`;
        }

        const response = await fetch(tempoUrl, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `Tempo API error: ${response.status} - ${err}` });
        }

        const data = await response.json();
        const worklogs = data.results || [];

        // --- Resolve account IDs to display names via Jira REST API ---
        const accountIds = new Set<string>();
        worklogs.forEach((wl: Record<string, unknown>) => {
            const author = wl.author as Record<string, unknown>;
            if (author?.accountId) accountIds.add(author.accountId as string);
        });

        const nameMap = new Map<string, string>();
        const cleanBaseUrl = (jiraBaseUrl || '').replace(/\/$/, '');
        const authHeader = cleanBaseUrl && jiraEmail && jiraApiToken
            ? 'Basic ' + Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64')
            : '';

        if (accountIds.size > 0 && authHeader) {
            // Batch-resolve users (up to 50 at a time via /rest/api/3/user/bulk)
            const ids = [...accountIds];
            const batchSize = 50;

            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const params = batch.map(id => `accountId=${encodeURIComponent(id)}`).join('&');

                try {
                    const jiraRes = await fetch(
                        `${cleanBaseUrl}/rest/api/3/user/bulk?${params}&maxResults=${batchSize}`,
                        { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
                    );

                    if (jiraRes.ok) {
                        const jiraData = await jiraRes.json();
                        (jiraData.values || []).forEach((u: Record<string, unknown>) => {
                            if (u.accountId && u.displayName) {
                                nameMap.set(u.accountId as string, u.displayName as string);
                            }
                        });
                    } else {
                        // Fallback: resolve one by one
                        for (const id of batch) {
                            try {
                                const singleRes = await fetch(
                                    `${cleanBaseUrl}/rest/api/3/user?accountId=${encodeURIComponent(id)}`,
                                    { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
                                );
                                if (singleRes.ok) {
                                    const u = await singleRes.json();
                                    if (u.displayName) nameMap.set(id, u.displayName as string);
                                }
                            } catch { /* skip individual failures */ }
                        }
                    }
                } catch { /* skip batch failures */ }
            }
        }

        // --- Fetch Jira issue details (summary) for all unique issue keys ---
        const issueKeys = new Set<string>();
        worklogs.forEach((wl: Record<string, unknown>) => {
            const issue = wl.issue as Record<string, unknown>;
            if (issue?.key) issueKeys.add(issue.key as string);
        });

        const issueSummaryMap = new Map<string, string>();

        if (issueKeys.size > 0 && authHeader) {
            // Use JQL search to batch-fetch issue summaries
            const keys = [...issueKeys];
            const batchSize = 50;

            for (let i = 0; i < keys.length; i += batchSize) {
                const batch = keys.slice(i, i + batchSize);
                const jql = `key in (${batch.map(k => `"${k}"`).join(',')})`;

                try {
                    const searchRes = await fetch(
                        `${cleanBaseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary&maxResults=${batchSize}`,
                        { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
                    );

                    if (searchRes.ok) {
                        const searchData = await searchRes.json();
                        (searchData.issues || []).forEach((issue: Record<string, unknown>) => {
                            const key = issue.key as string;
                            const fields = issue.fields as Record<string, unknown>;
                            if (key && fields?.summary) {
                                issueSummaryMap.set(key, fields.summary as string);
                            }
                        });
                    }
                } catch {
                    // Skip failures — summaries are nice-to-have
                }
            }
        }

        // Build role mapping lookup
        const roleMappings: RoleMapping[] = resourceRoleMappings || [];
        const roleMap = new Map<string, string>();
        roleMappings.forEach((m: RoleMapping) => {
            roleMap.set(m.resourceName.toLowerCase(), m.role);
        });

        // Auto-categorize based on issue type or description
        const categorizeEntry = (wl: Record<string, unknown>): string => {
            const desc = ((wl.description as string) || '').toLowerCase();

            if (desc.includes('qa') || desc.includes('test') || desc.includes('bug')) return 'QA';
            if (desc.includes('design') || desc.includes('ux') || desc.includes('ui ') || desc.includes('figma')) return 'Design';
            if (desc.includes('meeting') || desc.includes('sync') || desc.includes('standup') || desc.includes('review')) return 'Meeting';
            if (desc.includes('content') || desc.includes('writing') || desc.includes('copy')) return 'Content';
            if (desc.includes('devops') || desc.includes('deploy') || desc.includes('ci/cd') || desc.includes('infra')) return 'DevOps';

            return 'Development';
        };

        // Map Tempo worklogs to our TimeEntry format
        const entries = worklogs.map((wl: Record<string, unknown>) => {
            const author = (wl.author as Record<string, unknown>);
            const accountId = (author?.accountId as string) || '';
            const displayName = nameMap.get(accountId) || (author?.displayName as string) || accountId.slice(0, 8) || 'Unknown';
            const assignedRole = roleMap.get(displayName.toLowerCase()) || 'developer';

            const issueKey = (wl.issue as Record<string, unknown>)?.key as string || '';
            const issueSummary = issueSummaryMap.get(issueKey) || '';

            // Build a rich description that includes ticket context
            const rawDesc = (wl.description as string) || '';
            let enrichedDesc = rawDesc;
            if (issueKey && issueSummary && !rawDesc.toLowerCase().includes(issueSummary.toLowerCase().slice(0, 20))) {
                // Prepend ticket context if not already in the description
                enrichedDesc = rawDesc
                    ? `[${issueKey}] ${issueSummary} — ${rawDesc}`
                    : `[${issueKey}] ${issueSummary}`;
            } else if (issueKey && !rawDesc.includes(issueKey)) {
                enrichedDesc = rawDesc ? `[${issueKey}] ${rawDesc}` : `[${issueKey}]`;
            }

            return {
                id: String(wl.tempoWorklogId),
                date: wl.startDate,
                category: categorizeEntry(wl),
                taskName: issueKey || 'Unknown',
                taskId: issueKey || undefined,
                ticketKey: issueKey || undefined,
                ticketSummary: issueSummary || undefined,
                timeSpent: Math.round((Number(wl.timeSpentSeconds) / 3600) * 100) / 100,
                description: enrichedDesc,
                resource: displayName,
                role: assignedRole,
                source: 'tempo' as const,
                isRefined: false,
            };
        });

        // Collect unique resources
        const uniqueResources = [...new Set(entries.map((e: { resource: string }) => e.resource))];

        return NextResponse.json({
            entries,
            uniqueResources,
            totalHours: entries.reduce(
                (sum: number, e: { timeSpent: number }) => sum + e.timeSpent,
                0
            ),
            count: entries.length,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
