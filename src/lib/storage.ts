"use client";

import type { Deck } from "./schema";

const DECKS_KEY = "studytok.decks.v1";
const SETTINGS_KEY = "studytok.settings.v1";

export interface Settings {
  quizEvery: number; // 0 = off
  speed: number; // playback rate
  sound: boolean;
  autoNext: boolean; // false = loop each card
  captions: boolean;
  shuffle: boolean;
  retryWrong: boolean;
  cardCount: number; // concepts per upload
}

export const DEFAULT_SETTINGS: Settings = {
  quizEvery: 3,
  speed: 1,
  sound: true,
  autoNext: false,
  captions: true,
  shuffle: false,
  retryWrong: true,
  cardCount: 8,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadDecks(): Deck[] {
  const decks = read<Deck[]>(DECKS_KEY, []);
  return Array.isArray(decks) ? decks.filter((d) => d && Array.isArray(d.cards)) : [];
}

export function saveDeck(deck: Deck) {
  if (deck.sample) return;
  const decks = loadDecks().filter((d) => d.id !== deck.id);
  decks.unshift(deck);
  // keep storage bounded: drop oldest decks if the quota is hit
  while (!write(DECKS_KEY, decks) && decks.length > 1) decks.pop();
}

export function deleteDeck(id: string) {
  write(
    DECKS_KEY,
    loadDecks().filter((d) => d.id !== id),
  );
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
