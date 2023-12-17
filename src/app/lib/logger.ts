import winston from 'winston';
import {config, env} from '../config';

const {combine, timestamp, colorize, printf} = winston.format;

export const logger = winston.createLogger({
    level: config['logger.level'],
    format: config['logger.format'],
    transports: [
        new winston.transports.File({filename: './.dev/logs/error.log', level: 'error'}),
        new winston.transports.File({filename: './.dev/logs/combined.log'})
    ]
});

if (env !== 'production') {
    logger.configure({
        level: 'http',
        format: combine(
            colorize({all: true}),
            timestamp({
                format: 'YYYY-MM-DD hh:mm:ss A'
            }),
            printf((info) => `${info.level} [${info.timestamp}]: ${info.message}`)
        ),
        transports: [new winston.transports.Console()]
    });
}

if (config['logger.disable']) {
    logger.transports.forEach((transport) => (transport.silent = true));
}
