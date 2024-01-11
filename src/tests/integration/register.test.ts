import assert from 'assert';
import {clearDb, insertInvitation} from '../db-utils';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import http from 'http';
import {dbClient} from '../../app/lib/db-client';

describe('/v1/register', () => {
    let server: http.Server;
    let url: string;
    let httpClient: ApiRequestSender;

    const defaultBody = {
        email: 'user@test.com',
        password: 'qwerty',
        name: 'Ivan',
        surname: 'Ivanov'
    };

    const defaultBodyWithInvitation = {
        ...defaultBody,
        invitationCode: '2e285a06-f625-41ca-a353-068d6ed70fc5'
    };

    before(async () => {
        [server, url] = await startServer();
        httpClient = apiRequestFactory(new URL(`${url}/v1/register`), 'json');
    });

    after(async () => {
        await stopServer(server);
    });

    beforeEach(async () => {
        await clearDb();
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
                email: '@test.ru'
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
            assert.strictEqual(res.body.message, 'password:Password must be at least 6 symbols');
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
                partition: 'global',
                password: rows[0].password,
                public_id: rows[0].public_id,
                role: 'default',
                secret_active: false,
                secret_code: rows[0].secret_code,
                created_at: rows[0].created_at,
                updated_at: rows[0].updated_at
            });
        });

        it('should respond 200 when register success in partition', async () => {
            const res = await httpClient.post(defaultBody, {partition: '<partition>'});

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
                partition: '<partition>',
                password: rows[0].password,
                public_id: rows[0].public_id,
                role: 'default',
                secret_active: false,
                secret_code: rows[0].secret_code,
                created_at: rows[0].created_at,
                updated_at: rows[0].updated_at
            });
        });

        it('should respond 400 when name is missing', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                name: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.deepStrictEqual(res.body, {
                code: 'BAD_REQUEST',
                message: 'Registration: Name or surname is missing'
            });
        });

        it('should respond 400 when surname is missing', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                surname: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.deepStrictEqual(res.body, {
                code: 'BAD_REQUEST',
                message: 'Registration: Name or surname is missing'
            });
        });

        it('should respond with 409 `ALREADY_EXISTS` when user already registered', async () => {
            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.status, 'OK');

            {
                const res = await httpClient.post(defaultBody);

                assert.strictEqual(res.statusCode, 409);
                assert.deepStrictEqual(res.body, {
                    code: 'ALREADY_EXISTS',
                    message: 'Registration: User already registered'
                });
            }
        });
    });

    describe('with invitation code', () => {
        it('should respond 200 when register success', async () => {
            await insertInvitation({
                ...defaultBodyWithInvitation,
                secretActive: true
            });
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
                partition: 'global',
                password: rows[0].password,
                public_id: rows[0].public_id,
                role: 'default',
                secret_active: false,
                secret_code: rows[0].secret_code,
                created_at: rows[0].created_at,
                updated_at: rows[0].updated_at
            });
        });

        it('should respond 400 when no invitation for current user', async () => {
            const res = await httpClient.post({
                ...defaultBodyWithInvitation,
                email: 'a@gmail.com'
            });

            assert.strictEqual(res.statusCode, 400);

            assert.deepStrictEqual(res.body, {
                code: 'NO_INVITATION_FOR_USER',
                message: 'Registration: No invitation for current user'
            });
        });

        it('should respond 409 when user already registered', async () => {
            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.status, 'OK');

            {
                const res = await httpClient.post(defaultBodyWithInvitation);

                assert.strictEqual(res.statusCode, 409);
                assert.deepStrictEqual(res.body, {
                    code: 'ALREADY_EXISTS',
                    message: 'Registration: User already registered'
                });
            }
        });

        it('should respond 401 when secret code is incorrect', async () => {
            await insertInvitation({
                ...defaultBodyWithInvitation,
                secretActive: true
            });

            const res = await httpClient.post({
                ...defaultBodyWithInvitation,
                invitationCode: '1e285a06-f625-41ca-a353-068d6ed70fc5'
            });

            assert.strictEqual(res.statusCode, 401);
            assert.deepStrictEqual(res.body, {
                code: 'INVALID_SECRET',
                message: 'Registration: Invalid secret code for invitation'
            });
        });

        it('should respond with 500 when invitation code is inactive', async () => {
            await insertInvitation({
                ...defaultBodyWithInvitation,
                secretActive: false
            });

            const res = await httpClient.post(defaultBodyWithInvitation);

            assert.strictEqual(res.statusCode, 500);
            assert.deepStrictEqual(res.body, 'Internal Server Error');
        });
    });
});
