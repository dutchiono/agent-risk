import { Server as SocketServer } from 'socket.io';
import { applyTimeout } from '@agent-risk/engine';
import { getGame, setGame, listGames } from './lobby';
import { config } from './config';

const timers = new Map<string, NodeJS.Timeout>();

export function startMoveTimer(gameId: string, io: SocketServer): void {
  clearMoveTimer(gameId);

  const timer = setTimeout(() => {
    const state = getGame(gameId);
    if (!state || state.status !== 'playing') return;

    console.log(`[timer] Move timeout in game ${gameId} for player ${state.currentPlayerId}`);

    const result = applyTimeout(state, config.moveTimeoutMs);
    setGame(gameId, result.newState);

    // Broadcast timeout events
    for (const event of result.events) {
      io.to(gameId).emit('game_event', event);
    }
    io.to(gameId).emit('state_update', result.newState);

    if (result.newState.status === 'finished') {
      io.to(gameId).emit('game_over', {
        winner: result.newState.winner,
        potUsd: result.newState.potUsd,
      });
      clearMoveTimer(gameId);
    } else {
      // Start timer for the next player
      startMoveTimer(gameId, io);
    }
  }, config.moveTimeoutMs);

  timers.set(gameId, timer);
}

export function clearMoveTimer(gameId: string): void {
  const t = timers.get(gameId);
  if (t) {
    clearTimeout(t);
    timers.delete(gameId);
  }
}

/** Called by server on startup to resume any in-progress games (if persistence added later) */
export function resumeAllTimers(io: SocketServer): void {
  for (const game of listGames()) {
    if (game.status === 'playing' && game.turnDeadline) {
      const remaining = game.turnDeadline - Date.now();
      if (remaining <= 0) {
        // Already expired — process immediately
        const result = applyTimeout(game, config.moveTimeoutMs);
        setGame(game.id, result.newState);
        io.to(game.id).emit('state_update', result.newState);
      } else {
        startMoveTimer(game.id, io);
      }
    }
  }
}
