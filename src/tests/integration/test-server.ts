import {createApp} from '../../app/app';
import {Express} from 'express';
import http from 'http';
import {AddressInfo} from 'net';

export function startServer(): [http.Server, string] {
    const app: Express = createApp();
    const server = http.createServer(app);
    server.listen();

    const port = (server.address() as AddressInfo).port;
    const address = `http://localhost:${port}`;

    return [server, address];
}

export async function stopServer(server: http.Server) {
    server.close();
}
