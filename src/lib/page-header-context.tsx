import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface PageHeaderOverride {
  icon?: LucideIcon;
  title?: string;
  actions?: ReactNode;
}

const EMPTY: PageHeaderOverride = {};

// Split into two contexts on purpose. Pages only ever need the setter, and
// the setter (a raw useState dispatch) is referentially stable across
// renders — so a page that calls usePageHeader() never re-subscribes when
// the header value itself changes. Only TopBar reads the value context.
// Collapsing these into one context (a single {override, setOverride} value
// object) made every page implicitly subscribe to override changes too,
// which re-ran their effect, which called setOverride again, forever —
// an infinite render loop that froze the whole app.
const PageHeaderSetterContext = createContext<(o: PageHeaderOverride) => void>(() => {});
const PageHeaderValueContext = createContext<PageHeaderOverride>(EMPTY);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageHeaderOverride>(EMPTY);
  return (
    <PageHeaderSetterContext.Provider value={setOverride}>
      <PageHeaderValueContext.Provider value={override}>
        {children}
      </PageHeaderValueContext.Provider>
    </PageHeaderSetterContext.Provider>
  );
}

// Pages call this (unconditionally, before any early return) to publish their
// action button into the TopBar. icon/title are optional — omit them to fall
// back to the nav.ts entry for the current route; pages not in nav.ts (e.g.
// Settings, a project detail view) should pass both explicitly.
export function usePageHeader(override: PageHeaderOverride) {
  const setOverride = useContext(PageHeaderSetterContext);
  useEffect(() => {
    setOverride(override);
    return () => setOverride(EMPTY);
  });
}

export function usePageHeaderOverride(): PageHeaderOverride {
  return useContext(PageHeaderValueContext);
}
