import {Request, Response} from 'express';
import z from 'zod';
import {formatZodError, nameValidator, passwordValidator} from './validators';
import {ApiError} from './api-error';
import {createNewUserRecord, findUserByPublicId, updateUserWithInvitation} from '../../storage/users';
import {hashManager} from '../../lib/hash';

const bodySchema = z.object({
	email: z.string().email(),
	password: passwordValidator,
	name: nameValidator,
	surname: nameValidator,
	invitation: z.object({
		invitationCode: z.string().uuid(),
		publicId: z.string().uuid()
	}).optional()
})

export async function register(req: Request, res: Response) {
	const validationResult = bodySchema.safeParse(req.body);

	if (!validationResult.success) {
		throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
	}

	const body = validationResult.data;
	const partition = req.params.partition;

	const passwordHash = await hashManager.encode(body.password);

	if (body.invitation) {
		const user = await findUserByPublicId(body.invitation.publicId);

		if (!user) {
			throw new ApiError('NO_INVITATION_FOR_USER', 400, `No invitation for current user`);
		}

		if (user.password) {
			throw new ApiError('ALREADY_REGISTERED', 401, `User already registered`);
		}

		if (!user.secretActive) {
			throw new Error(`Registration: secret not active in with invitation stage. User ${body.invitation.publicId}`);
		}

		if (user.secretCode !== body.invitation.invitationCode) {
			throw new ApiError('INVALID_SECRET', 401, `Invalid secret code for invitation`);
		}

		const updateResultOk = await updateUserWithInvitation(passwordHash, user.id);

		if (!updateResultOk) {
			throw new Error('Registration: update table failure.')
		}

		res.status(200);
		return;
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

	res.status(200);
}