import { createContext, useContext } from "react";

const KEY = "wzjs.v2.state";

export const DEFAULT_STATE = {
  theme: "dark",
  fontScale: 1,
  favorites: [],
  recents: [],
  lastBp: null,
  lastItems: null,
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state) {
  try {
    const { theme, fontScale, favorites, recents, lastBp, lastItems } = state;
    localStorage.setItem(KEY, JSON.stringify({ theme, fontScale, favorites, recents, lastBp, lastItems }));
  } catch (e) {
    /* ignore quota errors */
  }
}

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
