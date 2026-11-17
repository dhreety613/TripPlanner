import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { historyReducer, initialHistory, emptyPlan, isEmpty, uid } from './lib/planReducer.js';
import { listSessions, saveSession, deleteSession } from './lib/storage.js';
import { usePlanner } from './hooks/usePlanner.js';
import { ItineraryView } from './components/ItineraryView.jsx';
import { PromptForm, RefineBar, StatusBar, ErrorPanel, Skeleton, SessionsPanel } from './components/Panels.jsx';
import { Strawberry } from './components/Decor.jsx';
import { Landing } from './components/Landing.jsx';


const Icon = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IconBook = () => <Icon><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5V21.5" /><path d="M9 8h7" /></Icon>;
const IconMoon = () => <Icon><path d="M20 14.5A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.500z" /></Icon>;
const IconSun = () => <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400" /></Icon>;

export default function App() {
  const [hist, dispatch] = useReducer(historyReducer, initialHistory);
  const plan = hist.present;
  const planner = usePlanner(dispatch);
  const [sessionId, setSessionId] = useState(uid);
  const [lastPrompt, setLastPrompt] = useState('');
  const [sessions, setSessions] = useState(() => listSessions());
  const [showSessions, setShowSessions] = useState(false);
  const [health, setHealth] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const lastReq = useRef(null);
  const [seed, setSeed] = useState({ text: '', n: 0 });
  const pickPlace = useCallback((pl) => setSeed((x) => ({ text: pl.prompt, n: x.n + 1 })), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('wf.theme', theme); } catch {}
  }, [theme]);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const start = useCallback((prompt, refine) => {
    lastReq.current = { prompt, refine };
    setLastPrompt((p) => (refine ? p : prompt));
    planner.run({ prompt, currentPlan: refine ? plan : undefined });
  }, [planner.run, plan]);

  // Autosave when idle & non-empty (debounced).
  useEffect(() => {
    if (planner.busy || isEmpty(plan)) return;
    const t = setTimeout(() => {
      saveSession({ id: sessionId, prompt: lastPrompt, plan });
      setSessions(listSessions());
    }, 500);
    return () => clearTimeout(t);
  }, [plan, planner.busy, sessionId, lastPrompt]);

  // Global shortcuts: Esc cancels generation, Ctrl/Cmd+Z undo, +Shift redo.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape' && planner.busy) planner.cancel();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing && !planner.busy) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [planner.busy, planner.cancel]);

  const newTrip = () => {
    planner.cancel();
    dispatch({ type: 'load', plan: emptyPlan() });
    setSessionId(uid());
    setLastPrompt('');
    setShowSessions(false);
  };
  const loadSession = (s) => {
    planner.cancel();
    dispatch({ type: 'load', plan: s.plan });
    setSessionId(s.id);
    setLastPrompt(s.prompt || '');
    setShowSessions(false);
  };

  const hasPlan = !isEmpty(plan);
  const showSkeleton = planner.busy && !hasPlan;
  const landing = !hasPlan && !planner.busy;
  const retry = () => lastReq.current && start(lastReq.current.prompt, lastReq.current.refine);

  return (
    <div className={`app${landing ? ' landing' : ''}`}>
      <header className="top">
        <div className="brand"><Strawberry size={34} /><span className="wordmark">Voyage<b>.AI</b></span></div>
        <nav className="top-actions">
          {health?.mock && <span className="chip demo" title="No API key configured: responses come from a built-in mock model.">demo model</span>}
          <button className="icon-btn hist" onClick={() => dispatch({ type: 'undo' })} disabled={!hist.past.length || planner.busy} aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
          <button className="icon-btn hist" onClick={() => dispatch({ type: 'redo' })} disabled={!hist.future.length || planner.busy} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button>
          <button className="icon-btn" onClick={() => setShowSessions((s) => !s)} aria-label="Saved trips" aria-pressed={showSessions} title="Saved trips"><IconBook /></button>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode" title="Toggle theme">{theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
        </nav>
      </header>

      <main>
        {showSessions && <SessionsPanel sessions={sessions} onLoad={loadSession} onNew={newTrip} onClose={() => setShowSessions(false)}
          onDelete={(id) => { deleteSession(id); setSessions(listSessions()); }} />}

        {landing ? (
          <Landing onPick={pickPlace}>
            <PromptForm big seed={seed} initial={lastPrompt} busy={planner.busy} onCancel={planner.cancel} onSubmit={(p) => start(p, false)} />
            <StatusBar planner={planner} />
            {planner.error && <ErrorPanel error={planner.error} onRetry={retry} onDismiss={planner.dismiss} />}
          </Landing>
        ) : (
          <>
            <PromptForm initial={lastPrompt} busy={planner.busy} onCancel={planner.cancel} onSubmit={(p) => start(p, false)} />
            <StatusBar planner={planner} />
            {planner.error && <ErrorPanel error={planner.error} onRetry={retry} onDismiss={planner.dismiss} />}
          </>
        )}

        {showSkeleton && <Skeleton />}
        {!showSkeleton && hasPlan && (
          <>
            <ItineraryView plan={plan} dispatch={dispatch} locked={planner.busy} streaming={planner.busy} />
            <RefineBar busy={planner.busy} onSubmit={(p) => start(p, true)} />
          </>
        )}
      </main>
    </div>
  );
}
