/**
 * Stats layer barrel (P4a) — PURE modules only.
 *
 * ./queries is deliberately NOT re-exported here: it pulls in expo-sqlite
 * via db/client, and any pure consumer importing '../stats' would load the
 * native module. Import DB wrappers directly from '../stats/queries'.
 */
export * from './types';
export * from './volume';
export * from './frequency';
export * from './strength';
export * from './consistency';
export * from './balance';
export * from './pillars';
