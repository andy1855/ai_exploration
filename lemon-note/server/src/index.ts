import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import logsRouter from './routes/logs';
import notesRouter from './routes/notes';
import { initDb } from './database';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/logs', logsRouter);
app.use('/api/notes', notesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('[server] failed to connect to MySQL:', err);
  process.exit(1);
});
