import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import LobbyList from './pages/LobbyList';
import GameList from './pages/GameList';
import GameView from './pages/GameView';
import './styles.css';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">⚔ AGENT RISK</Link>
        <nav className="nav">
          <Link to="/">Lobbies</Link>
          <Link to="/games">Games</Link>
        </nav>
        <div className="header-meta">
          <span className="fee-badge">$1 entry · winner takes all</span>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<LobbyList />} />
          <Route path="/games" element={<GameList />} />
          <Route path="/games/:gameId" element={<GameView />} />
        </Routes>
      </main>
    </div>
  );
}
