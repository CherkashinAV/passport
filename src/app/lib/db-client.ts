import {Client, Pool} from 'pg';
import {config} from '../config';

export const dbClient = new Pool({
    host: 'localhost',
    user: config['db.user'],
    connectionTimeoutMillis: 2000,
    port: config['db.port'],
    database: config['db.name'],
    password: config['db.password']
});
