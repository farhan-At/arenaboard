import express from 'express';
import {createServer} from 'node:http';
import {randomUUID, randomBytes, createHash} from 'node:crypto';
import {WebSocketServer, WebSocket} from 'ws';
import {createBoard, score, DomainError} from './rules.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const validId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export function arenaServer(store) {
  const app = express();
  const server = createServer(app);
  const sockets = new WebSocketServer({noServer: true, maxPayload: 1024});
  const metrics = {requests: 0, errors: 0, totalMilliseconds: 0};
  app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      metrics.requests++;
      if (res.statusCode >= 400) metrics.errors++;
      metrics.totalMilliseconds += performance.now() - start;
    });
    next();
  });
  app.use(express.json({limit: '16kb'}));
  app.use(express.static('public'));
  app.use(express.static('client', {index: 'index.html'}));
  app.get('/health', (_req, res) => res.json({status: 'up'}));
  app.get('/metrics', (_req, res) => res.json(metrics));
  app.param('id', async (req, res, next, id) => {
    if (!validId.test(id)) throw new DomainError('Unknown tournament.', 404);
    req.tournament = await store.get(id);
    if (!req.tournament) throw new DomainError('Unknown tournament.', 404);
    next();
  });
  app.post('/api/boards', async (req, res) => {
    const board = createBoard(req.body?.name, req.body?.players);
    const id = randomUUID();
    const key = randomBytes(24).toString('hex');
    await store.insert({id, keyHash: digest(key), board});
    res.status(201).json({id, key, board});
  });
  app.get('/api/boards/:id', (req, res) => res.json(req.tournament.board));
  app.post('/api/boards/:id/matches/:match', async (req, res) => {
    const doc = req.tournament;
    if (digest(req.get('x-organiser-key') || '') !== doc.keyHash) throw new DomainError('Organiser key required.', 403);
    const revision = req.body?.revision;
    if (revision !== doc.board.revision) throw new DomainError('Board changed. Refresh before scoring.', 409);
    score(doc.board, req.params.match, req.body.left, req.body.right);
    if (!await store.replace(doc, revision)) throw new DomainError('Board changed. Refresh before scoring.', 409);
    for (const client of sockets.clients) {
      if (client.boardId === doc.id && client.readyState === WebSocket.OPEN) client.send(JSON.stringify(doc.board));
    }
    res.json(doc.board);
  });
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({error: status >= 500 ? 'Storage unavailable.' : error.message});
  });
  server.on('upgrade', (req, socket, head) => {
    const id = (req.url || '').slice('/live/'.length);
    if (!req.url.startsWith('/live/') || !validId.test(id)) return socket.destroy();
    sockets.handleUpgrade(req, socket, head, client => {
      client.boardId = id;
      storeSnapshot(client, id);
    });
  });
  async function storeSnapshot(client, id) {
    try {
      const doc = await store.get(id);
      if (!doc) return client.close(1008, 'Unknown tournament');
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(doc.board));
    } catch { client.close(1011, 'Storage unavailable'); }
  }
  return server;
}
