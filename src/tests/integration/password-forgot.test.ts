import assert from 'assert';
import http from 'http';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {clear_db, registerUser} from '../db-utils';
import sinon from 'sinon';
import {dbClient} from '../../app/lib/db-client';

describe('/v1/password_forgot', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender

	const defaultBody = {
		email: 'a@a.ru',
		linkToResetForm: 'http://reset-form.com',
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/password_forgot`), 'json');

		sinon.stub(require('crypto'), "randomUUID").returns('aaaaaaaa-f625-41ca-a353-068d6ed70fc5');
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
			assert.strictEqual(res.body.message, 'email:Invalid email')
		});

		it('should throw 400 if link to reset form was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				linkToResetForm: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'linkToResetForm:Required')
		});

		it('should throw 400 if link to reset form is not correct url', async () => {
			const res = await httpClient.post({
				...defaultBody,
				linkToResetForm: 'a@'
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
			assert.strictEqual(res.body.message, 'linkToResetForm:Invalid url')
		});
	});

	describe('forgot password', () => {
		it('should update secret code when all ok', async () => {
			const registerResult = await registerUser({
				email: defaultBody.email,
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5'
			});

			assert.strictEqual(registerResult, true);

			const res = await httpClient.post(defaultBody, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 200);
			assert.deepStrictEqual(res.body, {
				status: 'OK'
			});

			const {rows} = await dbClient.query(`--sql
				SELECT secret_code, secret_active FROM users;
			`);

			assert.deepStrictEqual(rows.length, 1);
			assert.deepStrictEqual(rows[0], {
				secret_code: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
				secret_active: true
			});
		});

		it('should respond with 404 when no user in db', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'PasswordForgot: No such users registered.'
			});
		});

		it('should respond with 404 when no user in current partition', async () => {
			const registerResult = await registerUser({
				email: defaultBody.email,
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>',
				publicId: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5'
			});

			assert.strictEqual(registerResult, true);

			const res = await httpClient.post(defaultBody, {partition: 'other partition'});

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'PasswordForgot: No such users registered.'
			});
		});
	});
});