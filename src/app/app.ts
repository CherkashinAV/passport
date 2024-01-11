import express, {Application, NextFunction, Request, Response} from 'express';
import {pingMidleware, loggerMiddleware} from './middlewares';
import {v1Router} from './routes/v1';
import {env, config} from './config';
import {logger} from './lib/logger';

export function createApp(): Application {
    const app: Application = express();

    return app
        .use(loggerMiddleware)
        .get('/ping', pingMidleware)
        .use('/v1', v1Router)
        .use((_req: Request, res: Response) => res.sendStatus(404))
        .use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            logger.error(err);
            res.sendStatus(500);
        });
}

export function runApp(): void {
    const port = config.port;
    logger.info(env);
    const app = createApp();
    app.listen(port, () => {
        logger.info(`Server started on port ${port} (${env})`);
    });
}

if (require.main === module) {
    try {
        runApp();
    } catch (err) {
        logger.error(err);
        process.exit();
    }
}
