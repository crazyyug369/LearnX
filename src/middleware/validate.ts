import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

export const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Optionally overwrite the request data with the parsed data
      req.body = validatedData.body ?? req.body;
      req.query = (validatedData.query as any) ?? req.query;
      req.params = (validatedData.params as any) ?? req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid request data",
          details: error.issues.map((e) => ({
             path: e.path.join('.'),
             message: e.message
          }))
        });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};