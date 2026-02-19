import {
  GameState, Player, TerritoryState, TurnPhase, Move, MoveResult,
  ReinforceMove, AttackMove, FortifyMove, TurnInCardsMove,
  GameEvent, Card, CardSymbol, PlayerId, TerritoryId,
} from './types';
import { TERRITORIES, TERRITORY_MAP, CONTINENT_BONUSES, CONTINENT_TERRITORIES, areNeighbors } from './territories';
import { resolveCombat } from './combat';

// ---- Card set trade-in values (standard escalating) ----
const CARD_SET_VALUES = [4, 6, 8, 10, 12, 15];
function cardSetValue(setsTurnedIn: number): number {
  if (setsTurnedIn < CARD_SET_VALUES.length) return CARD_SET_VALUES[setsTurnedIn];
  return 15 + (setsTurnedIn - 5) * 5;
}

// ---- Helpers ----
function ts(): number { return Date.now(); }

function mkEvent(type: GameEvent['type'], playerId: string | undefined, data: Record<string, unknown>): GameEvent {
  return { type, playerId, data, timestamp: ts() };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const symbols: CardSymbol[] = ['infantry', 'cavalry', 'artillery'];
  const cards: Card[] = TERRITORIES.map((t, i) => ({
    id: `card_${t.id}`,
    symbol: symbols[i % 3],
    territory: t.id,
  }));
  // 2 wild cards
  cards.push({ id: 'wild_1', symbol: 'wild', territory: null });
  cards.push({ id: 'wild_2', symbol: 'wild', territory: null });
  return shuffle(cards);
}

function calcReinforcements(state: GameState, playerId: PlayerId): number {
  const owned = Object.values(state.territories).filter(t => t.owner === playerId);
  let bonus = Math.max(3, Math.floor(owned.length / 3));

  for (const [continent, territories] of Object.entries(CONTINENT_TERRITORIES)) {
    if (territories.every(tid => state.territories[tid]?.owner === playerId)) {
      bonus += CONTINENT_BONUSES[continent] ?? 0;
    }
  }
  return bonus;
}

function isValidCardSet(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const symbols = cards.map(c => c.symbol);
  // wild counts as anything
  const wilds = symbols.filter(s => s === 'wild').length;
  const nonWild = symbols.filter(s => s !== 'wild');
  // all same
  if (nonWild.every(s => s === nonWild[0])) return true;
  // all different
  const unique = new Set(nonWild);
  if (unique.size === nonWild.length && nonWild.length + wilds === 3) return true;
  // wilds make up the difference
  if (wilds >= 1) return true;
  return false;
}

