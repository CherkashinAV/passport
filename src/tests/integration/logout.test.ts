import assert from 'assert';
import http from 'http';
import {ApiRequestSender, apiRequestFactory, startServer, stopServer} from './test-server';
import {clearDb, registerUser} from '../db-utils';
import {createNewRefreshSession} from '../../app/storage/refreshSessions';
import {dbClient} from '../../app/lib/db-client';
import sinon from 'sinon';

describe.only('/v1/logout', () => {
    let server: http.Server;
    let url: string;
    let httpClient: ApiRequestSender;
    let clock: sinon.SinonFakeTimers;
    const now = new Date('2023-12-17T15:00:00');

    const defaultBody = {
        accessToken:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmVzSW4iOjE3MDI4MTQ0MDM2MDAsInJvbGUiOiJkZWZhdWx0IiwidXNlcklkIjoiYWFhYWFhYWEtZjYyNS00MWNhLWEzNTMtMDY4ZDZlZDcwZmM1IiwiaWF0IjoxNzAyODE0NDAwfQ.7FyCY_-21Bt92qwkOukT2R4yPupuIxAluAs8-okaHSY',
        fingerprint: '2e285a06-f625-41ca-a353-068d6ed70fc5'
    };

    before(async () => {
        [server, url] = await startServer();
        httpClient = apiRequestFactory(new URL(`${url}/v1/logout`), 'json');
        clock = sinon.useFakeTimers({now, toFake: ['Date']});
    });

    after(async () => {
        await stopServer(server);
    });

    beforeEach(async () => {
        await clearDb();
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

        it('should throw 400 if accessToken is not provided', async () => {
            const res = await httpClient.post({
                ...defaultBody,
                accessToken: undefined
            });

            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.code, 'BAD_REQUEST');
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
