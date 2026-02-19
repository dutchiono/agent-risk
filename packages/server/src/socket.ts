import { Server as SocketServer, Socket } from 'socket.io';
import { applyMove, Move } from '@agent-risk/engine';
import { getGame, setGame, getAgentByApiKey } from './lobby';
import { startMoveTimer, clearMoveTimer } from './timer';
import { config } from './config';

export function registerSocketHandlers(io: SocketServer): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // Spectators and agents both join a game room by gameId
    socket.on('join_game', (data: { gameId: string; apiKey?: string }) => {
      const { gameId, apiKey } = data;
      const game = getGame(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      socket.join(gameId);
      socket.emit('state_update', game);
      console.log(`[ws] ${socket.id} joined game room ${gameId}`);

      // If agent, tag the socket with their player identity
      if (apiKey) {
        const agent = getAgentByApiKey(apiKey);
        if (agent) {
          (socket as any).agentId = agent.agentId;
          (socket as any).currentGameId = gameId;
          console.log(`[ws] Agent ${agent.name} (${agent.agentId}) authenticated in game ${gameId}`);
        }
      }
    });

    // Agent submits a move via WebSocket (alternative to REST)
    socket.on('submit_move', (data: { gameId: string; apiKey: string; move: Move }) => {
      const { gameId, apiKey, move } = data;

      const agent = getAgentByApiKey(apiKey);
      if (!agent) {
        socket.emit('move_result', { ok: false, error: 'Unauthorized' });
        return;
      }

      const state = getGame(gameId);
      if (!state) {
        socket.emit('move_result', { ok: false, error: 'Game not found' });
        return;
      }

      if (state.currentPlayerId !== agent.agentId) {
        socket.emit('move_result', { ok: false, error: 'Not your turn' });
        return;
      }

      const result = applyMove(state, agent.agentId, move, config.moveTimeoutMs);
      if (!result.ok) {
        socket.emit('move_result', { ok: false, error: result.error });
        return;
      }

      setGame(gameId, result.newState);
      clearMoveTimer(gameId);

      // Broadcast events and new state to all in the room
      for (const event of result.events) {
        io.to(gameId).emit('game_event', event);
      }
      io.to(gameId).emit('state_update', result.newState);
      socket.emit('move_result', { ok: true });

      if (result.newState.status === 'finished') {
        io.to(gameId).emit('game_over', {
          winner: result.newState.winner,
          potUsd: result.newState.potUsd,
        });
      } else {
        startMoveTimer(gameId, io);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);
    });
  });
}
