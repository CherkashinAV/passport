import got from 'got';
import http from 'http';
import {startServer, stopServer} from './test-server';
import assert from 'assert';
import {dbClient} from '../../app/lib/db-client';
import {clear_db} from '../db-utils';

const client = got.extend({
    throwHttpErrors: false
});

describe('base tests of http-api', () => {
    let server: http.Server;
    let url: string;

    before(() => {
        [server, url] = startServer();
    });

    after(() => {
        stopServer(server);
    });

    beforeEach(async () => {
        await clear_db();
    });

    it('should return 200 on /ping', async () => {
        const res = await client.get(`${url}/ping`);
        assert.strictEqual(res.statusCode, 200);
    });

    it('should return 404 code on unsupported paths', async () => {
        const res = await client.get(`${url}/abracadabra`);
        assert.strictEqual(res.statusCode, 404);
    });

    it('should add new user', async () => {
        await dbClient.query(`--sql
            INSERT INTO users (name) VALUES ('andre');`
        );

        const {rows} = await dbClient.query<{name: string}>(`--sql
            SELECT name FROM users;`
        );

        assert.strictEqual(rows[0].name, 'andre');
    });

    it('should get no users from db', async () => {
        const {rows} = await dbClient.query<{name: string}>(`--sql
            SELECT name FROM users;`
        );

        assert.strictEqual(rows.length, 0);
    });
});
