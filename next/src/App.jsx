import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, loadState, saveState } from "./lib/store.js";
import { APP_VERSION } from "./lib/config.js";
import { checkForUpdates, reloadForNewData } from "./lib/update.js";
import { TabBar } from "./components/common.jsx";
import Home from "./pages/Home.jsx";
import HeroPage from "./pages/Hero.jsx";
import BP from "./pages/BP.jsx";
import Items from "./pages/Items.jsx";
import More from "./pages/More.jsx";
import Comps from "./pages/Comps.jsx";
import Coaches from "./pages/Coaches.jsx";
import Settings from "./pages/Settings.jsx";
import Favorites from "./pages/Favorites.jsx";
import Search from "./pages/Search.jsx";
import AiChat from "./pages/AiChat.jsx";

const PAGES = {
  home: Home,
  strength: HeroPage,
  bp: BP,
  items: Items,
  more: More,
  comps: Comps,
  coaches: Coaches,
  settings: Settings,
  favorites: Favorites,
  search: Search,
  ai: AiChat,
};

const TAB_OF = {
  home: "home",
  strength: "strength",
  bp: "bp",
  items: "items",
  more: "more",
  comps: "more",
  coaches: "more",
  settings: "more",
  favorites: "more",
  search: "home",
  ai: "more",
};

export default function App() {
  const [state, setState] = useState(loadState);
  const [stack, setStack] = useState([{ name: "home", params: {} }]);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const closers = useRef([]);

  const route = stack[stack.length - 1];
  const tab = TAB_OF[route.name] || "home";

  useEffect(() => {
    saveState(state);
  }, [state]);

  // 启动后自动检查数据更新（6 小时节流，失败静默）；更新成功整页 reload 让新数据生效
  useEffect(() => {
    window.__checkForUpdates = checkForUpdates;
    window.__appVersion = APP_VERSION;
    const timer = setTimeout(() => {
      checkForUpdates({ manual: false })
        .then((r) => {
          if (r && r.status === "updated") {
            setTimeout(() => reloadForNewData(), 600);
          }
        })
        .catch(() => {});
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
    document.documentElement.style.setProperty("--fs-scale", String(state.fontScale || 1));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#080a0e" : "#f4efe5");
  }, [state.theme, state.fontScale]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const navigate = useCallback((name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
  }, []);

  const goTab = useCallback((name) => {
    setStack([{ name, params: {} }]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const registerCloser = useCallback((fn) => {
    closers.current.push(fn);
    return () => {
      const i = closers.current.indexOf(fn);
      if (i >= 0) closers.current.splice(i, 1);
    };
  }, []);

  // 安卓硬件返回键：先关弹层，再返回上一页，最后交给原生双击退出。
  // 同时注册 __appBack 与 __studyBack：shell 的新版 helper 只在不存在时安装 fallback，
  // 老版 helper 仍可能覆盖 __studyBack，因此 Java 侧优先调用 __appBack。
  useEffect(() => {
    const handler = () => {
      if (closers.current.length > 0) {
        const fn = closers.current[closers.current.length - 1];
        closers.current = closers.current.slice(0, -1);
        try {
          fn();
        } catch (e) {}
        return true;
      }
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    };
    window.__appBack = handler;
    window.__studyBack = handler;
    return () => {
      if (window.__appBack === handler) delete window.__appBack;
      if (window.__studyBack === handler) delete window.__studyBack;
    };
  }, [stack.length, back]);

  const value = useMemo(() => {
    const favSet = new Set(state.favorites);
    return {
      theme: state.theme,
      setTheme: (theme) => setState((s) => ({ ...s, theme })),
      fontScale: state.fontScale,
      setFontScale: (fontScale) => setState((s) => ({ ...s, fontScale })),
      favorites: state.favorites,
      isFav: (name) => favSet.has(name),
      toggleFav: (name) =>
        setState((s) => {
          const next = s.favorites.includes(name) ? s.favorites.filter((x) => x !== name) : [...s.favorites, name];
          return { ...s, favorites: next };
        }),
      recents: state.recents,
      clearFavorites: () => setState((s) => ({ ...s, favorites: [] })),
      clearRecents: () => setState((s) => ({ ...s, recents: [] })),
      pushRecent: (type, name, extra = {}) =>
        setState((s) => {
          const key = `${type}:${name}`;
          const rest = s.recents.filter((r) => `${r.type}:${r.name}` !== key);
          return { ...s, recents: [{ type, name, ts: Date.now(), ...extra }, ...rest].slice(0, 24) };
        }),
      lastBp: state.lastBp,
      setLastBp: (lastBp) => setState((s) => ({ ...s, lastBp })),
      lastItems: state.lastItems,
      setLastItems: (lastItems) => setState((s) => ({ ...s, lastItems })),
      route,
      navigate,
      goTab,
      back,
      tab,
      showToast,
      registerCloser,
    };
  }, [state, route, tab, navigate, goTab, back, showToast, registerCloser]);

  const Page = PAGES[route.name] || Home;

  return (
    <AppContext.Provider value={value}>
      <div className="app-shell">
        <div className="screen">
          <Page key={route.name} params={route.params || {}} />
        </div>
        <TabBar />
        <div id="overlay-root" />
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </AppContext.Provider>
  );
}
