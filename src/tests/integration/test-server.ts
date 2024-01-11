import got from 'got';
import {createApp} from '../../app/app';
import http from 'http';
import {AddressInfo} from 'net';

export type ApiRequestSender = {
    get: (query?: Record<string, string | undefined>) => any;
    post: (body?: Record<string, any>, query?: Record<string, string | undefined>) => any;
};

export async function startServer(): Promise<[http.Server, string]> {
    const app = await createApp();
    const server = http.createServer(app);
    server.listen();

    const port = (server.address() as AddressInfo).port;
    const address = `http://localhost:${port}`;

    return [server, address];
}

export async function stopServer(server: http.Server) {
    server.close();
}

export function apiRequestFactory(url: URL, responseType: 'string' | 'json', options?: any) {
    const httpClient = got.extend({
        throwHttpErrors: false,
        ...options
    });

    return {
        get: async (query?: Record<string, string | undefined>) => {
            return httpClient.get(url, {
                searchParams: query,
                responseType: responseType === 'string' ? undefined : responseType,
                retry: 0
            });
        },

        post: async (body?: Record<string, any>, query?: Record<string, string | undefined>) => {
            return httpClient.post(url, {
                json: body,
                searchParams: query,
                responseType: responseType === 'string' ? undefined : responseType,
                retry: 0
            });
        }
    };
}
