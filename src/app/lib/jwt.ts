import * as jwt from 'jsonwebtoken';
import {config} from '../config';

export class JWTManager {
	generateJWTToken(payload: {
		userId: string,
		expiresIn: number,
		role: string
	}) {
		return jwt.sign(payload, config['jwt.privateKey']);
	}

	verifyJWTToken(token: string) {
		return jwt.verify(token, config['jwt.privateKey'])
	}
}

export const jwtManager = new JWTManager();