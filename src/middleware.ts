import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Allow access to login page, auth callback, and API routes
    const isLoginPage = request.nextUrl.pathname === '/login';
    const isTransferPage = request.nextUrl.pathname === '/transfer';
    const isAuthCallback = request.nextUrl.pathname.startsWith('/auth');
    const isApiRoute = request.nextUrl.pathname.startsWith('/api');
    const isStaticAsset = request.nextUrl.pathname.startsWith('/exports');

    if (isLoginPage || isTransferPage || isAuthCallback || isApiRoute || isStaticAsset) {
        // If user is logged in and tries to access login page, redirect to home
        if (user && isLoginPage) {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect(url);
        }
        return supabaseResponse;
    }

    // Redirect unauthenticated users to login
    if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
