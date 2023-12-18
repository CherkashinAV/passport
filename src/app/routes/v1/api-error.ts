export type ApiErrorCode = |
	'BAD_REQUEST' |
	'NO_INVITATION_FOR_USER' |
	'ALREADY_EXISTS' |
	'INVALID_SECRET';

export class ApiError extends Error {
	code: ApiErrorCode;
	status: number;

	constructor(code: ApiErrorCode, status: number, message: string = '') {
		super(message);
		this.code = code;
		this.status = status;
	}
}