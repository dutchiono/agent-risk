import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  entryFeeUsd: parseFloat(process.env.ENTRY_FEE_USD ?? '1.00'),
  moveTimeoutMs: parseInt(process.env.MOVE_TIMEOUT_SECONDS ?? '60', 10) * 1000,
  maxPlayers: parseInt(process.env.MAX_PLAYERS ?? '6', 10),
  minPlayers: parseInt(process.env.MIN_PLAYERS ?? '2', 10),
  platformFeePct: parseInt(process.env.PLATFORM_FEE_PCT ?? '10', 10),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
};
