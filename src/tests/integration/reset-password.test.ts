import http from 'http';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import sinon from 'sinon';
import {hashManager} from '../../app/lib/hash';
import {clear_db, registerUser} from '../db-utils';
import assert from 'assert';
import {dbClient} from '../../app/lib/db-client';


describe('/v1/reset_password', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender
	let hashExpectation: sinon.SinonExpectation;

	const defaultBody = {
		email: 'user@test.com',
		password: 'qwerty',
		secretCode: '11111111-f625-41ca-a353-068d6ed70fc5'
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/reset_password`), 'json');
		const hashManagerMock = sinon.mock(hashManager);
		hashExpectation = hashManagerMock.expects('encode');
		hashExpectation.callsFake(() => {
			return '<hashed password>';
		});
	});

	after(async () => {
		await stopServer(server);
		sinon.restore()
	});

	beforeEach(async () => {
		await clear_db();
	});

	describe('check schema', () => {
		it('should throw 400 if email was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				email: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if email has incorrect format', async () => {
			const res = await httpClient.post({
				...defaultBody,
				email: "@test.ru"
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'email:Invalid email');
		});

		it('should throw 400 if password was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				password: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if password len less then 6 symbols', async () => {
			const res = await httpClient.post({
				...defaultBody,
				password: 'aaa'
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'password:Password must be at least 6 symbols')
		});

		it('should throw 400 if secret code was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				secretCode: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if secret code is not correct uuid', async () => {
			const res = await httpClient.post({
				...defaultBody,
				secretCode: 'aaa'
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'secretCode:Invalid uuid')
		});
	});

	describe('reset password when user is in db', () => {
		beforeEach(async () => {
			const registerResult = await registerUser({
				email: 'user@test.com',
				name: 'Petya',
				surname: 'Petrov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
				secretCode: '11111111-f625-41ca-a353-068d6ed70fc5',
				role: 'default'
			});

			assert.strictEqual(registerResult, true);
		});

		it('should update passwordHash if all is ok', async () => {
			const res = await httpClient.post(defaultBody, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 200);
			assert.deepStrictEqual(res.body, {
				status: 'OK'
			});

			const {rows} = await dbClient.query(`--sql
				SELECT * FROM users;
			`);

			assert.strictEqual(rows.length, 1);
			assert.deepStrictEqual(rows[0], {
				created_at: rows[0].created_at,
				email: 'user@test.com',
				id: 1,
				name: 'Petya',
				partition: '<partition>',
				password: '<hashed password>',
				public_id: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
				role: 'default',
				secret_active: false,
				secret_code: '11111111-f625-41ca-a353-068d6ed70fc5',
				surname: 'Petrov',
				updated_at: rows[0].updated_at
			});
		});

		it('should respond with 401 when secret code is incorrect', async () => {
			const res = await httpClient.post({
				...defaultBody,
				secretCode: '22222222-f625-41ca-a353-068d6ed70fc5'
			}, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 401);
			assert.deepStrictEqual(res.body, {
				code: 'INVALID_SECRET',
				message: 'ResetPassword: Invalid secret code for reset password'
			});
		});
	});

	describe('reset password when user not in db', () => {
		it('should respond with 404 when no such user in db', async () => {
			const res = await httpClient.post(defaultBody, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body, {
				code: 'NOT_FOUND',
				message: 'ResetPassword: No such users registered.'
			});
		});
	});
});