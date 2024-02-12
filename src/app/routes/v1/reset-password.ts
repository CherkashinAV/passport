import asyncMiddleware from 'middleware-async';
import {ApiError} from './api-error';
import {formatZodError, passwordValidator} from './validators';
import {Request, Response} from 'express';
import {z} from 'zod';
import {findUserByEmail, findUserByPublicId, updatePassword} from '../../storage/users';
import {hashManager} from '../../lib/hash';

const bodySchema = z.object({
    userId: z.string().uuid(),
    secretCode: z.string().uuid(),
    password: passwordValidator
});

export const resetPasswordHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;

    const user = await findUserByPublicId(body.userId);

    if (!user) {
        throw new ApiError('NOT_FOUND', 404, 'ResetPassword: No such users registered.');
    }

    if (!user.secretActive) {
        throw new Error('ResetPassword: secret not active in reset password stage.');
    }

    if (!(user.secretCode === body.secretCode)) {
        throw new ApiError('INVALID_SECRET', 401, 'ResetPassword: Invalid secret code for reset password');
    }

    const passwordHash = await hashManager.encode(body.password);

    const updatePasswordResult = await updatePassword({
        userId: user.publicId,
        passwordHash
    });

    if (!updatePasswordResult) {
        throw new Error('ResetPassword: failed to update password in db');
    }

    res.status(200).json({
        status: 'OK'
    });
});
