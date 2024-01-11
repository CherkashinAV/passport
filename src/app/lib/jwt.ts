import * as jwt from 'jsonwebtoken';
import {config} from '../config';

interface JwtPayload {
    userId: string;
    expiresIn: number;
    role: string;
    iat: number;
}

export class JWTManager {
    generateJWTToken(payload: Omit<JwtPayload, 'iat'>) {
        return jwt.sign(payload, config['jwt.privateKey']);
    }

    verifyJWTToken(token: string) {
        try {
            const payload = jwt.verify(token, config['jwt.privateKey']) as JwtPayload;
            return {
                ok: true,
                payload
            };
        } catch (error) {
            return {
                ok: false,
                error
            };
        }
    }
}

export const jwtManager = new JWTManager();
