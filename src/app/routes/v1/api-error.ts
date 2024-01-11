export type ApiErrorCode =
    | 'BAD_REQUEST'
    | 'NO_INVITATION_FOR_USER'
    | 'ALREADY_EXISTS'
    | 'INVALID_SECRET'
    | 'NOT_FOUND'
    | 'INVALID_PASSWORD'
    | 'NEED_PASSWORD_RESET'
    | 'INVALID_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'NOT_ENOUGH_RIGHTS';

export class ApiError extends Error {
    code: ApiErrorCode;
    status: number;

    constructor(code: ApiErrorCode, status: number, message: string = '') {
        super(message);
        this.code = code;
        this.status = status;
    }
}
