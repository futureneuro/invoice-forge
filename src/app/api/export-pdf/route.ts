import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
    try {
        const { base64, fileName } = await request.json();

        if (!base64) {
            return NextResponse.json({ error: 'No PDF data provided' }, { status: 400 });
        }

        // Convert base64 back to binary
        const pdfBuffer = Buffer.from(base64, 'base64');

        // Write to a temp file in the public directory so it can be served as a static file
        const publicDir = join(process.cwd(), 'public', 'exports');
        if (!existsSync(publicDir)) {
            mkdirSync(publicDir, { recursive: true });
        }

        const safeFileName = (fileName || 'invoice.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = join(publicDir, safeFileName);
        writeFileSync(filePath, pdfBuffer);

        // Return the URL path to the file for the browser to download
        return NextResponse.json({
            url: `/exports/${safeFileName}`,
            size: pdfBuffer.length
        });
    } catch (error) {
        console.error('PDF export error:', error);
        return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 });
    }
}
