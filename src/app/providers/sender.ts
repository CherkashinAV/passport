import {Method, Response} from 'got';
import {config} from '../config';
import {httpClient} from '../lib/httpClient';
import {AsyncResult} from '../types';

const senderHttpClient = httpClient;

type SenderErrorCode = 
	'BAD_REQUEST' |
	'NOT_FOUND' |
	'INVALID_SECRET';


export class SenderError extends Error {
	code: SenderErrorCode;
	constructor(code: SenderErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

class SenderProvider {
	private _baseUrl: string;
	constructor() {
		this._baseUrl = config['sender.baseUrl'];
	}

	private async _request<T extends object>(args: {
		method: Method,
		path: string;
		query?: Record<string, string>,
		body?: Record<string, any>
	}): AsyncResult<T, SenderError> {
		let response: Response<T>;
		const url = new URL(args.path, this._baseUrl);
		try {
			response = await senderHttpClient<T>(url, {
				method: args.method,
				searchParams: args.query,
				json: args.body,
				responseType: 'json'
			});
		} catch (error) {
			throw new Error(`Unexpected sender error ${JSON.stringify(error)}`);
		}

		if (response.statusCode !== 200) {
			const body = response.body as any;
			return {
				ok: false,
				error: new SenderError(body.code, body.message)
			}
		}

		return {
			ok: true,
			value: response.body
		}
	}

	async send(payload: {
		srcData: {
			email: string;
			secretCode: string;
		},
		dstEmail: string;
		templateId: string;
		options: unknown;
	}): AsyncResult<null, SenderError> {
		const response = await this._request({
			method: 'POST',
			body: payload,
			path: 'send'
		});

		if (!response.ok) {
			return response;
		}

		return {
			ok: true,
			value: null
		}
	}
}

export const senderProvider = new SenderProvider();