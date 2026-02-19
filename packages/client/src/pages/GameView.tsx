import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import type { GameState, GameEvent, Player, TerritoryState } from '@agent-risk/engine';
import { TERRITORIES } from '@agent-risk/engine';

// ---- Territory circle radius ----
const R = 18;

// ---- Color helpers ----
function playerColor(players: Player[], ownerId: string | null): string {
  if (!ownerId) return '#333';
  return players.find(p => p.id === ownerId)?.color ?? '#555';
}

// ---- Board SVG ----
function RiskBoard({ game }: { game: GameState }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { players, territories, currentPlayerId } = game;

  return (
    <svg
      viewBox="0 0 900 520"
      className="board-svg"
      style={{ background: '#0d1117' }}
    >
      {/* Connections */}
      {TERRITORIES.map(t =>
        t.neighbors.map(nid => {
          const n = TERRITORIES.find(x => x.id === nid);
          if (!n || n.id < t.id) return null; // draw once per pair
          return (
            <line
              key={`${t.id}-${nid}`}
              x1={t.x} y1={t.y} x2={n.x} y2={n.y}
              stroke="#2a2a3a" strokeWidth={1}
            />
          );
        })
      )}

      {/* Territory circles */}
      {TERRITORIES.map(t => {
        const ts: TerritoryState = territories[t.id];
        const fill = ts ? playerColor(players, ts.owner) : '#333';
        const isHovered = hovered === t.id;
        const isActive = ts?.owner === currentPlayerId;
        return (
          <g key={t.id}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <circle
              cx={t.x} cy={t.y} r={isHovered ? R + 3 : R}
              fill={fill}
              stroke={isActive ? '#f39c12' : isHovered ? '#fff' : '#1a1a2e'}
              strokeWidth={isActive ? 2.5 : 1.5}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
            />
            {/* Army count */}
            <text x={t.x} y={t.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={ts?.armies >= 10 ? 9 : 11} fill="#fff" fontWeight="bold"
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {ts?.armies ?? 0}
            </text>
            {/* Territory name on hover */}
            {isHovered && (
              <text x={t.x} y={t.y - R - 6} textAnchor="middle"
                fontSize={9} fill="#e0e0e0" className="territory-label">
                {t.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Turn timer bar ----
function TimerBar({ deadline, timeoutMs }: { deadline: number | null; timeoutMs: number }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    if (!deadline) { setPct(100); return; }
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setPct((remaining / timeoutMs) * 100);
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [deadline, timeoutMs]);

  const color = pct > 50 ? '#2ecc71' : pct > 20 ? '#f39c12' : '#e74c3c';
  return (
    <div className="timer-bar-wrap">
      <div className="timer-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ---- Player sidebar ----
function PlayerSidebar({ game }: { game: GameState }) {
  const territoryCount = (pid: string) =>
    Object.values(game.territories).filter(t => t.owner === pid).length;
  const armyCount = (pid: string) =>
    Object.values(game.territories).filter(t => t.owner === pid).reduce((s, t) => s + t.armies, 0);

  return (
    <div className="panel">
      <div className="panel-title">Players</div>
      {game.players.map(p => {
        const isActive = p.id === game.currentPlayerId;
        return (
          <div key={p.id} className="player-row">
            <div className="player-color" style={{ background: p.color }} />
            <div style={{ flex: 1 }}>
              <div className={`player-name ${p.isEliminated ? 'player-eliminated' : ''} ${isActive ? 'player-active' : ''}`}>
                {p.name} {isActive && !p.isEliminated ? '▶' : ''} {p.isEliminated ? '✗' : ''}
              </div>
              {!p.isEliminated && (
                <div className="player-territories">
                  {territoryCount(p.id)} territories · {armyCount(p.id)} armies
                </div>
              )}
            </div>
            {!p.isEliminated && (
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {p.cardsHeld.length} cards
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Event log ----
function EventLog({ events }: { events: GameEvent[] }) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events]);

  function describe(e: GameEvent): string {
    const d = e.data as Record<string, unknown>;
    switch (e.type) {
      case 'game_started': return `Game started with ${d.playerCount} players`;
      case 'reinforced': return `${e.playerId?.slice(0,6)} placed ${d.armies} armies on ${d.territory}`;
      case 'attacked': return `${e.playerId?.slice(0,6)} attacked ${d.to} from ${d.from} — atk lost ${d.attackerLosses}, def lost ${d.defenderLosses}`;
      case 'territory_captured': return `${e.playerId?.slice(0,6)} captured ${d.territory}!`;
      case 'player_eliminated': return `Player ${(d.eliminatedPlayerId as string)?.slice(0,6)} eliminated${d.reason ? ` (${d.reason})` : ''}`;
      case 'fortified': return `${e.playerId?.slice(0,6)} fortified ${d.armies} armies to ${d.to}`;
      case 'cards_turned_in': return `${e.playerId?.slice(0,6)} turned in cards for +${d.bonus} armies`;
      case 'turn_changed': return `Turn ${d.turnNumber ?? ''} — ${d.phase} phase`;
      case 'move_timeout': return `TIMEOUT: ${e.playerId?.slice(0,6)} timed out in ${d.phase} phase`;
      case 'game_over': return `GAME OVER — Winner: ${(d.winner as string)?.slice(0,8)} — Pot: $${d.potUsd}`;
      default: return e.type;
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Event Log</div>
      <ul className="log-list">
        {events.slice(-80).map((e, i) => (
          <li key={i}><span>{describe(e)}</span></li>
        ))}
        <li ref={endRef} />
      </ul>
    </div>
  );
}

// ---- Main GameView ----
export default function GameView() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const MOVE_TIMEOUT_MS = 60_000;

  const handleEvent = useCallback((event: GameEvent) => {
    setGame(prev => {
      if (!prev) return prev;
      return { ...prev, log: [...prev.log, event] };
    });
  }, []);

  const handleState = useCallback((state: GameState) => {
    setGame(state);
  }, []);

  useEffect(() => {
    if (!gameId) return;

    // Initial fetch
    fetch(`/api/games/${gameId}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setGame(d.game);
        else setError(d.error);
      })
      .catch(() => setError('Failed to load game'));

    // WebSocket for live updates
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_game', { gameId });
    });
    socket.on('state_update', handleState);
    socket.on('game_event', handleEvent);
    socket.on('game_over', (data: { winner: string; potUsd: number }) => {
      setGame(prev => prev ? { ...prev, status: 'finished', winner: data.winner } : prev);
    });

    return () => { socket.disconnect(); };
  }, [gameId, handleState, handleEvent]);

  if (error) return (
    <div>
      <Link to="/games">← Back to Games</Link>
      <div className="empty" style={{ marginTop: '2rem' }}>Error: {error}</div>
    </div>
  );

  if (!game) return <div className="loading">Loading game...</div>;

  const secondsLeft = game.turnDeadline
    ? Math.max(0, Math.round((game.turnDeadline - Date.now()) / 1000))
    : null;

  const currentPlayer = game.players.find(p => p.id === game.currentPlayerId);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link to="/games">← Games</Link>
        <code style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{game.id}</code>
        <span className={`badge badge-${game.status}`}>{game.status}</span>
        {game.status === 'finished' && game.winner && (
          <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>
            Winner: {game.players.find(p => p.id === game.winner)?.name ?? game.winner.slice(0, 8)}
          </span>
        )}
      </div>

      <div className="game-layout">
        {/* Board */}
        <div>
          {/* Turn info bar */}
          {game.status === 'playing' && currentPlayer && (
            <div className="panel" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Turn {game.turnNumber}</div>
                <div style={{ fontWeight: 'bold' }}>
                  <span style={{ color: currentPlayer.color }}>■</span> {currentPlayer.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Phase</div>
                <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{game.currentPhase}</div>
              </div>
              {game.currentPhase === 'reinforce' && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>To Place</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--yellow)' }}>{game.reinforcementsRemaining}</div>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Time left: {secondsLeft ?? '—'}s
                </div>
                <TimerBar deadline={game.turnDeadline} timeoutMs={MOVE_TIMEOUT_MS} />
              </div>
            </div>
          )}

          <div className="board-container">
            <RiskBoard game={game} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="panel">
            <div className="pot-label">Prize Pot</div>
            <div className="pot-display">${game.potUsd.toFixed(2)}</div>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
              ${game.entryFeeUsd.toFixed(2)} entry · {game.players.length} players
            </div>
          </div>

          <PlayerSidebar game={game} />
          <EventLog events={game.log} />
        </div>
      </div>
    </div>
  );
}