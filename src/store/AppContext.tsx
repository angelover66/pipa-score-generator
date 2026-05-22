'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppStep, ProcessingStep, PlayerState, ScoreData, ScoreLibraryEntry, PresetMaterial } from '../engine/types';

type Action =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_PROCESSING'; payload: { step: ProcessingStep; percent: number } }
  | { type: 'SET_SCORE'; payload: ScoreData }
  | { type: 'SET_PLAYER_STATE'; payload: PlayerState }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_TO_LIBRARY'; payload: ScoreLibraryEntry }
  | { type: 'REMOVE_FROM_LIBRARY'; payload: string }
  | { type: 'SET_PRESETS'; payload: PresetMaterial[] }
  | { type: 'LOAD_LIBRARY'; payload: ScoreLibraryEntry[] }
  | { type: 'RESET' };

const initialState: AppState = {
  currentStep: 'idle',
  processingProgress: { step: 'extracting', percent: 0 },
  currentScore: null,
  playerState: 'stopped',
  library: [],
  presets: [],
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_PROCESSING':
      return { ...state, processingProgress: action.payload };
    case 'SET_SCORE':
      return { ...state, currentScore: action.payload, currentStep: 'success' };
    case 'SET_PLAYER_STATE':
      return { ...state, playerState: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, currentStep: action.payload ? 'error' : state.currentStep };
    case 'ADD_TO_LIBRARY': {
      const exists = state.library.find((e) => e.id === action.payload.id);
      if (exists) return state;
      const updated = [action.payload, ...state.library].slice(0, 100);
      localStorage.setItem('pipa-score-library', JSON.stringify(updated));
      return { ...state, library: updated };
    }
    case 'REMOVE_FROM_LIBRARY': {
      const filtered = state.library.filter((e) => e.id !== action.payload);
      localStorage.setItem('pipa-score-library', JSON.stringify(filtered));
      return { ...state, library: filtered };
    }
    case 'SET_PRESETS':
      return { ...state, presets: action.payload };
    case 'LOAD_LIBRARY':
      return { ...state, library: action.payload };
    case 'RESET':
      return { ...state, currentStep: 'idle', currentScore: null, error: null };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pipa-score-library');
      if (stored) {
        const parsed = JSON.parse(stored) as ScoreLibraryEntry[];
        dispatch({ type: 'LOAD_LIBRARY', payload: parsed });
      }
    } catch {
      // ignore corrupt data
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
