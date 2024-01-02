import {Request, Response} from 'express';
import z from 'zod';
import {formatZodError, nameValidator, passwordValidator} from './validators';
import {ApiError} from './api-error';
import {createNewUserRecord, findUserByEmail, findUserByPublicId, updateUserWithInvitation} from '../../storage/users';
import {hashManager} from '../../lib/hash';
import asyncMiddleware from 'middleware-async';

const bodySchema = z.object({
	email: z.string().email(),
	password: passwordValidator,
	name: nameValidator.optional(),
	surname: nameValidator.optional(),
	invitationCode: z.string().uuid().optional(),
})

export const registerHandler = asyncMiddleware(async (req: Request, res: Response) => {
	const validationResult = bodySchema.safeParse(req.body);

	if (!validationResult.success) {
		throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
	}

	const body = validationResult.data;
	const partition = req.query.partition as string ?? 'global';
	const user = await findUserByEmail(body.email, partition);
	const passwordHash = await hashManager.encode(body.password);
	if (body.invitationCode) {
		if (!user) {
			throw new ApiError('NO_INVITATION_FOR_USER', 400, 'Registration: No invitation for current user');
		}

		if (user.password) {
			throw new ApiError('ALREADY_EXISTS', 409, 'Registration: User already registered');
		}

		if (!user.secretActive) {
			throw new Error('Registration: secret not active in with invitation stage.');
		}

		if (user.secretCode !== body.invitationCode) {
			throw new ApiError('INVALID_SECRET', 401, 'Registration: Invalid secret code for invitation');
		}

		const updateResultOk = await updateUserWithInvitation(passwordHash, user.id);

		if (!updateResultOk) {
			throw new Error('Registration: update table failure.')
		}

		res.status(200).json({status: 'OK'});
		return;
	}

	if (user) {
		throw new ApiError('ALREADY_EXISTS', 409, 'Registration: User already registered');
	}

	if (!body.name || !body.surname) {
		throw new ApiError('BAD_REQUEST', 400, 'Registration: Name or surname is missing');
	}

	const createResultOk = await createNewUserRecord({
		name: body.name,
		surname: body.surname,
		email: body.email,
		passwordHash: passwordHash,
		partition: partition
	})

	if (!createResultOk) {
		throw new Error('Registration: update table failure.')
	}

	res.status(200).json({status: 'OK'});
});