import { Request,Response, NextFunction } from 'express'
import { ZodSchema } from 'zod';
import { ValidationError } from './errorHandler';


type RequestPart = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, part: RequestPart = 'body'){
    return(req: Request, res: Response, next:NextFunction)=>{
            const result = schema.safeParse(req[part]);
            if(!result.success){
                return next(new ValidationError(result.error));
            }
            req[part] = result.data;
            next();
        }
}