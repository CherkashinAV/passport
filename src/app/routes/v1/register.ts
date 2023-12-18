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
	name: nameValidator,
	surname: nameValidator,
	invitationCode: z.string().uuid().optional(),
})

export const register = asyncMiddleware(async (req: Request, res: Response) => {
	const validationResult = bodySchema.safeParse(req.body);

	if (!validationResult.success) {
		throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
	}

	const body = validationResult.data;
	const partition = req.params.partition;
	const user = await findUserByEmail(body.email);
	const passwordHash = await hashManager.encode(body.password);
	if (body.invitationCode) {
		if (!user) {
			throw new ApiError('NO_INVITATION_FOR_USER', 400, `No invitation for current user`);
		}

		if (user.password) {
			console.log(user.password)
			throw new ApiError('ALREADY_EXISTS', 409, `User already registered`);
		}

		if (!user.secretActive) {
			throw new Error(`Registration: secret not active in with invitation stage.`);
		}

		if (user.secretCode !== body.invitationCode) {
			throw new ApiError('INVALID_SECRET', 401, `Invalid secret code for invitation`);
		}

		const updateResultOk = await updateUserWithInvitation(passwordHash, user.id);

		if (!updateResultOk) {
			throw new Error('Registration: update table failure.')
		}

		res.status(200).json({status: 'OK'});
		return;
	}

	if (user) {
		throw new ApiError('ALREADY_EXISTS', 409, `User already registered`);
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