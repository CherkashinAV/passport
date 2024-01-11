import assert from 'assert';
import {clearDb, registerUser} from '../db-utils';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import http from 'http';
import {dbClient} from '../../app/lib/db-client';
import sinon from 'sinon';

describe('/v1/registration_invite', () => {
    let server: http.Server;
    let url: string;
    let httpClient: ApiRequestSender;
    let clock: sinon.SinonFakeTimers;
    const now = new Date('2023-12-17T15:00:00');

    const defaultBody = {
        email: 'i@i.ru',
        name: 'Ivan',
        surname: 'Ivanov',
        linkToRegisterForm: 'http://register-form.com',
        accessToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDQxOTkzMTY4MDYsInJvbGUiOiJtb2RlcmF0b3IiLCJ1c2VySWQiOiJhYWFhYWFhYS1mNjI1LTQxY2EtYTM1My0wNjhkNmVkNzBmYzUiLCJpYXQiOjE3MDQxOTkzMTN9.Yf9A2I0D9CAqZ0o36XVWvQENpuq58La_CNHVTvxZWrc'
    };

    before(async () => {
        [server, url] = await startServer();
        httpClient = apiRequestFactory(new URL(`${url}/v1/registration_invite`), 'json');
        clock = sinon.useFakeTimers({now, toFake: ['Date']});
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

        it('should throw 400 if name was not provided', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                name: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'BAD_REQUEST');
            assert.strictEqual(res.body.message, 'name:Name is required');
        });

        it('should throw 400 if surname was not provided', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                surname: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'BAD_REQUEST');
            assert.strictEqual(res.body.message, 'surname:Surname is required');
        });

        it('should throw 400 if link to registration form was not provided', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                linkToRegisterForm: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'BAD_REQUEST');
            assert.strictEqual(res.body.message, 'linkToRegisterForm:Required');
        });

        it('should throw 400 if link to registration form is not correct url', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                linkToRegisterForm: 'a@'
            });

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'BAD_REQUEST');
            assert.strictEqual(res.body.message, 'linkToRegisterForm:Invalid url');
        });
    });

    describe('registration invite', () => {
        beforeEach(async () => {
            const registerResult = await registerUser({
                email: 'a@yandex.ru',
                name: 'Petya',
                surname: 'Petrov',
                passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
                partition: '<partition>',
                publicId: 'aaaaaaaa-f625-41ca-a353-068d6ed70fc5',
                role: 'moderator'
            });

            assert.strictEqual(registerResult, true);
        });

        it('should create invitation if all is ok', async () => {
            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 200);
            assert.deepStrictEqual(res.body, {
                status: 'OK'
            });

            const {rows} = await dbClient.query(`--sql
				SELECT * FROM users ORDER BY name;
			`);

            assert.strictEqual(rows.length, 2);
            assert.deepStrictEqual(rows[0], {
                created_at: rows[0].created_at,
                email: 'i@i.ru',
                id: 2,
                name: 'Ivan',
                surname: 'Ivanov',
                partition: '<partition>',
                password: null,
                role: 'default',
                public_id: rows[0].public_id,
                secret_active: true,
                secret_code: rows[0].secret_code,
                updated_at: rows[0].updated_at
            });
        });

        it('should respond with 401 when failed to verify token', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                accessToken:
                    'ey1111ciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDQxOTkzMTY4MDYsIwJvbGUiOiJtb2RlcmF0b3IiLCJ1c2VySWQiOiJhYWFhYWFhYS1mNjI1LTQxY2EtYTM1My0wNjhkNmVkNzBmYzUiLCJpYXQiOjE3MDQxOTkzMTN9.Yf9A2I0D9CAqZ0o36XVWvQENpuq58La_CNHVTvxZWrc'
            });

            assert.strictEqual(res.statusCode, 401);
            assert.deepStrictEqual(res.body, {
                code: 'INVALID_TOKEN',
                message: 'RegistrationInvite: Token is not valid.'
            });
        });

        it('should respond with 403 when token expired', async () => {
            clock.restore();
            clock = sinon.useFakeTimers({now: Date.now() + 60 * 60 * 60_000, toFake: ['Date']});
            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 403);
            assert.deepStrictEqual(res.body, {
                code: 'TOKEN_EXPIRED',
                message: 'RegistrationInvite: access token expired.'
            });

            clock.restore();
            clock = sinon.useFakeTimers({now, toFake: ['Date']});
        });

        it('should respond with 401 when user has not enough rights', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                accessToken:
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDI4MTQ0MDM2MDAsInJvbGUiOiJkZWZhdWx0IiwidXNlcklkIjoiYWFhYWFhYWEtZjYyNS00MWNhLWEzNTMtMDY4ZDZlZDcwZmM1IiwiaWF0IjoxNzAyODE0NDAwfQ.7FyCY_-21Bt92qwkOukT2R4yPupuIxAluAs8-okaHSY'
            });

            assert.strictEqual(res.statusCode, 401);
            assert.deepStrictEqual(res.body, {
                code: 'NOT_ENOUGH_RIGHTS',
                message: 'RegistrationInvite: User has not enough rights to create invitations'
            });
        });

        it('should respond with 401 when moderator tries to create new `moderator`', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                role: 'moderator'
            });

            assert.strictEqual(res.statusCode, 401);
            assert.deepStrictEqual(res.body, {
                code: 'NOT_ENOUGH_RIGHTS',
                message: 'RegistrationInvite: User has not enough rights to create invitation with role `moderator`'
            });
        });

        it('should respond with 409 when user already registered', async () => {
            const registerResult = await registerUser({
                email: 'i@i.ru',
                name: 'Ivan',
                surname: 'Ivanov',
                passwordHash: '$2b$10$wZonat1ZrNjnVMvFRN4SWeqfC1/SwKYwN4uyq.1tKIrI3K/S9dFEe',
                partition: '<partition>',
                publicId: 'bbbbbbbb-f625-41ca-a353-068d6ed70fc5'
            });
            assert.strictEqual(registerResult, true);

            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 409);
            assert.deepStrictEqual(res.body, {
                code: 'ALREADY_EXISTS',
                message: 'RegistrationInvite: User already exists.'
            });
        });

        it('should respond with 404 when no moderator user', async () => {
            clearDb();
            const res = await httpClient.post(defaultBody);

            assert.strictEqual(res.statusCode, 404);
            assert.deepStrictEqual(res.body, {
                code: 'NOT_FOUND',
                message: 'RegistrationInvite: No such moderator users'
            });
        });
    });
});
