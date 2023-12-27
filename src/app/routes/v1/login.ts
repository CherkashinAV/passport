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
})

export const login = asyncMiddleware(async (req: Request, res: Response) => {
	const validationResult = bodySchema.safeParse(req.body);

	if (!validationResult.success) {
		throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
	}

	const body = validationResult.data;
	const partition = req.query.partition as string;
	const user = await findUserByEmail(body.email, partition);

	if (!user) {
		throw new ApiError('NOT_FOUND', 404, 'No such users registered.')
	}

	if (!hashManager.validate(user.password!, body.password)) {
		throw new ApiError('INVALID_PASSWORD', 401, 'Invalid password for current user');
	}

	const sessions = await getUserRefreshSessions(user.publicId);

	if (sessions?.length && sessions.length > config['refreshSessions.maxAmount']) {
		throw new ApiError('NEED_PASSWORD_RESET', 400, 'Sessions limit exceeded');
	}

	const refreshToken = randomUUID();

	const maxAge = await createNewRefreshSession({
		userId: user.publicId,
		fingerprint: '',
		userAgent: '',
		refreshToken
	});

	if (!maxAge) {
		throw new Error('Login: create refreshSession failure.')
	}

	const accessToken = jwtManager.generateJWTToken({
		expiresIn: Date.now() + config['accessToken.expiresIn'],
		role: user.role,
		userId: user.publicId
	});

	res.cookie('refreshToken', refreshToken, {maxAge, path: '/v1/validate_token'})

	res.status(200).json({
		accessToken,
		refreshToken
	})
});