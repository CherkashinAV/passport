import assert from 'assert';
import {clear_db} from '../db-utils';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import http from 'http';
import {dbClient} from '../../app/lib/db-client';


describe('/v1/register', () => {
	let server: http.Server;
    let url: string;
	let httpClient: ApiRequestSender

	const defaultBody = {
		email: 'user@test.com',
		password: 'qwerty',
		name: 'Ivan',
		surname: 'Ivanov'
	}

	const defaultBodyWithInvitation = {
		...defaultBody,
		invitationCode: '2e285a06-f625-41ca-a353-068d6ed70fc5',
	}

	before(async () => {
		[server, url] = await startServer();
		httpClient = apiRequestFactory(new URL(`${url}/v1/register`), 'json');
	});

	after(async () => {
		await stopServer(server);
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

		it('should throw 400 if name was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				name: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});

		it('should throw 400 if surname was not provided', async () => {
			const res = await httpClient.post({
				...defaultBody,
				surname: undefined
			});

			assert.strictEqual(res.statusCode, 400);
			assert.strictEqual(res.body.code, 'BAD_REQUEST');
		});
	});

	describe('without invitation code', () => {
		it('should respond 200 when register success', async () => {
			const res = await httpClient.post(defaultBody);

			assert.strictEqual(res.statusCode, 200);
			assert.strictEqual(res.body.status, 'OK');

			const {rows} = await dbClient.query(`--sql
				SELECT * FROM users;
			`);

			assert.deepStrictEqual(rows[0], {
				id: 1,
				email: 'user@test.com',
				name: 'Ivan',
				surname: 'Ivanov',
				partition: null,
				password: rows[0].password,
				public_id: rows[0].public_id,
				role: null,
				secret_active: false,
				secret_code: rows[0].secret_code,
				created_at: rows[0].created_at,
				updated_at: rows[0].updated_at
			});
		});
	});

	describe('with invitation code', () => {
		beforeEach(async () => {
			await dbClient.query(`--sql
				INSERT INTO users
				(name, surname, email, secret_code, secret_active)
				VALUES
				($1, $2, $3, $4, $5);
			`, [
				defaultBodyWithInvitation.name,
				defaultBodyWithInvitation.surname,
				defaultBodyWithInvitation.email, 
				defaultBodyWithInvitation.invitationCode, 
				true
			]);
		});

		it('should respond 200 when register success', async () => {
			const res = await httpClient.post(defaultBodyWithInvitation);

			assert.strictEqual(res.statusCode, 200);
			assert.strictEqual(res.body.status, 'OK');

			const {rows} = await dbClient.query(`--sql
				SELECT * FROM users;
			`);

			assert.deepStrictEqual(rows[0], {
				id: 1,
				email: 'user@test.com',
				name: 'Ivan',
				surname: 'Ivanov',
				partition: null,
				password: rows[0].password,
				public_id: rows[0].public_id,
				role: null,
				secret_active: false,
				secret_code: rows[0].secret_code,
				created_at: rows[0].created_at,
				updated_at: rows[0].updated_at
			});
		})
	})
})