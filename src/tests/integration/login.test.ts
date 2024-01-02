import assert from 'assert';
import http from 'http';
import sinon, {SinonExpectation, SinonFakeTimers} from 'sinon';
import {clear_db} from '../db-utils';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {createNewUserRecord} from '../../app/storage/users';
import {jwtManager} from '../../app/lib/jwt';

describe('/v1/login', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender
	let clock: SinonFakeTimers;
	let jwtExpectation: SinonExpectation;
	const now = new Date('2023-12-17T15:00:00');

	const defaultBody = {
		email: 'user@test.com',
		password: 'qwerty',
		fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5'
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/login`), 'json');
		clock = sinon.useFakeTimers({now, toFake: ['Date']});
		const jwtManagerMock = sinon.mock(jwtManager);
		jwtExpectation = jwtManagerMock.expects('generateJWTToken');
		jwtExpectation.callsFake(() => {
			return '<access token>';
		});

		sinon.stub(require('crypto'), "randomUUID").returns('aaaaaaaa-f625-41ca-a353-068d6ed70fc5');
	});

	after(async () => {
		await stopServer(server);
		clock.restore();
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

	describe('when user registered', () => {
		beforeEach(async () => {
			const registerResult = await createNewUserRecord({
				email: defaultBody.email,
				name: 'Ivan',
				surname: 'Ivanov',
				passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
				partition: '<partition>'
			});

			assert.strictEqual(registerResult, true);
		});

		it('should login successfully when all ok', async () => {
			const res = await httpClient.post(defaultBody, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 200);
			assert.deepStrictEqual(res.body, {
				accessToken: '<access token>',
				refreshToken: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5'
			});

			assert.deepStrictEqual(res.headers['set-cookie'], [
				'refreshToken=aaaaaaaa-f625-41ca-a353-068d6ed70fc5; Max-Age=921600; Path=/v1/auth; Expires=Thu, 28 Dec 2023 04:00:00 GMT'
			]);
		});

		it('should respond with 404 if no such user in this partition', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'Login: No such users registered.'
			});
		});

		it('should respond with 401 if password is invalid', async () => {
			const res = await httpClient.post({
				...defaultBody,
				password: '123456'
			}, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 401);
			assert.deepStrictEqual(res.body,  {
				code: 'INVALID_PASSWORD',
				message: 'Login: Invalid password for current user.'
			});
		});

		it('should respond with 409 if session already exists', async () => {
			jwtExpectation.atLeast(2);
			const res = await httpClient.post(defaultBody, {partition: '<partition>'});

			assert.strictEqual(res.statusCode, 200);
			{
				const res = await httpClient.post(defaultBody, {partition: '<partition>'});

				assert.strictEqual(res.statusCode, 409);

				assert.deepStrictEqual(res.body,  {
					code: 'ALREADY_EXISTS',
					message: 'Login: Session already exists.'
				});
			}
		});

		it('should respond with 400 if when amount of sessions is reached limit', async () => {
			jwtExpectation.atLeast(3);
			const res = await httpClient.post(defaultBody, {partition: '<partition>'});
			assert.strictEqual(res.statusCode, 200);

			{
				const res = await httpClient.post({
					...defaultBody,
					fingerprint: '1e285a06-f625-41ca-a353-068d6ed70fc5'
				}, {partition: '<partition>'});
				assert.strictEqual(res.statusCode, 200);
			}

			{
				const res = await httpClient.post({
					...defaultBody,
					fingerprint: '5e285a06-f625-41ca-a353-068d6ed70fc5'
				}, {partition: '<partition>'});

				assert.strictEqual(res.statusCode, 400);

				assert.deepStrictEqual(res.body,  {
					code: 'NEED_PASSWORD_RESET',
					message: 'Login: Sessions limit exceeded.'
				});
			}
		});
	});

	describe('when user not registered', () => {
		it('should throw 404 when user not registered', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 404);
			assert.deepStrictEqual(res.body,  {
				code: 'NOT_FOUND',
				message: 'Login: No such users registered.'
			});
		});
	});
});