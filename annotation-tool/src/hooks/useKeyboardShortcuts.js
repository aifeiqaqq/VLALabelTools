import { useEffect } from "react";

/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard events for navigation and actions
 */
export function useKeyboardShortcuts({
  enabled,
  seekFrame,
  currentFrame,
  markFrame,
  togglePlay
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // 忽略输入框中的按键
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          seekFrame(currentFrame - (e.shiftKey ? 10 : 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          seekFrame(currentFrame + (e.shiftKey ? 10 : 1));
          break;
        case "m":
        case "M":
          e.preventDefault();
          markFrame();
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, seekFrame, currentFrame, markFrame, togglePlay]);
}
