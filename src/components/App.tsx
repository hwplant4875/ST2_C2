"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getHealth } from "@/lib/api";
import { regenerateCard, startJob, type JobHandle, type JobState } from "@/lib/generate";
import { SAMPLE_DECK } from "@/lib/samples";
import type { Deck } from "@/lib/schema";
import { unlockAudio } from "@/lib/sfx";
import { deleteDeck, loadDecks, loadSettings, saveDeck, saveSettings, type Settings } from "@/lib/storage";
import Feed from "./Feed";
import Home from "./Home";
import Library from "./Library";
import Loading from "./Loading";
import { PhoneFrame } from "./ui";

type Screen = "home" | "library" | "loading" | "feed";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [openDeck, setOpenDeck] = useState<Deck | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const handle = useRef<JobHandle | null>(null);
  const lastFiles = useRef<File[]>([]);
  const screenRef = useRef<Screen>("home");
  screenRef.current = screen;

  useEffect(() => {
    getHealth().then((h) => setApiReady(h ? h.hasKey || h.mock : null));
    // warm up fonts used by the motion renderer
    try {
      void document.fonts?.load("400 40px Jua", "가나다API");
      void document.fonts?.load("800 40px 'Pretendard Variable'", "가나다");
    } catch {}
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  };

  const refreshDecks = () => setDecks(loadDecks());

  const begin = useCallback(
    (files: File[]) => {
      unlockAudio();
      handle.current?.cancel();
      lastFiles.current = files;
      setScreen("loading");
      handle.current = startJob(files, settings.cardCount, (s) => {
        setJob(s);
        const jd = s.deck;
        if (jd) {
          // keep the open feed in sync while cards are still being generated (keep quiz notes)
          setOpenDeck((d) => (d && d.id === jd.id ? { ...jd, wrong: d.wrong } : d));
        }
        if (s.phase === "done" && jd) {
          if (screenRef.current === "loading") {
            setOpenDeck(jd);
            setScreen("feed");
          } else {
            setOpenDeck((d) => {
              if (d && d.id === jd.id && d.wrong?.length) saveDeck({ ...jd, wrong: d.wrong });
              return d;
            });
          }
          refreshDecks();
        }
      });
    },
    [settings.cardCount],
  );

  const generatingId = job && (job.phase === "scenes" || job.phase === "outline") ? (job.deck?.id ?? null) : null;

  const open = (d: Deck) => {
    unlockAudio();
    setOpenDeck(d);
    setScreen("feed");
  };

  const onDeckChange = (d: Deck) => {
    setOpenDeck(d);
    if (!d.sample) {
      saveDeck(d);
      refreshDecks();
    }
  };

  const onRetryCard = async (cardId: string) => {
    const d = openDeck;
    if (!d || d.sample) return;
    if (job?.deck?.id === d.id && generatingId) {
      await handle.current?.retryCard(cardId);
      return;
    }
    const pending: Deck = { ...d, cards: d.cards.map((c) => (c.id === cardId ? { ...c, status: "pending" as const, error: undefined } : c)) };
    setOpenDeck(pending);
    try {
      const scene = await regenerateCard(d, cardId);
      const next = { ...pending, cards: pending.cards.map((c) => (c.id === cardId ? { ...c, scene, status: "ready" as const } : c)) };
      setOpenDeck((cur) => (cur?.id === next.id ? next : cur));
      saveDeck(next);
    } catch (e) {
      const next = { ...pending, cards: pending.cards.map((c) => (c.id === cardId ? { ...c, status: "error" as const, error: (e as Error).message } : c)) };
      setOpenDeck((cur) => (cur?.id === next.id ? next : cur));
      saveDeck(next);
    }
    refreshDecks();
  };

  return (
    <PhoneFrame>
      {screen === "home" ? (
        <Home
          deckCount={decks.length}
          cardCount={settings.cardCount}
          onCardCount={(n) => setSettings({ ...settings, cardCount: n })}
          onFiles={begin}
          onLibrary={() => {
            refreshDecks();
            setScreen("library");
          }}
          onSample={() => open(SAMPLE_DECK)}
          apiReady={apiReady}
        />
      ) : screen === "library" ? (
        <Library
          decks={decks}
          sample={SAMPLE_DECK}
          generatingId={generatingId}
          onOpen={(d) => open(job?.deck?.id === d.id && job.deck ? job.deck : d)}
          onDelete={(id) => {
            deleteDeck(id);
            refreshDecks();
          }}
          onBack={() => setScreen("home")}
        />
      ) : screen === "loading" && job ? (
        <Loading
          job={job}
          onCancel={() => {
            handle.current?.cancel();
            setJob(null);
            refreshDecks();
            setScreen("home");
          }}
          onOpenEarly={() => job.deck && open(job.deck)}
          onChooseRange={(r) => handle.current?.chooseRange(r)}
          onRetry={() => begin(lastFiles.current)}
          onSample={() => open(SAMPLE_DECK)}
        />
      ) : screen === "feed" && openDeck ? (
        <Feed
          key={openDeck.id}
          deck={openDeck}
          generating={generatingId === openDeck.id}
          settings={settings}
          onSettings={setSettings}
          onBack={() => {
            refreshDecks();
            setScreen("home");
          }}
          onDeckChange={onDeckChange}
          onRetryCard={onRetryCard}
        />
      ) : (
        <Home
          deckCount={decks.length}
          cardCount={settings.cardCount}
          onCardCount={(n) => setSettings({ ...settings, cardCount: n })}
          onFiles={begin}
          onLibrary={() => setScreen("library")}
          onSample={() => open(SAMPLE_DECK)}
          apiReady={apiReady}
        />
      )}
    </PhoneFrame>
  );
}
