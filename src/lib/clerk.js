const CLERK_PUBLISHABLE_KEY =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    'pk_test_c29jaWFsLWVzY2FyZ290LTAuY2xlcmsuYWNjb3VudHMuZGV2JA';

const CLERK_SCRIPT_SRC =
    'https://social-escargot-0.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

let clerkPromise = null;

function loadClerkScript() {
    return new Promise((resolve, reject) => {
        // If Clerk is already on window, we're done
        if (window.Clerk) {
            resolve(window.Clerk);
            return;
        }

        // Remove any previously failed script tags
        const existing = document.querySelector(`script[src="${CLERK_SCRIPT_SRC}"]`);
        if (existing) {
            existing.remove();
        }

        const script = document.createElement('script');
        script.src = CLERK_SCRIPT_SRC;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
        script.onload = () => resolve(window.Clerk);
        script.onerror = () => reject(new Error('Failed to load Clerk'));
        document.head.appendChild(script);
    });
}

export async function loadClerk() {
    if (typeof window === 'undefined') return null;
    if (window.Clerk) return window.Clerk;
    if (clerkPromise) return clerkPromise;

    clerkPromise = (async () => {
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                    console.warn(`Clerk load retry ${attempt}/${MAX_RETRIES}`);
                }
                return await loadClerkScript();
            } catch (err) {
                lastError = err;
            }
        }
        // All retries exhausted — clear the cached promise so a future call can retry
        clerkPromise = null;
        throw lastError;
    })();

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
