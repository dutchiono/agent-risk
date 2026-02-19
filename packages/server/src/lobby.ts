import { v4 as uuidv4 } from 'uuid';
import { GameState, PlayerId } from '@agent-risk/engine';
import { createGame, setupGame } from '@agent-risk/engine';
import { config } from './config';

export interface LobbyEntry {
  id: string;
  players: Array<{ id: PlayerId; name: string; isAgent: boolean; apiKey: string }>;
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  createdAt: number;
}

export interface AgentRegistration {
  agentId: string;
  name: string;
  apiKey: string;
  registeredAt: number;
}

// In-memory stores (replace with DB for production)
const lobbies = new Map<string, LobbyEntry>();
const games = new Map<string, GameState>();
const agents = new Map<string, AgentRegistration>(); // apiKey -> registration
const apiKeyToAgentId = new Map<string, string>();

// ---- Agent registration ----

export function registerAgent(name: string): AgentRegistration {
  const agentId = uuidv4();
  const apiKey = `ar_${uuidv4().replace(/-/g, '')}`;
  const reg: AgentRegistration = { agentId, name, apiKey, registeredAt: Date.now() };
  agents.set(apiKey, reg);
  apiKeyToAgentId.set(apiKey, agentId);
  return reg;
}

export function getAgentByApiKey(apiKey: string): AgentRegistration | undefined {
  return agents.get(apiKey);
}

// ---- Lobby management ----

export function getOrCreateOpenLobby(): LobbyEntry {
  for (const lobby of lobbies.values()) {
    if (lobby.status === 'waiting' && lobby.players.length < config.maxPlayers) {
      return lobby;
    }
  }
  const lobby: LobbyEntry = {
    id: uuidv4(),
    players: [],
    status: 'waiting',
    createdAt: Date.now(),
  };
  lobbies.set(lobby.id, lobby);
  return lobby;
}

export function joinLobby(
  lobbyId: string,
  player: { id: PlayerId; name: string; isAgent: boolean; apiKey: string }
): { ok: boolean; error?: string; lobby?: LobbyEntry } {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return { ok: false, error: 'Lobby not found' };
  if (lobby.status !== 'waiting') return { ok: false, error: 'Lobby not open' };
  if (lobby.players.length >= config.maxPlayers) return { ok: false, error: 'Lobby full' };
  if (lobby.players.find(p => p.id === player.id)) return { ok: false, error: 'Already in lobby' };

  lobby.players.push(player);
  return { ok: true, lobby };
}

export function getLobby(lobbyId: string): LobbyEntry | undefined {
  return lobbies.get(lobbyId);
}

export function listLobbies(): LobbyEntry[] {
  return Array.from(lobbies.values());
}

// ---- Game management ----

export function startGameFromLobby(lobbyId: string): GameState | null {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || lobby.players.length < config.minPlayers) return null;

  lobby.status = 'starting';

  const state = createGame({
    id: lobbyId,
    players: lobby.players.map(p => ({ id: p.id, name: p.name, isAgent: p.isAgent })),
    entryFeeUsd: config.entryFeeUsd,
    moveTimeoutMs: config.moveTimeoutMs,
  });

  const started = setupGame(state, config.moveTimeoutMs);
  lobby.status = 'playing';
  games.set(lobbyId, started);
  return started;
}

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function setGame(gameId: string, state: GameState): void {
  games.set(gameId, state);
  if (state.status === 'finished') {
    const lobby = lobbies.get(gameId);
    if (lobby) lobby.status = 'finished';
  }
}

export function listGames(): GameState[] {
  return Array.from(games.values());
}

export function getPlayerApiKey(gameId: string, playerId: string): string | undefined {
  const lobby = lobbies.get(gameId);
  return lobby?.players.find(p => p.id === playerId)?.apiKey;
}

export function resolvePlayerFromApiKey(apiKey: string): AgentRegistration | undefined {
  return agents.get(apiKey);
}
