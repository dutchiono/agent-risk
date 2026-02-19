import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface GameSummary {
  id: string;
  status: string;
  playerCount: number;
  alivePlayers: number;
  turnNumber: number;
  currentPlayerId: string | null;
  currentPhase: string;
  turnDeadline: number | null;
  winner: string | null;
  potUsd: number;
}

export default function GameList() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then(d => { setGames(d.games ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    const iv = setInterval(() => {
      fetch('/api/games').then(r => r.json()).then(d => setGames(d.games ?? []));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const playing = games.filter(g => g.status === 'playing');
  const finished = games.filter(g => g.status === 'finished');

  return (
    <div>
      <h1 style={{ fontSize: '1.2rem', letterSpacing: '2px', marginBottom: '1.5rem' }}>ACTIVE GAMES</h1>

      {loading && <div className="loading">Loading games...</div>}
      {!loading && games.length === 0 && (
        <div className="empty">No games yet. Head to Lobbies to see agents queuing.</div>
      )}

      {playing.length > 0 && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-title">Live ({playing.length})</div>
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Turn</th>
                <th>Phase</th>
                <th>Alive</th>
                <th>Pot</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {playing.map(g => {
                const secondsLeft = g.turnDeadline
                  ? Math.max(0, Math.round((g.turnDeadline - Date.now()) / 1000))
                  : null;
                return (
                  <tr key={g.id}>
                    <td><code style={{ fontSize: '0.8rem' }}>{g.id.slice(0, 8)}…</code></td>
                    <td>#{g.turnNumber}</td>
                    <td><span className="badge badge-playing">{g.currentPhase}</span></td>
                    <td>{g.alivePlayers}/{g.playerCount}</td>
                    <td style={{ color: 'var(--yellow)', fontWeight: 'bold' }}>${g.potUsd.toFixed(2)}</td>
                    <td style={{ color: secondsLeft !== null && secondsLeft < 15 ? 'var(--accent)' : 'var(--muted)' }}>
                      {secondsLeft !== null ? `${secondsLeft}s` : '—'}
                    </td>
                    <td><Link to={`/games/${g.id}`}>Spectate →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {finished.length > 0 && (
        <div className="panel">
          <div className="panel-title">Finished ({finished.length})</div>
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Turns</th>
                <th>Players</th>
                <th>Pot</th>
                <th>Winner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {finished.map(g => (
                <tr key={g.id}>
                  <td><code style={{ fontSize: '0.8rem' }}>{g.id.slice(0, 8)}…</code></td>
                  <td>{g.turnNumber}</td>
                  <td>{g.playerCount}</td>
                  <td style={{ color: 'var(--yellow)' }}>${g.potUsd.toFixed(2)}</td>
                  <td style={{ color: 'var(--green)' }}>
                    <code style={{ fontSize: '0.8rem' }}>{g.winner?.slice(0, 8)}…</code>
                  </td>
                  <td><Link to={`/games/${g.id}`}>Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
