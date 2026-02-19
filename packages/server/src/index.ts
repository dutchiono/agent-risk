import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import { createRouter } from './routes';
import { registerSocketHandlers } from './socket';

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: config.clientOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

// Mount REST API
app.use('/api', createRouter(io));

// Mount WebSocket handlers
registerSocketHandlers(io);

server.listen(config.port, () => {
  console.log(`[server] agent-risk server running on http://localhost:${config.port}`);
  console.log(`[server] Entry fee: $${config.entryFeeUsd} | Move timeout: ${config.moveTimeoutMs / 1000}s`);
  console.log(`[server] Players per game: ${config.minPlayers}–${config.maxPlayers}`);
});
