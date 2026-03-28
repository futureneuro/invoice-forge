import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { jiraBaseUrl, apiToken, jiraEmail, jiraApiToken } = await req.json();

        if (!jiraBaseUrl) {
            return NextResponse.json({ error: 'Jira base URL is required' });
        }

        const cleanBaseUrl = jiraBaseUrl.replace(/\/$/, '');

        // Try Jira Cloud REST API for projects using Basic Auth (email:apiToken)
        if (jiraEmail && jiraApiToken) {
            const authHeader = 'Basic ' + Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

            const jiraResponse = await fetch(`${cleanBaseUrl}/rest/api/3/project/search?maxResults=100`, {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
            });

            if (jiraResponse.ok) {
                const data = await jiraResponse.json();
                const projects = (data.values || []).map((p: Record<string, unknown>) => ({
                    id: String(p.id),
                    key: p.key as string,
                    name: p.name as string,
                }));
                return NextResponse.json({ projects, source: 'jira' });
            }
        }

        // Fallback: try with Tempo Bearer token
        if (apiToken) {
            const jiraResponse = await fetch(`${cleanBaseUrl}/rest/api/3/project/search?maxResults=100`, {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                },
            });

            if (jiraResponse.ok) {
                const data = await jiraResponse.json();
                const projects = (data.values || []).map((p: Record<string, unknown>) => ({
                    id: String(p.id),
                    key: p.key as string,
                    name: p.name as string,
                }));
                return NextResponse.json({ projects, source: 'jira' });
            }

            // Try Tempo's own accounts API as last resort
            const tempoResponse = await fetch('https://api.tempo.io/4/accounts', {
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Accept': 'application/json',
                },
            });

            if (tempoResponse.ok) {
                const data = await tempoResponse.json();
                const accounts = (data.results || []).map((a: Record<string, unknown>) => ({
                    id: String(a.id),
                    key: a.key as string,
                    name: a.name as string,
                }));
                return NextResponse.json({ projects: accounts, source: 'tempo_accounts' });
            }
        }

        return NextResponse.json({ projects: [], source: 'none' });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
