import {Request, Response} from 'express';
import asyncMiddleware from 'middleware-async';
import {ApiError} from './api-error';
import {formatZodError} from './validators';
import {z} from 'zod';
import {findUserByEmail, storeNewSecret} from '../../storage/users';
import {randomUUID} from 'crypto';
import {senderProvider} from '../../providers/sender';

const bodySchema = z.object({
    email: z.string().email(),
    linkToResetForm: z.string().url(),
    senderOptions: z.object({
        email: z.string().email(),
        emailSecret: z.string(),
        templateUid: z.string().uuid()
    })
});

export const passwordForgotHandler = asyncMiddleware(async (req: Request, res: Response) => {
    const validationResult = bodySchema.safeParse(req.body);

    if (!validationResult.success) {
        throw new ApiError('BAD_REQUEST', 400, formatZodError(validationResult.error));
    }

    const body = validationResult.data;
    const partition = (req.query.partition as string) ?? 'global';

    const user = await findUserByEmail(body.email, partition);

    if (!user) {
        throw new ApiError('NOT_FOUND', 404, 'PasswordForgot: No such users registered.');
    }

    const secretCode = randomUUID();

    const storeSecretResult = await storeNewSecret({
        userId: user.publicId,
        secret: secretCode
    });

    if (!storeSecretResult) {
        throw new Error('PasswordForgot: failed to store new secret');
    }

    const resetUrl = body.linkToResetForm + `/${user.publicId}` + `/${secretCode}`;

    await senderProvider.send({
        srcData: {
            email: body.senderOptions.email,
            secretCode: body.senderOptions.emailSecret
        },
        dstEmail: body.email,
        templateId: body.senderOptions.templateUid,
        options: {
            resetUrl
        }
    })

    res.status(200).json({
        status: 'OK'
    });
});
