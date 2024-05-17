export interface User {
    id: number;
    publicId: string;
    role: string;
    name: string;
    surname: string;
    patronymic: string;
    email: string;
    password?: string;
    secretCode: string;
    secretActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    partition: string;
}

export interface RefreshSession {
    id: number;
    userId: string;
    refreshToken: string;
    userAgent?: string;
    fingerprint: string;
    expiresIn: number;
    createdAt: Date;
}

type OkResult<T = null> = {
	ok: true,
	value: T
};

type ErrorResult<T = string> = {
	ok: false,
	error: T
};

export type Result<T, E> = OkResult<T> | ErrorResult<E>;
export type AsyncResult<T, E> = Promise<Result<T, E>>;
