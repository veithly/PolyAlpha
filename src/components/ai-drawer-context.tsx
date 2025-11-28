import React, { createContext, useContext, useMemo, useState } from "react";

export type AiDrawerContextData = {
  marketId?: string;
  title?: string;
  yesProbability?: number;
  change24h?: number;
  category?: string;
  description?: string;
  summarySnippet?: string;
  news?: { title: string; link?: string }[];
};

type AiDrawerState = {
  isOpen: boolean;
  setOpen: (value: boolean) => void;
  context: AiDrawerContextData | null;
  setContext: (value: AiDrawerContextData | null) => void;
};

const DrawerCtx = createContext<AiDrawerState | null>(null);

export function AiDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [context, setContext] = useState<AiDrawerContextData | null>(null);

  const value = useMemo(
    () => ({ isOpen, setOpen, context, setContext }),
    [isOpen, context]
  );

  return <DrawerCtx.Provider value={value}>{children}</DrawerCtx.Provider>;
}

export function useAiDrawer() {
  const ctx = useContext(DrawerCtx);
  if (!ctx) {
    throw new Error("useAiDrawer must be used within AiDrawerProvider");
  }
  return ctx;
}
