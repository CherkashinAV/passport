import asyncMiddleware from 'middleware-async';
import {ApiError} from './api-error';
import {formatZodError} from './validators';
import {Request, Response} from 'express';
import {z} from 'zod';
import {createNewRefreshSession, deleteSession, getRefreshSessionByRefreshToken} from '../../storage/refreshSessions';
import {randomUUID} from 'crypto';
import {config} from '../../config';
import {jwtManager} from '../../lib/jwt';
import {findUserByPublicId} from '../../storage/users';
import {logger} from '../../lib/logger';

const bodySchema = z.object({
    fingerprint: z.string()
});

export const refreshTokensHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;

    const refreshToken = req.cookies['refreshToken'];
    logger.error(refreshToken);

    const session = await getRefreshSessionByRefreshToken(refreshToken, body.fingerprint);

    if (!session) {
        throw new ApiError('NOT_FOUND', 404, 'RefreshTokens: No session to refresh.');
    }

    if (session.expiresIn < Date.now()) {
        deleteSession({userId: session.userId, fingerprint: body.fingerprint});
        throw new ApiError('TOKEN_EXPIRED', 403, 'RefreshTokens: refresh token expired.');
    }

    await deleteSession({userId: session.userId, fingerprint: body.fingerprint});

    const newRefreshToken = randomUUID();

    const creationResult = await createNewRefreshSession({
        userId: session.userId,
        fingerprint: body.fingerprint,
        refreshToken: newRefreshToken,
        userAgent: req.headers['user-agent'] ?? 'none'
    });

    if (!creationResult) {
        throw new Error('RefreshTokens: create refreshSession failure.');
    }

    const user = await findUserByPublicId(session.userId);

    if (!user) {
        throw new Error('RefreshTokens: user not found.');
    }

    const accessToken = jwtManager.generateJWTToken({
        expiresIn: Date.now() + config['accessToken.expiresIn'],
        role: user.role,
        userId: user.publicId
    });

    res.cookie('refreshToken', refreshToken, {maxAge: config['refreshSessions.Ttl'], path: '/v1/auth'});

    res.status(200).json({
        status: 'OK',
        data: {
            accessToken,
            refreshToken: newRefreshToken
        }
    });
});
