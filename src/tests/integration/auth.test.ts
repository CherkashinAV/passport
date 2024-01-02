import http from 'http';
import sinon from 'sinon';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {clear_db, registerUser} from '../db-utils';
import assert from 'assert';
import {createNewRefreshSession} from '../../app/storage/refreshSessions';

describe('/v1/auth', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender
	let clock: sinon.SinonFakeTimers;
	const now = new Date('2023-12-17T15:00:00');

	const defaultBody = {
		accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDI4MTQ0MDM2MDAsInJvbGUiOiJkZWZhdWx0IiwidXNlcklkIjoiYWFhYWFhYWEtZjYyNS00MWNhLWEzNTMtMDY4ZDZlZDcwZmM1IiwiaWF0IjoxNzAyODE0NDAwfQ.7FyCY_-21Bt92qwkOukT2R4yPupuIxAluAs8-okaHSY',
		fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5'
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/auth`), 'json');
		clock = sinon.useFakeTimers({now, toFake: ['Date']});
	});

	after(async () => {
		await stopServer(server);
		clock.restore();
	});

	beforeEach(async () => {
		await clear_db();
	});

	describe('check schema', () => {
		it('should throw 400 if fingerprint was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				fingerprint: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if fingerprint is not correct uuid', async () => {
			const res = await httpClient.post({
				...defaultBody,
				fingerprint: 'aaa'
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'fingerprint:Invalid uuid')
		});

		it('should throw 400 if access token is not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				accessToken: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});
	});

	describe('with sessions in db', () => {
		beforeEach(async () => {
			const registerResult = await registerUser({
				email: 'a@yandex.ru',
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5'
			});

			assert.strictEqual(registerResult, true);

			const sessionResult = await createNewRefreshSession({
				fingerprint: defaultBody.fingerprint,
				refreshToken: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5',
				userId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
				userAgent: 'Mozilla'
			});

			assert.strictEqual(sessionResult, true);
		});

		it('should respond with 200 if all is ok', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 200);
			assert.deepStrictEqual(res.body, {
				status: 'OK',
				data: {
					expiresIn: 1702814403600, //milliseconds
					role: 'default',
					iat: 1702814400, //seconds
					userId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5'
				}
			});
		});

		it('should respond 401 when token is invalid', async () => {
			const res = await httpClient.post({
				...defaultBody,
				accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDI4MTQ0MDM2MDAsInJvbGUiOiJkZWZhdWx0IiwidXNlcklkIjoiYWFhYWFhYWEtZjYyNS00MWNhLWEzNTMtMDY4ZDZlZDcwZmM1IiciaWF0IjoxNzAyODE0NDAwfQ.7FyCY_-21Bt92qwkOukT2R4yPupuIxAluAs8-okaHSY'
			});

			assert.strictEqual(res.statusCode, 401);
			assert.deepStrictEqual(res.body,  {
				code: 'INVALID_TOKEN',
				message: 'Auth: Token is not valid.'
			});
		});

		it('should respond 403 when token expired', async () => {
			clock.restore();
			clock = sinon.useFakeTimers({now: new Date('2023-12-17T16:00:00'), toFake: ['Date']});
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 403);
			assert.deepStrictEqual(res.body,  {
				code: 'TOKEN_EXPIRED',
				message: 'Auth: access token expired.'
			});

			clock.restore();
			clock = sinon.useFakeTimers({now, toFake: ['Date']});
		});

		it('should respond 404 no sessions with such fingerprint', async () => {
			const res = await httpClient.post({
				...defaultBody,
				fingerprint: '11111111-f625-41ca-a353-068d6ed70fc5'
			});

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'Auth: No sessions with such fingerprint.'
			});
		});
	});

	describe('without sessions in db', () => {
		beforeEach(async () => {
			const registerResult = await registerUser({
				email: 'a@yandex.ru',
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5'
			});

			assert.strictEqual(registerResult, true);
		});

		it('should respond 404 when no sessions for this user', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'Auth: No sessions for this user.'
			});
		});
	});
});