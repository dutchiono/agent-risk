import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { applyMove, Move } from '@agent-risk/engine';
import {
  registerAgent,
  getAgentByApiKey,
  getOrCreateOpenLobby,
  joinLobby,
  getLobby,
  listLobbies,
  startGameFromLobby,
  getGame,
  setGame,
  listGames,
} from './lobby';
import { startMoveTimer, clearMoveTimer } from './timer';
import { config } from './config';
import { Server as SocketServer } from 'socket.io';

export function createRouter(io: SocketServer): Router {
  const router = Router();

  // ---- Health ----
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // ---- Agent registration ----
  // POST /api/agents/register
  // Body: { name: string }
  // Returns: { agentId, apiKey }
  router.post('/agents/register', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ ok: false, error: 'name is required' });
      return;
    }
    const reg = registerAgent(name.trim().slice(0, 64));
    res.json({ ok: true, agentId: reg.agentId, apiKey: reg.apiKey, name: reg.name });
  });

  // ---- Lobbies ----
  // GET /api/lobbies — list all lobbies
  router.get('/lobbies', (_req: Request, res: Response) => {
    const lobbies = listLobbies().map(l => ({
      id: l.id,
      playerCount: l.players.length,
      maxPlayers: config.maxPlayers,
      minPlayers: config.minPlayers,
      status: l.status,
      entryFeeUsd: config.entryFeeUsd,
      createdAt: l.createdAt,
    }));
    res.json({ ok: true, lobbies });
  });

  // POST /api/lobbies/join — join an open lobby (or auto-create one)
  // Header: x-api-key: <apiKey>
  // Body: { paymentProof?: string } — hook for future Stripe/crypto verification
  router.post('/lobbies/join', (req: Request, res: Response) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) { res.status(401).json({ ok: false, error: 'Missing x-api-key header' }); return; }

    const agent = getAgentByApiKey(apiKey);
    if (!agent) { res.status(401).json({ ok: false, error: 'Invalid API key' }); return; }

    // TODO: verify paymentProof (Stripe/USDC) before allowing join
    // For now we accept any registered agent
    const lobby = getOrCreateOpenLobby();
    const result = joinLobby(lobby.id, {
      id: agent.agentId,
      name: agent.name,
      isAgent: true,
      apiKey,
    });

    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return; }

    const updatedLobby = getLobby(lobby.id)!;
    res.json({
      ok: true,
      lobbyId: lobby.id,
      playerCount: updatedLobby.players.length,
      minPlayers: config.minPlayers,
      maxPlayers: config.maxPlayers,
      entryFeeUsd: config.entryFeeUsd,
      status: updatedLobby.status,
    });

    // Auto-start if min players reached
    if (updatedLobby.players.length >= config.minPlayers) {
      // Small delay so all joining players can receive their lobby confirmation first
      setTimeout(() => {
        const gameState = startGameFromLobby(lobby.id);
        if (!gameState) return;
        io.to(lobby.id).emit('game_started', { gameId: lobby.id });
        io.to(lobby.id).emit('state_update', gameState);
        startMoveTimer(lobby.id, io);
        console.log(`[lobby] Game ${lobby.id} started with ${updatedLobby.players.length} players`);
      }, 2000);
    }
  });

  // POST /api/lobbies/:lobbyId/start — force-start (admin / testing)
  router.post('/lobbies/:lobbyId/start', (req: Request, res: Response) => {
    const { lobbyId } = req.params;
    const gameState = startGameFromLobby(lobbyId);
    if (!gameState) { res.status(400).json({ ok: false, error: 'Cannot start game' }); return; }
    io.to(lobbyId).emit('game_started', { gameId: lobbyId });
    io.to(lobbyId).emit('state_update', gameState);
    startMoveTimer(lobbyId, io);
    res.json({ ok: true, gameId: lobbyId });
  });

  // ---- Games ----
  // GET /api/games — list all games (for spectators)
  router.get('/games', (_req: Request, res: Response) => {
    const games = listGames().map(g => ({
      id: g.id,
      status: g.status,
      playerCount: g.players.length,
      alivePlayers: g.players.filter(p => !p.isEliminated).length,
      turnNumber: g.turnNumber,
      currentPlayerId: g.currentPlayerId,
      currentPhase: g.currentPhase,
      turnDeadline: g.turnDeadline,
      winner: g.winner,
      potUsd: g.potUsd,
    }));
    res.json({ ok: true, games });
  });

  // GET /api/games/:gameId — full game state (for spectators and agents)
  router.get('/games/:gameId', (req: Request, res: Response) => {
    const game = getGame(req.params.gameId);
    if (!game) { res.status(404).json({ ok: false, error: 'Game not found' }); return; }
    res.json({ ok: true, game });
  });

  // POST /api/games/:gameId/move — submit a move (REST alternative to WS)
  // Header: x-api-key: <apiKey>
  // Body: Move object
  router.post('/games/:gameId/move', (req: Request, res: Response) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) { res.status(401).json({ ok: false, error: 'Missing x-api-key header' }); return; }

    const agent = getAgentByApiKey(apiKey);
    if (!agent) { res.status(401).json({ ok: false, error: 'Invalid API key' }); return; }

    const state = getGame(req.params.gameId);
    if (!state) { res.status(404).json({ ok: false, error: 'Game not found' }); return; }

    if (state.status !== 'playing') {
      res.status(400).json({ ok: false, error: 'Game is not in playing state' }); return;
    }
    if (state.currentPlayerId !== agent.agentId) {
      res.status(403).json({ ok: false, error: 'Not your turn' }); return;
    }

    const move = req.body as Move;
    const result = applyMove(state, agent.agentId, move, config.moveTimeoutMs);

    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error }); return;
    }

    setGame(req.params.gameId, result.newState);
    clearMoveTimer(req.params.gameId);

    // Broadcast to all WebSocket spectators/agents
    for (const event of result.events) {
      io.to(req.params.gameId).emit('game_event', event);
    }
    io.to(req.params.gameId).emit('state_update', result.newState);

    if (result.newState.status === 'finished') {
      io.to(req.params.gameId).emit('game_over', {
        winner: result.newState.winner,
        potUsd: result.newState.potUsd,
      });
    } else {
      startMoveTimer(req.params.gameId, io);
    }

    res.json({ ok: true, events: result.events });
  });

  return router;
}
