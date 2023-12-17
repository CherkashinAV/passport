import express, {Express, Request, Response} from 'express';
import {pingMidleware} from './middlewares';
import {v1Router} from './routes/v1';
import {env, config} from './config';
import {logger} from './lib/logger';
import {loggerMiddleware} from './middlewares/logger';

export function createApp(): Express {
    const app: Express = express();

    return app
        .use(loggerMiddleware)
        .get('/ping', pingMidleware)
        .use('/v1', v1Router)
        .use((_req: Request, res: Response) => res.sendStatus(404))
        .use((err: any) => {
            logger.error(err);
        });
}

export function runApp() {
    const port = config.port;
    logger.info(env);
    const app = createApp();
    app.listen(port, () => {
        logger.info(`Server started on port ${port} (${env})`);
    });
}

runApp();
