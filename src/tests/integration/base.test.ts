import got from 'got';
import http from 'http';
import {startServer, stopServer} from './test-server';
import assert from 'assert';
import {clearDb} from '../db-utils';

const client = got.extend({
    throwHttpErrors: false
});

describe('base tests of http-api', () => {
    let server: http.Server;
    let url: string;

    before(async () => {
        [server, url] = await startServer();
    });

    after(() => {
        stopServer(server);
    });

    beforeEach(async () => {
        await clearDb();
    });

    it('should return 200 on /ping', async () => {
        const res = await client.get(`${url}/ping`);
        assert.strictEqual(res.statusCode, 200);
    });

    it('should return 404 code on unsupported paths', async () => {
        const res = await client.get(`${url}/abracadabra`);
        assert.strictEqual(res.statusCode, 404);
    });
});
