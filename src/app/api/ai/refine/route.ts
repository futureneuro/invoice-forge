import { NextRequest } from 'next/server';

interface EntryRow {
    id: string;
    date: string;
    category: string;
    taskName: string;
    ticketKey?: string;
    ticketSummary?: string;
    timeSpent: number;
    description: string;
    resource: string;
    role: string;
}

interface Change {
    action: string;
    entryId?: string;
    updates?: Record<string, unknown>;
    entry?: Record<string, unknown>;
}

function buildSystemPrompt(entries: EntryRow[]): string {
    return `You are an AI assistant that refines time log entries for professional invoices.

CAPABILITIES:
1. Refine descriptions - make them professional, detailed, client-ready
2. Adjust hours - modify time spent on entries
3. Consolidate entries - merge duplicates
4. Categorize - properly categorize tasks
5. Add entries - create new time entries
6. Delete entries - remove entries
7. Analyze - provide insights about hour distribution

CRITICAL RULES FOR MAKING CHANGES:
- You MUST use the EXACT "id" field value from the entries below. IDs look like "abc123def" or similar. Do NOT make up IDs.
- Process ALL entries.
- Include a JSON code block at the END of your response with changes.
- The JSON block MUST follow this exact format:

\`\`\`json
{
  "changes": [
    { "action": "update", "entryId": "EXACT_ID_FROM_ENTRY", "updates": { "description": "new text", "timeSpent": 3.5 } },
    { "action": "add", "entry": { "date": "2025-01-15", "category": "Development", "taskName": "New Task", "timeSpent": 2.0, "description": "desc", "resource": "Name", "role": "developer", "source": "manual", "isRefined": true } },
    { "action": "delete", "entryId": "EXACT_ID_FROM_ENTRY" }
  ]
}
\`\`\`

- Only include entries you are actually changing. Do NOT re-send unchanged entries.
- If no changes needed, return an empty changes array: \`\`\`json\n{"changes":[]}\n\`\`\`
- Keep the natural language explanation BRIEF (1-2 sentences).
- ALWAYS include the JSON block, even if changes is empty.

HERE ARE ALL ${entries.length} TIME ENTRIES:
${JSON.stringify(entries, null, 1)}`;
}

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                const payload = JSON.stringify(data);
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
            };

            try {
                const { message, entries, apiKey, model } = await req.json();

                if (!apiKey) {
                    send('error', { error: 'No Anthropic API key configured. Go to Settings to add your API key.' });
                    controller.close();
                    return;
                }

                send('status', { step: 'preparing', detail: `Preparing ${entries.length} time entries for analysis...` });

                // Build compact entries for the AI with explicit IDs
                const entryRows: EntryRow[] = entries.map((e: Record<string, unknown>) => ({
                    id: e.id as string,
                    date: e.date as string,
                    category: e.category as string,
                    taskName: e.taskName as string,
                    ticketKey: (e.ticketKey as string) || undefined,
                    ticketSummary: (e.ticketSummary as string) || undefined,
                    timeSpent: e.timeSpent as number,
                    description: e.description as string,
                    resource: e.resource as string,
                    role: e.role as string,
                }));

                const selectedModel = model || 'claude-sonnet-4-20250514';
                const systemPrompt = buildSystemPrompt(entryRows);

                send('status', { step: 'calling_api', detail: `Sending all ${entryRows.length} entries to ${selectedModel}...` });

                // Single API call with all entries — AI gets full context
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        max_tokens: 16384,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: message }],
                    }),
                });

                if (!response.ok) {
                    const err = await response.text();
                    let errorDetail = `Anthropic API error (${response.status})`;
                    try {
                        const parsed = JSON.parse(err);
                        errorDetail = parsed.error?.message || errorDetail;
                    } catch {
                        errorDetail = err.slice(0, 500);
                    }
                    throw new Error(errorDetail);
                }

                const data = await response.json();
                const fullText = data.content?.map((c: { text: string }) => c.text).join('') || '';

                // Parse changes from the response
                const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
                const cleanMessage = fullText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                let changes: Change[] = [];

                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[1]);
                        changes = parsed.changes || [];
                    } catch (parseErr) {
                        console.error('[AI Refine] JSON parse error:', parseErr);
                    }
                }

                // Send the summary message
                send('message', { text: cleanMessage || 'Processing complete.' });

                // Stream all changes to the client
                if (changes.length > 0) {
                    send('status', { step: 'applying', detail: `Applying ${changes.length} changes to time log...` });

                    for (let i = 0; i < changes.length; i++) {
                        send('change', {
                            index: i,
                            total: changes.length,
                            ...changes[i],
                        });
                    }
                }

                send('done', { changesApplied: changes.length });
            } catch (error) {
                console.error('[AI Refine] Error:', error);
                send('error', { error: error instanceof Error ? error.message : 'Unknown error occurred' });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
