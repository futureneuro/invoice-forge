import { NextRequest } from 'next/server';

interface EntryRow {
    id: string;
    date: string;
    category: string;
    taskName: string;
    taskId?: string;
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

const BATCH_SIZE = 50; // Process entries in batches to stay within token limits

function buildSystemPrompt(entries: EntryRow[], batchIndex: number, totalBatches: number): string {
    return `You are an AI assistant that refines time log entries for professional invoices.
${totalBatches > 1 ? `\nThis is batch ${batchIndex + 1} of ${totalBatches}. Process ONLY the entries provided below.\n` : ''}
CAPABILITIES:
1. Refine descriptions - make them professional, detailed, client-ready
2. Adjust hours - modify time spent on entries
3. Consolidate entries - merge duplicates
4. Categorize - properly categorize tasks
5. Add entries - create new time entries
6. Delete entries - remove entries
7. Analyze - provide insights about hour distribution

IMPORTANT — TICKET CONTEXT:
Each entry may include these fields from Jira:
- "ticketKey": The Jira ticket ID (e.g. "PROJ-123")
- "ticketSummary": The Jira issue title/summary (e.g. "Implement user authentication flow")
- "description": May already contain "[PROJ-123] Issue summary — worklog notes"

USE THIS CONTEXT to write rich, professional descriptions. For example:
- BAD: "Worked on PROJ-123"
- GOOD: "Implemented user authentication flow (PROJ-123) — developed OAuth2 integration with session management and secure token refresh logic"

Always reference the ticket key in descriptions. Use the ticketSummary to understand WHAT was worked on and write a description that conveys the actual deliverable to a client. If the ticketSummary gives clear context, expand on it meaningfully. Do NOT just repeat the summary verbatim — add professional detail about what the work entailed.

CRITICAL RULES FOR MAKING CHANGES:
- You MUST use the EXACT "id" field value from the entries below. IDs look like "abc123def" or similar. Do NOT make up IDs.
- Process ALL entries in this batch.
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
- Keep the natural language explanation VERY BRIEF (1 sentence max).
- ALWAYS include the JSON block, even if changes is empty.

HERE ARE ${entries.length} TIME ENTRIES TO PROCESS:
${JSON.stringify(entries, null, 1)}`;
}

async function callAnthropicStreaming(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userMessage: string,
    send: (event: string, data: unknown) => void,
): Promise<{ fullText: string; changes: Change[] }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 16384,
            stream: true,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
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

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Anthropic');

