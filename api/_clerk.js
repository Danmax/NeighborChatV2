import { verifyToken } from '@clerk/backend';

export async function requireClerkUser(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return { error: 'Missing auth token', status: 401 };
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    const jwtKey = process.env.CLERK_JWT_KEY;
    if (!secretKey && !jwtKey) {
        return { error: 'Server misconfigured', status: 500 };
    }

    const rawParties = process.env.CLERK_AUTHORIZED_PARTIES;
    const authorizedParties = rawParties
        ? rawParties.split(',').map(value => value.trim()).filter(Boolean)
        : undefined;

    try {
        const payload = await verifyToken(token, {
            secretKey,
            jwtKey,
            authorizedParties
        });

        if (!payload?.sub) {
            return { error: 'Invalid auth token', status: 401 };
        }

        return { userId: payload.sub, token };
    } catch (error) {
        return { error: 'Invalid auth token', status: 401 };
    }
}
