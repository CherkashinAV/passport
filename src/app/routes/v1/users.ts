import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError} from './validators';
import {ApiError} from './api-error';
import {findUserByPublicId, findUsersByRole} from '../../storage/users';

const querySchema = z.object({
    partition: z.string(),
	role: z.string()
});

export const usersHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = querySchema.safeParse(req.query);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const query = validationResult.data;

    const users = await findUsersByRole(query.role, query.partition);

    res.status(200).json({
        status: 'OK',
        data: users
    });
});
