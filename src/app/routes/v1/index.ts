import {NextFunction, Request, Response, Router} from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import {ApiError} from './api-error';
import {logger} from '../../lib/logger';
import {registerHandler} from './register';
import {loginHandler} from './login';
import {authHandler} from './auth';
import {logoutHandler} from './logout';
import {refreshTokensHandler} from './refresh-tokens';
import {registrationInviteHandler} from './registration-invite';
import {passwordForgotHandler} from './password-forgot';
import {resetPasswordHandler} from './reset-password';

export const v1Router: Router = Router()
	.use(bodyParser.json())
	.post('/register', registerHandler)
	.post('/login', loginHandler)
	.post('/logout', logoutHandler)
	.post('/auth', authHandler)
	.post('/registration_invite', registrationInviteHandler)
	.post('/password_forgot', passwordForgotHandler)
	.post('/reset_password', resetPasswordHandler)
	.use(cookieParser())
	.post('/refresh_tokens', refreshTokensHandler)
	.use((error: Error, req: Request, res: Response, next: NextFunction) => {
		if (error instanceof ApiError) {
			const errorBody = {
				code: error.code,
				message: error.message
			}

			logger.error(error.message);
			res.status(error.status).json(errorBody);
		} else {
			next(error);
		}
	});
