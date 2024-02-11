import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError} from './validators';
import {ApiError} from './api-error';
import {deleteSession, getUserRefreshSessions} from '../../storage/refreshSessions';
import {jwtManager} from '../../lib/jwt';

const bodySchema = z.object({
    accessToken: z.string(),
    fingerprint: z.string()
});

export const logoutHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;

    const verifyTokenResult = jwtManager.verifyJWTToken(body.accessToken);

    if (!verifyTokenResult.ok) {
        throw new ApiError('INVALID_TOKEN', 401, 'Auth: Token is not valid.');
    }

    const tokenData = verifyTokenResult.payload!;

    if (tokenData.expiresIn <= Date.now()) {
        throw new ApiError('TOKEN_EXPIRED', 403, 'Auth: access token expired.');
    }

    const sessions = await getUserRefreshSessions(tokenData.userId);

    if (!sessions || !sessions.find((session) => session.fingerprint === body.fingerprint)) {
        res.status(200).json({
            status: 'OK'
        });
        return;
    }

    await deleteSession({userId: tokenData.userId, fingerprint: body.fingerprint});

    res.status(200).json({
        status: 'OK'
    });
});
