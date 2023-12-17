import {Router} from 'express';
import {apiStarter} from './api-starter';

export const v1Router: Router = Router();

v1Router.get('/api-starter', apiStarter);
