import {z} from 'zod';
import {formatZodError, nameValidator, surnameValidator} from './validators';
import asyncMiddleware from 'middleware-async';
import {ApiError} from './api-error';
import {Request, Response} from 'express';
import {jwtManager} from '../../lib/jwt';
import {findUserByEmail, findUserByPublicId, insertInvitation} from '../../storage/users';
import {senderProvider} from '../../providers/sender';

const bodySchema = z.object({
    email: z.string().email(),
    name: nameValidator,
    surname: surnameValidator,
    patronymic: z.string(),
    role: z.string().default('default'),
    linkToRegisterForm: z.string().url(),
    accessToken: z.string(),
    organizationName: z.string(),
    senderOptions: z.object({
        email: z.string().email(),
        emailSecret: z.string(),
        templateUid: z.string().uuid()
    })
});

export const registrationInviteHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;

    //TODO: hide into token_verify middleware
    const verifyTokenResult = jwtManager.verifyJWTToken(body.accessToken);

    if (!verifyTokenResult.ok) {
        throw new ApiError('INVALID_TOKEN', 401, 'RegistrationInvite: Token is not valid.');
    }

    const tokenData = verifyTokenResult.payload!;

    if (tokenData.expiresIn <= Date.now()) {
        throw new ApiError('TOKEN_EXPIRED', 403, 'RegistrationInvite: access token expired.');
    }

    if (tokenData.role !== 'moderator') {
        throw new ApiError(
            'NOT_ENOUGH_RIGHTS',
            401,
            'RegistrationInvite: User has not enough rights to create invitations'
        );
    }

    const moderatorUser = await findUserByPublicId(tokenData.userId);

    if (!moderatorUser) {
        throw new ApiError('NOT_FOUND', 404, 'RegistrationInvite: No such moderator users');
    }

    const user = await findUserByEmail(body.email, moderatorUser.partition);

    if (user) {
        throw new ApiError('ALREADY_EXISTS', 409, 'RegistrationInvite: User already exists.');
    }

    if (body.role === 'moderator') {
        throw new ApiError(
            'NOT_ENOUGH_RIGHTS',
            401,
            'RegistrationInvite: User has not enough rights to create invitation with role `moderator`'
        );
    }

    const data = await insertInvitation({
        email: body.email,
        name: body.name,
        surname: body.surname,
        patronymic: body.patronymic,
        partition: moderatorUser.partition,
        role: body.role ?? 'default'
    });

    if (!data) {
        throw new Error('RegistrationInvite: Invitation creation failed');
    }

    const inviteUrl = body.linkToRegisterForm + `/${data.secret}`;

    await senderProvider.send({
        srcData: {
            email: body.senderOptions.email,
            secretCode: body.senderOptions.emailSecret
        },
        dstEmail: body.email,
        templateId: body.senderOptions.templateUid,
        options: {
            organizationName: body.organizationName,
            registerLink: inviteUrl
        }
    })

    res.status(200).json({
        uid: data.publicId
    });
});
