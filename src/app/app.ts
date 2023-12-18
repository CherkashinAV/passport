import express, {Application, NextFunction, Request, Response} from 'express';
import {pingMidleware} from './middlewares';
import {v1Router} from './routes/v1';
import {env, config} from './config';
import {logger} from './lib/logger';
import {loggerMiddleware} from './middlewares/logger';

export async function createApp(): Promise<Application> {
    const app: Application = express();

    return app
        .use(loggerMiddleware)
        .get('/ping', pingMidleware)
        .use('/v1', v1Router)
        .use((_req: Request, res: Response) => res.sendStatus(404))
        .use((err: any, req: Request, res: Response, _next: NextFunction) => {
            logger.error(err);
            res.sendStatus(500);
        });
}

export async function runApp(): Promise<void> {
    const port = config.port;
    logger.info(env);
    const app = await createApp();
    app.listen(port, () => {
        logger.info(`Server started on port ${port} (${env})`);
    });
}

if (require.main === module) {
    runApp().catch((err) => {
        logger.error(err);
        process.exit();
    })
}
