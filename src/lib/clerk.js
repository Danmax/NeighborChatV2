const CLERK_PUBLISHABLE_KEY =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    'pk_test_c29jaWFsLWVzY2FyZ290LTAuY2xlcmsuYWNjb3VudHMuZGV2JA';

const CLERK_SCRIPT_SRC =
    'https://social-escargot-0.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

let clerkPromise = null;

export async function loadClerk() {
    if (typeof window === 'undefined') return null;
    if (window.Clerk) return window.Clerk;
    if (clerkPromise) return clerkPromise;

    clerkPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${CLERK_SCRIPT_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(window.Clerk));
            existing.addEventListener('error', () => reject(new Error('Failed to load Clerk')));
            return;
        }

        const script = document.createElement('script');
        script.src = CLERK_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
        script.onload = () => resolve(window.Clerk);
        script.onerror = () => reject(new Error('Failed to load Clerk'));
        document.head.appendChild(script);
    });

    return clerkPromise;
}

export async function getClerkUser() {
    const clerk = await loadClerk();
    if (!clerk) return null;
    await clerk.load();
    return clerk.user || null;
}

export async function getClerkSession() {
    const clerk = await loadClerk();
    if (!clerk) return null;
    await clerk.load();
    return clerk.session || null;
}

export async function getClerkToken() {
    const session = await getClerkSession();
    if (!session) return null;
    const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE;
    return session.getToken(template ? { template } : undefined);
}

export async function addClerkListener(callback) {
    const clerk = await loadClerk();
    if (!clerk) return () => {};
    await clerk.load();
    return clerk.addListener(callback);
}

export async function clerkSignOut() {
    const clerk = await loadClerk();
    if (!clerk) return;
    await clerk.load();
    return clerk.signOut();
}