    const decoder = new TextDecoder();
    let anthropicBuffer = '';
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        anthropicBuffer += decoder.decode(value, { stream: true });
        const lines = anthropicBuffer.split('\n');
        anthropicBuffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
                const event = JSON.parse(dataStr);
                if (event.type === 'content_block_delta' && event.delta?.text) {
                    fullText += event.delta.text;
                    // Send token events to keep connection alive
                    send('token', { text: event.delta.text });
                }
            } catch {
                // Skip unparseable lines
            }
        }
    }

    // Parse changes from the complete response
    console.log(`[AI Refine] Full text length: ${fullText.length}`);
    console.log(`[AI Refine] Response preview: ${fullText.slice(0, 300)}`);
    console.log(`[AI Refine] Response tail: ${fullText.slice(-300)}`);

    // Try multiple JSON extraction patterns
    let jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
        jsonMatch = fullText.match(/```\s*([\s\S]*?\{[\s\S]*?"changes"[\s\S]*?\})\s*```/);
    }
    if (!jsonMatch) {
        jsonMatch = fullText.match(/(\{[\s\S]*?"changes"\s*:\s*\[[\s\S]*?\]\s*\})/);
    }

    let changes: Change[] = [];

    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            changes = parsed.changes || [];
            console.log(`[AI Refine] Parsed ${changes.length} changes`);
        } catch (parseErr) {
            console.error('[AI Refine] JSON parse error:', parseErr);
            console.error('[AI Refine] Raw JSON string:', jsonMatch[1]?.slice(0, 500));
            send('message', { text: `⚠️ AI response couldn't be parsed (${fullText.length} chars received). Retrying may help.` });
        }
    } else {
        console.log('[AI Refine] No JSON block found in response');
        // Check if response was truncated (no closing ```)
        if (fullText.includes('"changes"') && !fullText.includes('```', fullText.lastIndexOf('"changes"'))) {
            send('message', { text: `⚠️ AI response was truncated (${fullText.length} chars). The batch may be too large.` });
        }
    }

    return { fullText, changes };
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
                const { message, entries, apiKey, model, skipBatching } = await req.json();

                if (!apiKey) {
                    send('error', { error: 'No Anthropic API key configured. Go to Settings to add your API key.' });
                    controller.close();
                    return;
                }

                send('status', { step: 'preparing', detail: `Preparing ${entries.length} time entries for analysis...` });

                // Build compact entries for the AI with explicit IDs and full ticket context
                const entryRows: EntryRow[] = entries.map((e: Record<string, unknown>) => ({
                    id: e.id as string,
                    date: e.date as string,
                    category: e.category as string,
                    taskName: e.taskName as string,
                    taskId: (e.taskId as string) || undefined,
                    ticketKey: (e.ticketKey as string) || undefined,
                    ticketSummary: (e.ticketSummary as string) || undefined,
                    timeSpent: e.timeSpent as number,
                    description: e.description as string,
                    resource: e.resource as string,
                    role: e.role as string,
                }));

                const selectedModel = model || 'claude-sonnet-4-20250514';
                
                // Skip batching if explicitly requested (single role selected)
                // or if entries fit in a single batch
                const shouldBatch = !skipBatching && entryRows.length > BATCH_SIZE;
                const batches: EntryRow[][] = [];
                
                if (shouldBatch) {
                    for (let i = 0; i < entryRows.length; i += BATCH_SIZE) {
                        batches.push(entryRows.slice(i, i + BATCH_SIZE));
                    }
                } else {
                    batches.push(entryRows);
                }

                const allChanges: Change[] = [];
                const allMessages: string[] = [];

                if (batches.length === 1) {
                    // Single batch — process normally
                    send('status', { step: 'calling_api', detail: `Sending ${entryRows.length} entries to ${selectedModel}...` });
                    const systemPrompt = buildSystemPrompt(entryRows, 0, 1);
                    
                    send('status', { step: 'streaming', detail: 'Receiving AI response...' });
                    const result = await callAnthropicStreaming(apiKey, selectedModel, systemPrompt, message, send);
                    
                    allChanges.push(...result.changes);
                    const cleanMsg = result.fullText
                        .replace(/```json\s*[\s\S]*?\s*```/g, '')
                        .replace(/```\s*\{[\s\S]*?"changes"[\s\S]*?\}\s*```/g, '')
                        .trim();
                    if (cleanMsg) allMessages.push(cleanMsg);
                } else {
                    // Multiple batches
                    send('status', { step: 'batching', detail: `Processing ${entryRows.length} entries in ${batches.length} batches of ~${BATCH_SIZE}...` });

                    for (let b = 0; b < batches.length; b++) {
                        const batch = batches[b];
                        send('status', { 
                            step: 'calling_api', 
                            detail: `Batch ${b + 1}/${batches.length}: Processing entries ${b * BATCH_SIZE + 1}-${b * BATCH_SIZE + batch.length}...` 
                        });

                        const systemPrompt = buildSystemPrompt(batch, b, batches.length);
                        const result = await callAnthropicStreaming(apiKey, selectedModel, systemPrompt, message, send);
                        
                        allChanges.push(...result.changes);
                        
                        send('status', { 
                            step: 'batch_done', 
                            detail: `Batch ${b + 1}/${batches.length} complete: ${result.changes.length} changes found.` 
                        });
                    }

                    allMessages.push(`Processed ${entryRows.length} entries in ${batches.length} batches.`);
                }

                // Send the summary message
                send('message', { text: allMessages.join('\n\n') || 'Processing complete.' });

                // Stream all changes to the client
                if (allChanges.length > 0) {
                    send('status', { step: 'applying', detail: `Applying ${allChanges.length} changes to time log...` });

                    for (let i = 0; i < allChanges.length; i++) {
                        send('change', {
                            index: i,
                            total: allChanges.length,
                            ...allChanges[i],
                        });
                    }
                }

                send('done', { changesApplied: allChanges.length });
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
