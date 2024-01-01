import assert from 'assert';
import http from 'http';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {clear_db, registerUser} from '../db-utils';
import {createNewRefreshSession} from '../../app/storage/refreshSessions';
import {dbClient} from '../../app/lib/db-client';

describe('/v1/login', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender

	const defaultBody = {
		userId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
		fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5'
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/logout`), 'json');
	});

	after(async () => {
		await stopServer(server);
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

		it('should throw 400 if userId is not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				userId: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if userId is not correct uuid', async () => {
			const res = await httpClient.post({
				...defaultBody,
				userId: 'aaa'
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'userId:Invalid uuid');
		});
	});

	describe('logout', () => {
		it('should delete session and respond with 200 when session is in db', async () => {
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

			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 200);

			const {rows} = await dbClient.query(`--sql
				SELECT * FROM refresh_sessions;
			`);

			assert.strictEqual(rows.length, 0);
		});

		it('should respond with 200 when no sessions', async () => {
			const res = await httpClient.post(defaultBody);
			assert.strictEqual(res.statusCode, 200);
		});

		it('should respond with 200 when no sessions with such fingerprint', async () => {
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
				fingerprint: 'cccccccc-f625-41ca-a353-068d6ed70fc5',
				refreshToken: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5',
				userId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
				userAgent: 'Mozilla'
			});

			assert.strictEqual(sessionResult, true);

			const res = await httpClient.post(defaultBody);
			assert.strictEqual(res.statusCode, 200);
		});
	});
});