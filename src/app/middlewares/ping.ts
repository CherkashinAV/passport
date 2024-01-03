import {Request, Response, NextFunction} from 'express';

export function pingMidleware(_req: Request, res: Response, _next: NextFunction) {
    res.send();
}
