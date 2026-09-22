import { Hono } from 'hono';

interface Env {
  DB: any;
  KV_CACHE: any;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.1.0',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
