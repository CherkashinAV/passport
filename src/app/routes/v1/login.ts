import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError, passwordValidator} from './validators';
import {ApiError} from './api-error';
import {findUserByEmail} from '../../storage/users';
import {hashManager} from '../../lib/hash';
import {createNewRefreshSession, getUserRefreshSessions} from '../../storage/refreshSessions';
import {config} from '../../config';
import {randomUUID} from 'crypto';
import {jwtManager} from '../../lib/jwt';

const bodySchema = z.object({
    email: z.string().email(),
    password: passwordValidator,
    fingerprint: z.string().uuid()
});

export const loginHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;
    const partition = (req.query.partition as string) ?? 'global';
    const user = await findUserByEmail(body.email, partition);

    if (!user) {
        throw new ApiError('NOT_FOUND', 404, 'Login: No such users registered.');
    }

    if (!(await hashManager.validate(user.password!, body.password))) {
        throw new ApiError('INVALID_PASSWORD', 401, 'Login: Invalid password for current user.');
    }

    const sessions = await getUserRefreshSessions(user.publicId);

    if (sessions) {
        if (sessions.length >= config['refreshSessions.maxAmount']) {
            throw new ApiError('NEED_PASSWORD_RESET', 400, 'Login: Sessions limit exceeded.');
        }

        if (sessions.find((session) => session.fingerprint === body.fingerprint)) {
            throw new ApiError('ALREADY_EXISTS', 409, 'Login: Session already exists.');
        }
    }

    const refreshToken = randomUUID();

    const creationResult = await createNewRefreshSession({
        userId: user.publicId,
        fingerprint: body.fingerprint,
        userAgent: req.headers['user-agent'] ?? 'none',
        refreshToken
    });

    if (!creationResult) {
        throw new Error('Login: create refreshSession failure.');
    }

    const accessToken = jwtManager.generateJWTToken({
        expiresIn: Date.now() + config['accessToken.expiresIn'],
        role: user.role,
        userId: user.publicId
    });

    res.cookie('refreshToken', refreshToken, {maxAge: config['refreshSessions.Ttl'], path: '/v1/auth'});

    res.status(200).json({
        accessToken,
        refreshToken
    });
});
