import winston from 'winston';
import dotenv from 'dotenv';
import process from 'process';

dotenv.config();

interface Config {
    'port': string;
    'logger.level': string;
    'logger.format': winston.Logform.Format;
    'logger.disable': boolean;
    'db.name': string;
    'db.port': number;
    'db.user': string;
    'db.password': string;
}

const prodConfig: Config = {
    'port': process.env.APP_PORT ?? '8080',
    'logger.level': 'info',
    'logger.format': winston.format.json(),
    'logger.disable': false,
    'db.name': process.env.DB_NAME!,
    'db.port': parseInt(process.env.DB_PORT!, 10),
    'db.user': process.env.DB_USER!,
    'db.password': process.env.DB_PASS!
};

const testConfig: Config = {
    ...prodConfig
};

const devConfig: Config = {
    ...prodConfig
};

const ciConfig: Config = {
    ...prodConfig,
    'logger.disable': true,
    'db.name': process.env.TEST_DB_NAME!
};

const configsByEnv = new Map<string, Readonly<Config>>([
    ['development', devConfig],
    ['production', prodConfig],
    ['testing', testConfig],
    ['ci', ciConfig]
]);
export const env = process.env.NODE_ENV ?? 'development';
export const config: Readonly<Config> = configsByEnv.get(env)!;
