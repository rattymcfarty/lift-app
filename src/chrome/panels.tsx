/**
 * Panel state context — manages which side panel is open.
 *
 * Panels: 'left' | 'right' | null
 * - Left panel: navigation, program picker, etc. (stage B)
 * - Right panel: settings, filters, etc. (stage B)
 * - null: no panel open
 *
 * Pure React context, no native deps — unit-testable.
 */
import { createContext, useContext, useState, useCallback, useMemo, type JSX, type ReactNode } from 'react';

export type PanelSide = 'left' | 'right' | null;

export interface PanelsContextValue {
  /** Currently open panel, or null. */
  current: PanelSide;
  /** Open a specific panel (closes any other). */
  openPanel: (side: PanelSide) => void;
  /** Close the currently open panel. */
  closePanel: () => void;
  /** Toggle a panel (open if closed, close if open). */
  togglePanel: (side: PanelSide) => void;
}

const PanelsContext = createContext<PanelsContextValue | null>(null);

export interface PanelsProviderProps {
  children: ReactNode;
}

export function PanelsProvider({ children }: PanelsProviderProps): JSX.Element {
  const [current, setOpenPanel] = useState<PanelSide>(null);

  const openPanelFn = useCallback((side: PanelSide) => {
    setOpenPanel(side);
  }, []);

  const closePanel = useCallback(() => {
    setOpenPanel(null);
  }, []);

  const togglePanel = useCallback((side: PanelSide) => {
    setOpenPanel((current) => (current === side ? null : side));
  }, []);

  const value = useMemo(
    () => ({ current, openPanel: openPanelFn, closePanel, togglePanel }),
    [current, openPanelFn, closePanel, togglePanel],
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