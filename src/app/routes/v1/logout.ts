import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError} from './validators';
import {ApiError} from './api-error';
import {deleteSession, getUserRefreshSessions} from '../../storage/refreshSessions';

const bodySchema = z.object({
	userId: z.string().uuid(),
	fingerprint: z.string().uuid()
});

export const logoutHandler = asyncMiddleware(async (req: Request, res: Response) => {
	const validationResult = bodySchema.safeParse(req.body);

	if (!validationResult.success) {
		throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
	}

	const body = validationResult.data;

	const sessions = await getUserRefreshSessions(body.userId);

	if (!sessions || !sessions.find((session) => session.fingerprint === body.fingerprint)) {
		res.status(200).json({
			status: 'OK'
		});
		return;
	}

	await deleteSession(body);

	res.status(200).json({
		status: 'OK'
	});
});