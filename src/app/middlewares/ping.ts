import {Request, Response, NextFunction} from 'express';

export function pingMidleware(req: Request, res: Response, next: NextFunction) {
    res.send();
}
