"use client";

import { useEffect, useRef, useState } from "react";
import { useAiDrawer } from "./ai-drawer-context";

export function FloatingAssistant() {
  const { setOpen, setContext } = useAiDrawer();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("assistant_pos");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { x: number; y: number };
        setPosition(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!position) return;
    window.localStorage.setItem("assistant_pos", JSON.stringify(position));
  }, [position]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = true;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPos = position ?? defaultPos();

    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const nextX = startPos.x + (e.clientX - startX);
      const nextY = startPos.y + (e.clientY - startY);
      setPosition(clampToViewport({ x: nextX, y: nextY }));
    };

    const up = () => {
      dragRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const style: React.CSSProperties = position
    ? { transform: `translate(${position.x}px, ${position.y}px)` }
    : {};

  return (
    <button
      type="button"
      className="floating-assistant"
      onPointerDown={handlePointerDown}
      onClick={() => {
        // ensure global mode unless a card sets context later
        setContext(null);
        setOpen(true);
      }}
      aria-label="Open AI assistant"
      style={style}
    >
      ✦
    </button>
  );
}

function defaultPos() {
  return { x: 0, y: 0 };
}

function clampToViewport(pos: { x: number; y: number }) {
  if (typeof window === "undefined") return pos;
  const maxX = (window.innerWidth ?? 360) - 72;
  const maxY = (window.innerHeight ?? 640) - 120;
  return {
    x: Math.min(Math.max(pos.x, -16), maxX),
    y: Math.min(Math.max(pos.y, -16), maxY),
  };
}
