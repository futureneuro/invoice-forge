import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { apiKey, workspaceId: providedWorkspaceId } = await req.json();

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

        const response = await fetch(
            `https://api.clockify.me/api/v1/workspaces/${workspaceId}/projects?page-size=200`,
            {
                headers: { 'X-Api-Key': apiKey },
            }
        );

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `Clockify API error: ${response.status} - ${err}` });
        }

        const projects = await response.json();

        return NextResponse.json({
            projects: projects.map((p: Record<string, unknown>) => ({
                id: p.id,
                name: p.name,
                clientName: (p.clientName as string) || '',
                color: p.color || '#03A9F4',
                archived: p.archived || false,
            })),
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
