import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {z} from 'zod';
import {formatZodError} from './validators';
import {ApiError} from './api-error';
import {jwtManager} from '../../lib/jwt';
import {findUserByPublicId} from '../../storage/users';

const bodySchema = z.object({
    accessToken: z.string()
});

export const userInfoHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;

    const verifyTokenResult = jwtManager.verifyJWTToken(body.accessToken);

    if (!verifyTokenResult.ok) {
        throw new ApiError('INVALID_TOKEN', 401, 'UserInfo: Token is not valid.');
    }

    const tokenData = verifyTokenResult.payload!;

    if (tokenData.expiresIn <= Date.now()) {
        throw new ApiError('TOKEN_EXPIRED', 403, 'UserInfo: access token expired.');
    }

    const user = await findUserByPublicId(tokenData.userId);

    if (!user) {
        throw new ApiError('NOT_FOUND', 404, 'UserInfo: user not found.')
    }

    res.status(200).json({
        status: 'OK',
        data: {
            name: user.name,
            surname: user.surname,
            email: user.email,
            role: user.role,
            uid: user.publicId,
        }
    });
});
