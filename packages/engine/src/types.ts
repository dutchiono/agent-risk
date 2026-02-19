export type TerritoryId = string;
export type PlayerId = string;

export type Continent =
  | 'north_america'
  | 'south_america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'australia';

export interface TerritoryDefinition {
  id: TerritoryId;
  name: string;
  continent: Continent;
  neighbors: TerritoryId[];
  // SVG center coords for the client
  x: number;
  y: number;
}

export interface TerritoryState {
  id: TerritoryId;
  owner: PlayerId | null;
  armies: number;
}

export type TurnPhase = 'reinforce' | 'attack' | 'fortify';

export type GameStatus = 'lobby' | 'setup' | 'playing' | 'finished';

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  isEliminated: boolean;
  isAgent: boolean; // true = AI agent, false = human spectator-controlled
  cardsHeld: Card[];
}

export type CardSymbol = 'infantry' | 'cavalry' | 'artillery' | 'wild';

export interface Card {
  id: string;
  symbol: CardSymbol;
  territory: TerritoryId | null; // null for wild cards
}

export interface GameState {
  id: string;
  status: GameStatus;
  players: Player[];
  territories: Record<TerritoryId, TerritoryState>;
  currentPlayerId: PlayerId | null;
  currentPhase: TurnPhase;
  turnNumber: number;
  // armies the current player still has to place this reinforce phase
  reinforcementsRemaining: number;
  // whether current player has conquered at least one territory this turn (earns a card)
  conqueredThisTurn: boolean;
  cardSetsTurnedIn: number;
  turnDeadline: number | null; // unix ms, null if not started
  log: GameEvent[];
  winner: PlayerId | null;
  entryFeeUsd: number;
  potUsd: number;
}

export type GameEventType =
  | 'game_started'
  | 'setup_complete'
  | 'reinforced'
  | 'attacked'
  | 'territory_captured'
  | 'player_eliminated'
  | 'fortified'
  | 'cards_turned_in'
  | 'turn_changed'
  | 'move_timeout'
  | 'game_over';

export interface GameEvent {
  type: GameEventType;
  playerId?: PlayerId;
  data: Record<string, unknown>;
  timestamp: number;
}

// ---- Move types ----

export interface ReinforceMove {
  phase: 'reinforce';
  territory: TerritoryId;
  armies: number;
}

export interface AttackMove {
  phase: 'attack';
  from: TerritoryId;
  to: TerritoryId;
  armies: number; // 1-3 attacking dice
  endAttack?: boolean; // pass true to stop attacking and move to fortify
}

export interface FortifyMove {
  phase: 'fortify';
  from: TerritoryId;
  to: TerritoryId;
  armies: number;
  skip?: boolean; // pass true to skip fortify
}

export interface TurnInCardsMove {
  phase: 'reinforce';
  turnInCards: string[]; // card ids — exactly 3
}

export type Move = ReinforceMove | AttackMove | FortifyMove | TurnInCardsMove;

export interface MoveResult {
  ok: boolean;
  error?: string;
  events: GameEvent[];
  newState: GameState;
}

export interface AttackResult {
  attackerLosses: number;
  defenderLosses: number;
  attackerDice: number[];
  defenderDice: number[];
}
