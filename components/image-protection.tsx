"use client"

import { useEffect } from "react";

export default function ImageProtection() {
  useEffect(() => {
    const shouldBlock = (target: EventTarget | null) => {
      return target instanceof HTMLImageElement;
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (shouldBlock(event.target)) {
        event.preventDefault();
      }
    };

    const handleDragStart = (event: DragEvent) => {
      if (shouldBlock(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, []);

  return null;
}