function nextAlivePlayer(state: GameState, currentId: PlayerId): PlayerId {
  const alive = state.players.filter(p => !p.isEliminated);
  const idx = alive.findIndex(p => p.id === currentId);
  return alive[(idx + 1) % alive.length].id;
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ---- Factory ----

export function createGame(params: {
  id: string;
  players: Array<{ id: string; name: string; isAgent: boolean }>;
  entryFeeUsd: number;
  moveTimeoutMs: number;
}): GameState {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  const players: Player[] = params.players.map((p, i) => ({
    ...p,
    color: colors[i % colors.length],
    isEliminated: false,
    cardsHeld: [],
  }));

  const territories: Record<TerritoryId, TerritoryState> = {};
  for (const t of TERRITORIES) {
    territories[t.id] = { id: t.id, owner: null, armies: 0 };
  }

  return {
    id: params.id,
    status: 'setup',
    players,
    territories,
    currentPlayerId: null,
    currentPhase: 'reinforce',
    turnNumber: 0,
    reinforcementsRemaining: 0,
    conqueredThisTurn: false,
    cardSetsTurnedIn: 0,
    turnDeadline: null,
    log: [],
    winner: null,
    entryFeeUsd: params.entryFeeUsd,
    potUsd: params.entryFeeUsd * params.players.length,
  };
}

// ---- Setup phase: randomly distribute territories ----

export function setupGame(state: GameState, moveTimeoutMs: number): GameState {
  const s = deepClone(state);
  const shuffledTerritories = shuffle(TERRITORIES.map(t => t.id));
  const playerCount = s.players.length;

  // Distribute territories round-robin
  shuffledTerritories.forEach((tid, i) => {
    s.territories[tid].owner = s.players[i % playerCount].id;
    s.territories[tid].armies = 1;
  });

  // Each player starts with initial armies based on player count
  const initialArmies: Record<number, number> = { 2: 40, 3: 35, 4: 30, 5: 25, 6: 20 };
  const startingArmies = initialArmies[playerCount] ?? 20;

  // Place remaining armies randomly on owned territories
  for (const player of s.players) {
    const owned = Object.values(s.territories).filter(t => t.owner === player.id);
    const alreadyPlaced = owned.length; // 1 per territory
    let toPlace = startingArmies - alreadyPlaced;
    while (toPlace > 0) {
      const t = owned[Math.floor(Math.random() * owned.length)];
      s.territories[t.id].armies++;
      toPlace--;
    }
  }

  s.status = 'playing';
  s.currentPlayerId = s.players[0].id;
  s.currentPhase = 'reinforce';
  s.turnNumber = 1;
  s.reinforcementsRemaining = calcReinforcements(s, s.players[0].id);
  s.turnDeadline = Date.now() + moveTimeoutMs;
  s.log.push(mkEvent('game_started', undefined, { playerCount, startingArmies }));
  s.log.push(mkEvent('setup_complete', undefined, {}));

  return s;
}

// ---- Main move processor ----

export function applyMove(
  state: GameState,
  playerId: PlayerId,
  move: Move,
  moveTimeoutMs: number,
): MoveResult {
  if (state.status !== 'playing') return err(state, 'Game is not in playing state');
  if (state.currentPlayerId !== playerId) return err(state, 'Not your turn');

  // Route to phase handler
  if ('turnInCards' in move) return applyTurnInCards(state, playerId, move as TurnInCardsMove, moveTimeoutMs);
  if (move.phase === 'reinforce') return applyReinforce(state, playerId, move as ReinforceMove, moveTimeoutMs);
  if (move.phase === 'attack') return applyAttack(state, playerId, move as AttackMove, moveTimeoutMs);
  if (move.phase === 'fortify') return applyFortify(state, playerId, move as FortifyMove, moveTimeoutMs);

  return err(state, 'Unknown move type');
}

// ---- Turn-in cards ----

function applyTurnInCards(state: GameState, playerId: PlayerId, move: TurnInCardsMove, moveTimeoutMs: number): MoveResult {
  if (state.currentPhase !== 'reinforce') return err(state, 'Can only turn in cards during reinforce phase');
  const s = deepClone(state);
  const player = s.players.find(p => p.id === playerId)!;
  const cardIds = new Set(move.turnInCards);
  const cards = player.cardsHeld.filter(c => cardIds.has(c.id));

  if (cards.length !== 3) return err(state, 'Must turn in exactly 3 cards');
  if (!isValidCardSet(cards)) return err(state, 'Invalid card set');

  const bonus = cardSetValue(s.cardSetsTurnedIn);
  s.cardSetsTurnedIn++;
  player.cardsHeld = player.cardsHeld.filter(c => !cardIds.has(c.id));
  s.reinforcementsRemaining += bonus;

  // Bonus: if player owns a territory on a turned-in card, +2 armies to that territory
  for (const card of cards) {
    if (card.territory && s.territories[card.territory]?.owner === playerId) {
      s.territories[card.territory].armies += 2;
    }
  }

  const events = [mkEvent('cards_turned_in', playerId, { bonus, cardIds: move.turnInCards })];
  s.log.push(...events);
  return { ok: true, events, newState: s };
}

// ---- Reinforce ----

function applyReinforce(state: GameState, playerId: PlayerId, move: ReinforceMove, moveTimeoutMs: number): MoveResult {
  if (state.currentPhase !== 'reinforce') return err(state, 'Not reinforce phase');
  if (move.armies < 1) return err(state, 'Must place at least 1 army');
  if (move.armies > state.reinforcementsRemaining) return err(state, 'Not enough reinforcements');

  const territory = state.territories[move.territory];
  if (!territory) return err(state, 'Invalid territory');
  if (territory.owner !== playerId) return err(state, 'You do not own that territory');

  const s = deepClone(state);
  s.territories[move.territory].armies += move.armies;
  s.reinforcementsRemaining -= move.armies;

  const events: GameEvent[] = [mkEvent('reinforced', playerId, {
    territory: move.territory,
    armies: move.armies,
    remaining: s.reinforcementsRemaining,
  })];

  // Auto-advance to attack phase when reinforcements exhausted
  if (s.reinforcementsRemaining === 0) {
    s.currentPhase = 'attack';
    s.turnDeadline = Date.now() + moveTimeoutMs;
  }

  s.log.push(...events);
  return { ok: true, events, newState: s };
}

// ---- Attack ----

function applyAttack(state: GameState, playerId: PlayerId, move: AttackMove, moveTimeoutMs: number): MoveResult {
  if (state.currentPhase !== 'attack') return err(state, 'Not attack phase');

  // Player can choose to end attack phase
  if (move.endAttack) {
    const s = deepClone(state);
    // Award card if conquered at least one territory
    if (s.conqueredThisTurn) {
      const deck = buildDeck();
      const card = deck[Math.floor(Math.random() * deck.length)];
      s.players.find(p => p.id === playerId)!.cardsHeld.push(card);
    }
    s.currentPhase = 'fortify';
    s.turnDeadline = Date.now() + moveTimeoutMs;
    const events = [mkEvent('turn_changed', playerId, { phase: 'fortify' })];
    s.log.push(...events);
    return { ok: true, events, newState: s };
  }

  const from = state.territories[move.from];
  const to = state.territories[move.to];
  if (!from || !to) return err(state, 'Invalid territory');
  if (from.owner !== playerId) return err(state, 'You do not own the attacking territory');
  if (to.owner === playerId) return err(state, 'Cannot attack your own territory');
  if (!areNeighbors(move.from, move.to)) return err(state, 'Territories are not adjacent');
  if (from.armies < 2) return err(state, 'Need at least 2 armies to attack');
  if (move.armies < 1 || move.armies > 3) return err(state, 'Must attack with 1–3 armies');
  if (move.armies >= from.armies) return err(state, 'Must leave at least 1 army behind');

  const s = deepClone(state);
  const result = resolveCombat(move.armies, to.armies);

  s.territories[move.from].armies -= result.attackerLosses;
  s.territories[move.to].armies -= result.defenderLosses;

  const events: GameEvent[] = [mkEvent('attacked', playerId, {
    from: move.from,
    to: move.to,
    attackerArmies: move.armies,
    attackerDice: result.attackerDice,
    defenderDice: result.defenderDice,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
  })];

  // Territory captured
  if (s.territories[move.to].armies <= 0) {
    const previousOwner = to.owner!;
    s.territories[move.to].owner = playerId;
    // Move attacking armies in (at least move.armies - losses, up to attacker discretion — auto move all)
    const movingIn = move.armies - result.attackerLosses;
    s.territories[move.from].armies -= movingIn;
    s.territories[move.to].armies = movingIn;
    s.conqueredThisTurn = true;

    events.push(mkEvent('territory_captured', playerId, {
      territory: move.to,
      from: move.from,
      previousOwner,
      armiesMoved: movingIn,
    }));

    // Check if previous owner is eliminated
    const stillOwns = Object.values(s.territories).some(t => t.owner === previousOwner);
    if (!stillOwns) {
      const eliminatedPlayer = s.players.find(p => p.id === previousOwner)!;
      eliminatedPlayer.isEliminated = true;
      // Transfer cards
      const transferredCards = [...eliminatedPlayer.cardsHeld];
      eliminatedPlayer.cardsHeld = [];
      s.players.find(p => p.id === playerId)!.cardsHeld.push(...transferredCards);

      events.push(mkEvent('player_eliminated', playerId, {
        eliminatedPlayerId: previousOwner,
        cardsTransferred: transferredCards.length,
      }));

      // Check victory
      const alivePlayers = s.players.filter(p => !p.isEliminated);
      if (alivePlayers.length === 1) {
        s.status = 'finished';
        s.winner = playerId;
        s.currentPlayerId = null;
        s.turnDeadline = null;
        events.push(mkEvent('game_over', playerId, { winner: playerId, potUsd: s.potUsd }));
        s.log.push(...events);
        return { ok: true, events, newState: s };
      }
    }
  }

  s.turnDeadline = Date.now() + moveTimeoutMs;
  s.log.push(...events);
  return { ok: true, events, newState: s };
}

// ---- Fortify ----

function applyFortify(state: GameState, playerId: PlayerId, move: FortifyMove, moveTimeoutMs: number): MoveResult {
  if (state.currentPhase !== 'fortify') return err(state, 'Not fortify phase');

  const s = deepClone(state);

  if (!move.skip) {
    const from = state.territories[move.from];
    const to = state.territories[move.to];
    if (!from || !to) return err(state, 'Invalid territory');
    if (from.owner !== playerId || to.owner !== playerId) return err(state, 'Must own both territories');
    if (!areConnected(state.territories, move.from, move.to, playerId)) {
      return err(state, 'Territories must be connected through your own territories');
    }
    if (move.armies < 1 || move.armies >= from.armies) {
      return err(state, 'Invalid army count — must leave at least 1 behind');
    }
    s.territories[move.from].armies -= move.armies;
    s.territories[move.to].armies += move.armies;
  }

  const events: GameEvent[] = [mkEvent('fortified', playerId, {
    from: move.from,
    to: move.to,
    armies: move.skip ? 0 : move.armies,
    skipped: !!move.skip,
  })];

  // Advance turn
  const nextPlayer = nextAlivePlayer(s, playerId);
  s.currentPlayerId = nextPlayer;
  s.currentPhase = 'reinforce';
  s.turnNumber++;
  s.conqueredThisTurn = false;
  s.reinforcementsRemaining = calcReinforcements(s, nextPlayer);
  s.turnDeadline = Date.now() + moveTimeoutMs;

  events.push(mkEvent('turn_changed', nextPlayer, {
    turnNumber: s.turnNumber,
    phase: 'reinforce',
    reinforcements: s.reinforcementsRemaining,
  }));

  s.log.push(...events);
  return { ok: true, events, newState: s };
}

// ---- Timeout handler (called by server when deadline passes) ----

export function applyTimeout(state: GameState, moveTimeoutMs: number): MoveResult {
  if (state.status !== 'playing' || !state.currentPlayerId) {
    return err(state, 'No active player to time out');
  }

  const playerId = state.currentPlayerId;
  const s = deepClone(state);
  const events: GameEvent[] = [mkEvent('move_timeout', playerId, { phase: s.currentPhase })];

  // Eliminate the timed-out player
  const player = s.players.find(p => p.id === playerId)!;
  player.isEliminated = true;

  // Their territories revert to neutral (0 armies = easy pickings)
  for (const t of Object.values(s.territories)) {
    if (t.owner === playerId) {
      t.owner = null;
      t.armies = 1;
    }
  }

  events.push(mkEvent('player_eliminated', undefined, {
    eliminatedPlayerId: playerId,
    reason: 'timeout',
  }));

  const alivePlayers = s.players.filter(p => !p.isEliminated);
  if (alivePlayers.length === 1) {
    s.status = 'finished';
    s.winner = alivePlayers[0].id;
    s.currentPlayerId = null;
    s.turnDeadline = null;
    events.push(mkEvent('game_over', alivePlayers[0].id, {
      winner: alivePlayers[0].id,
      potUsd: s.potUsd,
    }));
    s.log.push(...events);
    return { ok: true, events, newState: s };
  }

  // Advance to next player
  const nextPlayer = nextAlivePlayer(s, playerId);
  s.currentPlayerId = nextPlayer;
  s.currentPhase = 'reinforce';
  s.turnNumber++;
  s.conqueredThisTurn = false;
  s.reinforcementsRemaining = calcReinforcements(s, nextPlayer);
  s.turnDeadline = Date.now() + moveTimeoutMs;

  s.log.push(...events);
  return { ok: true, events, newState: s };
}

// ---- BFS to check if two territories are connected through owned tiles ----

function areConnected(
  territories: Record<TerritoryId, TerritoryState>,
  from: TerritoryId,
  to: TerritoryId,
  owner: PlayerId,
): boolean {
  const visited = new Set<TerritoryId>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const def = TERRITORY_MAP[current];
    if (!def) continue;
    for (const neighbor of def.neighbors) {
      if (!visited.has(neighbor) && territories[neighbor]?.owner === owner) {
        queue.push(neighbor);
      }
    }
  }
  return false;
}

// ---- Error helper ----

function err(state: GameState, error: string): MoveResult {
  return { ok: false, error, events: [], newState: state };
}