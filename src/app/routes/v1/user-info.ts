import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError} from './validators';
import {ApiError} from './api-error';
import {findUserByPublicId} from '../../storage/users';

const querySchema = z.object({
    userId: z.string().uuid()
});

export const userInfoHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = querySchema.safeParse(req.query);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const query = validationResult.data;

    const user = await findUserByPublicId(query.userId);

    if (!user) {
        throw new ApiError('NOT_FOUND', 404, 'UserInfo: user not found.')
    }

    res.status(200).json({
        status: 'OK',
        data: {
            name: user.name,
            surname: user.surname,
            patronymic: user.patronymic,
            email: user.email,
            role: user.role,
            uid: user.publicId,
        }
    });
});
