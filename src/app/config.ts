import winston from 'winston';
import dotenv from 'dotenv';
import process from 'process';

dotenv.config();

interface Config {
    port: string;
    'logger.level': string;
    'logger.format': winston.Logform.Format;
    'logger.disable': boolean;
    'db.name': string;
    'db.port': number;
    'db.user': string;
    'db.password': string;
    'db.host': string;
    'hash.saltRounds': number;
    'refreshSessions.maxAmount': number;
    'refreshSessions.Ttl': number;
    'jwt.privateKey': string;
    'accessToken.expiresIn': number;
    'sender.baseUrl': string;
}

const prodConfig: Config = {
    port: process.env.APP_PORT ?? '8080',
    'logger.level': 'info',
    'logger.format': winston.format.json(),
    'logger.disable': false,
    'db.name': process.env.DB_NAME!,
    'db.port': parseInt(process.env.DB_PORT!, 10),
    'db.user': process.env.DB_USER!,
    'db.password': process.env.DB_PASS!,
    'db.host': 'localhost',
    'hash.saltRounds': 10,
    'refreshSessions.maxAmount': 5,
    'refreshSessions.Ttl': 256 * 60 * 60 * 1000,
    'jwt.privateKey': process.env.PRIVATE_KEY!,
    'accessToken.expiresIn': 20 * 60 * 1000,
    'sender.baseUrl': ''
};

const testConfig: Config = {
    ...prodConfig
};

const devConfig: Config = {
    ...prodConfig,
    'db.host': process.env.DOCKER ? 'host.docker.internal' : 'localhost',
    'sender.baseUrl': process.env.DOCKER ? 'http://host.docker.internal:8082/v1/' : 'http://localhost:8082/v1/'
};

const ciConfig: Config = {
    ...prodConfig,
    'logger.disable': true,
    'db.name': process.env.TEST_DB_NAME!,
    'refreshSessions.maxAmount': 2,
    'refreshSessions.Ttl': 1000
};

const configsByEnv = new Map<string, Readonly<Config>>([
    ['development', devConfig],
    ['production', prodConfig],
    ['testing', testConfig],
    ['ci', ciConfig]
]);
export const env = process.env.NODE_ENV ?? 'development';
export const config: Readonly<Config> = configsByEnv.get(env)!;
