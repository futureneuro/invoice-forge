import { NextRequest, NextResponse } from 'next/server';

interface RoleMapping {
    resourceName: string;
    role: string;
}

export async function POST(req: NextRequest) {
    try {
        const { apiKey, workspaceId: providedWorkspaceId, startDate, endDate, projectId, resourceRoleMappings } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'Clockify API key is required' });
        }

        // Auto-detect workspace if not provided
        let workspaceId = providedWorkspaceId;
        if (!workspaceId) {
            const wsRes = await fetch('https://api.clockify.me/api/v1/workspaces', {
                headers: { 'X-Api-Key': apiKey },
            });
            if (!wsRes.ok) {
                return NextResponse.json({ error: `Clockify API error: ${wsRes.status} — check your API key` });
            }
            const workspaces = await wsRes.json();
            if (workspaces.length === 0) {
                return NextResponse.json({ error: 'No workspaces found for this API key' });
            }
            workspaceId = workspaces[0].id;
        }

        // Get all users in the workspace
        const usersResponse = await fetch(
            `https://api.clockify.me/api/v1/workspaces/${workspaceId}/users`,
            {
                headers: { 'X-Api-Key': apiKey },
            }
        );

        if (!usersResponse.ok) {
            const err = await usersResponse.text();
            return NextResponse.json({ error: `Clockify API error: ${usersResponse.status} - ${err}` });
        }

        const users = await usersResponse.json();
        let allEntries: Record<string, unknown>[] = [];

        // Fetch time entries for each user, with optional project filter
        for (const user of users) {
            let url = `https://api.clockify.me/api/v1/workspaces/${workspaceId}/user/${user.id}/time-entries?start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z&page-size=1000`;

            if (projectId) {
                url += `&project=${projectId}`;
            }

            const entriesResponse = await fetch(url, {
                headers: { 'X-Api-Key': apiKey },
            });

            if (entriesResponse.ok) {
                const userEntries = await entriesResponse.json();
                allEntries = allEntries.concat(
                    userEntries.map((e: Record<string, unknown>) => ({ ...e, userName: user.name }))
                );
            }
        }

        // Build role mapping lookup
        const roleMappings: RoleMapping[] = resourceRoleMappings || [];
        const roleMap = new Map<string, string>();
        roleMappings.forEach((m: RoleMapping) => {
            roleMap.set(m.resourceName.toLowerCase(), m.role);
        });

        // Categorize based on tags or project info
        const categorizeEntry = (entry: Record<string, unknown>): string => {
            const tags = (entry.tags as { name: string }[]) || [];
            const tagNames = tags.map(t => t.name.toLowerCase());
            const desc = ((entry.description as string) || '').toLowerCase();

            if (tagNames.some(t => t.includes('qa') || t.includes('test'))) return 'QA';
            if (tagNames.some(t => t.includes('design') || t.includes('ux') || t.includes('ui'))) return 'Design';
            if (tagNames.some(t => t.includes('meeting') || t.includes('sync'))) return 'Meeting';
            if (tagNames.some(t => t.includes('content') || t.includes('writing'))) return 'Content';
            if (tagNames.some(t => t.includes('pm') || t.includes('management'))) return 'Management';

            if (desc.includes('qa') || desc.includes('test') || desc.includes('bug')) return 'QA';
            if (desc.includes('design') || desc.includes('ux') || desc.includes('ui ')) return 'Design';
            if (desc.includes('meeting') || desc.includes('sync') || desc.includes('standup')) return 'Meeting';
            if (desc.includes('content') || desc.includes('writing') || desc.includes('copy')) return 'Content';

            return 'Development';
        };

        // Collect unique resource names for mapping UI
        const uniqueResources = [...new Set(allEntries.map(e => e.userName as string))];

        // Map entries to our format
        const entries = allEntries.map((entry: Record<string, unknown>) => {
            const timeInterval = entry.timeInterval as Record<string, string>;
            const start = new Date(timeInterval.start);
            const end = new Date(timeInterval.end);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            const userName = entry.userName as string;
            const task = entry.task as Record<string, unknown> | null;

            // Apply role mapping — default to 'developer' if not mapped
            const assignedRole = roleMap.get(userName.toLowerCase()) || 'developer';

            return {
                id: entry.id as string,
                date: start.toISOString().split('T')[0],
                category: categorizeEntry(entry),
                taskName: task?.name as string || (entry.description as string) || 'Untitled Task',
                taskId: (entry.project as Record<string, unknown>)?.name as string || undefined,
                timeSpent: Math.round(hours * 100) / 100,
                description: (entry.description as string) || '',
                resource: userName,
                role: assignedRole,
                source: 'clockify' as const,
                isRefined: false,
            };
        });

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
