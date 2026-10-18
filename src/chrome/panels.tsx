/**
 * Panel state context — which side panel is open.
 *
 * - Left panel: navigation (tabs, More links, search, new workout).
 * - Right panel: settings, embedded.
 * - null: nothing open.
 *
 * The transitions themselves are pure and live in `panelsModel.ts` (unit
 * tested); this file only wires them into React state. No native deps.
 */
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useReducer,
  type JSX,
  type ReactNode,
} from 'react';
import {
  panelsReducer,
  type OpenPanelSide,
  type PanelSide,
} from './panelsModel';

export type { PanelSide, OpenPanelSide } from './panelsModel';

export interface PanelsContextValue {
  /** Currently open panel, or null. */
  current: PanelSide;
  /** Open a specific panel (closes any other). */
  openPanel: (side: OpenPanelSide) => void;
  /** Close the currently open panel. */
  closePanel: () => void;
  /** Toggle a panel (open if closed, close if open). */
  togglePanel: (side: OpenPanelSide) => void;
}

const PanelsContext = createContext<PanelsContextValue | null>(null);

export interface PanelsProviderProps {
  children: ReactNode;
}

export function PanelsProvider({ children }: PanelsProviderProps): JSX.Element {
  const [current, dispatch] = useReducer(panelsReducer, null);

  const openPanel = useCallback((side: OpenPanelSide) => dispatch({ type: 'open', side }), []);
  const closePanel = useCallback(() => dispatch({ type: 'close' }), []);
  const togglePanel = useCallback((side: OpenPanelSide) => dispatch({ type: 'toggle', side }), []);

  const value = useMemo(
    () => ({ current, openPanel, closePanel, togglePanel }),
    [current, openPanel, closePanel, togglePanel],
  );

  return <PanelsContext.Provider value={value}>{children}</PanelsContext.Provider>;
}

/**
 * Hook to access the panels context.
 * Throws if used outside a PanelsProvider.
 */
export function usePanels(): PanelsContextValue {
  const ctx = useContext(PanelsContext);
  if (!ctx) {
    throw new Error('usePanels must be used within a PanelsProvider');
  }
  return ctx;
}

/**
 * Optional accessor — returns null if no provider (for screens that don't need it).
 */
export function usePanelsOptional(): PanelsContextValue | null {
  return useContext(PanelsContext);
}
