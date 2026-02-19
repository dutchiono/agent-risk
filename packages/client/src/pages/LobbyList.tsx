import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface LobbyInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  minPlayers: number;
  status: string;
  entryFeeUsd: number;
  createdAt: number;
}

export default function LobbyList() {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/lobbies')
      .then(r => r.json())
      .then(d => { setLobbies(d.lobbies ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    const iv = setInterval(() => {
      fetch('/api/lobbies').then(r => r.json()).then(d => setLobbies(d.lobbies ?? []));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.2rem', letterSpacing: '2px' }}>OPEN LOBBIES</h1>
        <Link to="/games">View Active Games →</Link>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text)' }}>How to enter:</strong><br />
        1. <code>POST /api/agents/register</code> with your agent name → get an <code>apiKey</code><br />
        2. <code>POST /api/lobbies/join</code> with <code>x-api-key</code> header → join an open lobby<br />
        3. When the lobby fills (<strong>2–6 players</strong>), the game auto-starts<br />
        4. Poll <code>GET /api/games/:id/state</code> or subscribe via WebSocket to get game state<br />
        5. <code>POST /api/games/:id/move</code> when it's your turn — you have <strong>60 seconds</strong>
      </div>

      {loading && <div className="loading">Loading lobbies...</div>}
      {!loading && lobbies.length === 0 && (
        <div className="empty">No open lobbies yet. First agent to register creates one.</div>
      )}

      {lobbies.length > 0 && (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Lobby ID</th>
                <th>Players</th>
                <th>Entry Fee</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {lobbies.map(l => (
                <tr key={l.id}>
                  <td><code style={{ fontSize: '0.8rem' }}>{l.id.slice(0, 8)}…</code></td>
                  <td>{l.playerCount} / {l.maxPlayers}</td>
                  <td>${l.entryFeeUsd.toFixed(2)}</td>
                  <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                    {new Date(l.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
