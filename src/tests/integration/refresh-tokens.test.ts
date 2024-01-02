import assert from 'assert';
import http from 'http';
import sinon, {SinonExpectation, SinonFakeTimers} from 'sinon';
import {clear_db, registerUser} from '../db-utils';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {jwtManager} from '../../app/lib/jwt';
import {createNewRefreshSession} from '../../app/storage/refreshSessions';
import {dbClient} from '../../app/lib/db-client';
import {timeout} from '../../app/helpers';

describe('/v1/refresh_tokens`', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender
	let clock: SinonFakeTimers;
	let jwtExpectation: SinonExpectation;
	const now = new Date('2023-12-17T15:00:00');

	const defaultBody = {
		fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5'
	}

	const defaultSessionArgs = {
		fingerprint: defaultBody.fingerprint,
		refreshToken: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5',
		userId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
		userAgent: 'Mozilla'
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/refresh_tokens`), 'json', {
			headers: {
				'Cookie': `refreshToken=${defaultSessionArgs.refreshToken}`
			}
		});
		clock = sinon.useFakeTimers({now, toFake: ['Date']});
		const jwtManagerMock = sinon.mock(jwtManager);
		jwtExpectation = jwtManagerMock.expects('generateJWTToken');
		jwtExpectation.callsFake(() => {
			return '<access token>';
		});

		sinon.stub(require('crypto'), "randomUUID").returns('cccccccc-f625-41ca-a353-068d6ed70fc5');
	});

	after(async () => {
		await stopServer(server);
		clock.restore();
		sinon.restore();
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
	});

	describe('refresh tokens', () => {
		beforeEach(async () => {
			const registerResult = await registerUser({
				email: 'a@a.ru',
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: defaultSessionArgs.userId
			});

			assert.strictEqual(registerResult, true);
		});

		it('should refresh session when all ok', async () => {
			const sessionResult = await createNewRefreshSession(defaultSessionArgs);
			assert.strictEqual(sessionResult, true);

			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 200);
			assert.deepStrictEqual(res.body, {
				status: 'OK',
				data: {
					accessToken: '<access token>',
					refreshToken: 'cccccccc-f625-41ca-a353-068d6ed70fc5'
				}
			});

			const {rows} = await dbClient.query(`--sql
				SELECT * FROM refresh_sessions;
			`);

			assert.strictEqual(rows.length, 1);
			assert.deepStrictEqual(rows[0], {
				created_at: rows[0].created_at,
				expires_in: '1702814401000',
				fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5',
				id: 2,
				refresh_token: 'cccccccc-f625-41ca-a353-068d6ed70fc5',
				user_agent: 'got (https://github.com/sindresorhus/got)',
				user_id: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5'
			});
			assert.deepStrictEqual(res.headers['set-cookie'], [
				'refreshToken=bbbbbbbb-f625-41ca-a353-068d6ed70fc5; Max-Age=1; Path=/v1/auth; Expires=Sun, 17 Dec 2023 12:00:01 GMT'
			]);
		});

		it('should respond with 404 when no sessions for user in db', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'RefreshTokens: No session to refresh.'
			});
		});

		it('should respond with 404 when no sessions with such fingerprint', async () => {
			const sessionResult = await createNewRefreshSession(defaultSessionArgs);
			assert.strictEqual(sessionResult, true);

			const res = await httpClient.post({fingerprint: '11111111-f625-41ca-a353-068d6ed70fc5'});
	
			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'RefreshTokens: No session to refresh.'
			});
		});

		it('should respond with 404 when no sessions with such refreshToken', async () => {
			const sessionResult = await createNewRefreshSession({
				...defaultSessionArgs,
				refreshToken: '11111111-f625-41ca-a353-068d6ed70fc5'
			});
			assert.strictEqual(sessionResult, true);
			const res = await httpClient.post(defaultBody);
	
			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'RefreshTokens: No session to refresh.'
			});
		});

		it('should respond with 403 when refreshToken is expired', async () => {
			clock.restore()
			const sessionResult = await createNewRefreshSession(defaultSessionArgs);
			assert.strictEqual(sessionResult, true);

			await timeout(1000);

			const res = await httpClient.post(defaultBody);
	
			assert.strictEqual(res.statusCode, 403);
			assert.deepStrictEqual(res.body,  {
				code: 'TOKEN_EXPIRED',
				message: 'RefreshTokens: refresh token expired.'
			});
			clock = sinon.useFakeTimers({now, toFake: ['Date']});
		});
	});
});