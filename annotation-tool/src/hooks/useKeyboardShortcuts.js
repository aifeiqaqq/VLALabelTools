import { useEffect, useRef, useCallback } from "react";

/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard events for navigation and actions
 * 
 * 注意：使用 ref 存储 currentFrame 和 seekFrame 避免依赖项频繁变化
 * 导致事件监听器被反复重新注册，影响长按连续触发
 * 
 * 添加节流控制，防止长按键盘时事件触发过快导致渲染卡顿
 */
export function useKeyboardShortcuts({
  enabled,
  seekFrame,
  currentFrame,
  markFrame,
  togglePlay
}) {
  // 使用 ref 存储可变值，避免依赖项频繁变化
  const currentFrameRef = useRef(currentFrame);
  const seekFrameRef = useRef(seekFrame);
  const markFrameRef = useRef(markFrame);
  const togglePlayRef = useRef(togglePlay);

  // 新增：按键状态追踪（用于渐进式加速）
  const keyStateRef = useRef({
    ArrowLeft: { isPressed: false, pressStartTime: 0 },
    ArrowRight: { isPressed: false, pressStartTime: 0 }
  });

  // 节流控制 ref
  const lastSeekTimeRef = useRef(0);

  /**
   * 计算帧步进值（渐进式加速）
   * @param {number} pressDuration - 按键持续时间（毫秒）
   * @param {boolean} shiftPressed - 是否按下Shift键
   * @returns {number} 帧步进值
   */
  const calculateFrameDelta = useCallback((pressDuration, shiftPressed) => {
    let baseDelta;

    if (pressDuration < 500) {
      baseDelta = 1;     // 0-0.5秒: 精确控制
    } else if (pressDuration < 1500) {
      baseDelta = 5;     // 0.5-1.5秒: 小步快走
    } else if (pressDuration < 3000) {
      baseDelta = 15;    // 1.5-3秒: 中等跨度
    } else {
      baseDelta = 30;    // 3秒以上: 快速跨越
    }

    // Shift修饰键：根据阶段放大步进值
    if (shiftPressed) {
      if (pressDuration < 500) return 10;
      if (pressDuration < 1500) return 30;
      if (pressDuration < 3000) return 60;
      return 90;
    }

    return baseDelta;
  }, []);

  /**
   * 根据加速阶段动态调整节流间隔
   * @param {number} pressDuration - 按键持续时间（毫秒）
   * @returns {number} 节流间隔（毫秒）
   */
  const getThrottleInterval = useCallback((pressDuration) => {
    if (pressDuration < 500) return 60;      // 初始阶段: 60ms（高响应）
    if (pressDuration < 1500) return 80;     // 加速阶段1: 80ms
    if (pressDuration < 3000) return 100;    // 加速阶段2: 100ms
    return 120;                               // 最快阶段: 120ms（降低负载）
  }, []);

  // 更新 ref 值
  useEffect(() => {
    currentFrameRef.current = currentFrame;
    seekFrameRef.current = seekFrame;
    markFrameRef.current = markFrame;
    togglePlayRef.current = togglePlay;
  }, [currentFrame, seekFrame, markFrame, togglePlay]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // 忽略输入框中的按键
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();

          const keyState = keyStateRef.current[e.key];
          const now = Date.now();

          // 首次按下: 记录时间戳
          if (!keyState.isPressed) {
            keyState.isPressed = true;
            keyState.pressStartTime = now;
          }

          // 计算持续时间
          const pressDuration = now - keyState.pressStartTime;

          // 动态节流
          const throttleInterval = getThrottleInterval(pressDuration);
          if (now - lastSeekTimeRef.current < throttleInterval) {
            return; // 节流中，忽略
          }
          lastSeekTimeRef.current = now;

          // 计算步进值（渐进式加速）
          const frameDelta = calculateFrameDelta(pressDuration, e.shiftKey);
          const direction = e.key === "ArrowLeft" ? -1 : 1;
          const newFrame = currentFrameRef.current + (frameDelta * direction);

          seekFrameRef.current(newFrame);
          break;
        }
        case "m":
        case "M":
          e.preventDefault();
          console.log('[useKeyboardShortcuts] M键被按下, markFrameRef:', typeof markFrameRef.current);
          markFrameRef.current();
          break;
        case " ":
          e.preventDefault();
          togglePlayRef.current();
          break;
        default:
          break;
      }
    };

    // 重置按键状态（松开按键时）
    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const keyState = keyStateRef.current[e.key];
        keyState.isPressed = false;
        keyState.pressStartTime = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, calculateFrameDelta, getThrottleInterval]); // 添加依赖项
}
