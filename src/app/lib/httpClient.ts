import got from 'got';

export const httpClient = got.extend({
	throwHttpErrors: false,
});