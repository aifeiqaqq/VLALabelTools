import { useCallback, useRef } from "react";
import { useVideoStore } from "../stores/videoStore";

/**
 * Frame Navigation Hook
 * Handles frame seeking with debouncing for performance
 */
export function useFrameNavigation(videoRef, fpsRef) {
  const { videoReady, totalFrames, seekFrame: seekFrameStore, setIsSeeking, setCurrentFrame } = useVideoStore();
  
  // 用于防抖的 ref
  const seekTimeoutRef = useRef(null);
  const isDraggingRef = useRef(false);

  /**
   * 立即 seek（用于键盘快捷键等）
   */
  const seekFrame = useCallback((frameIndex) => {
    const v = videoRef.current;
    if (!v || !videoReady) return;

    seekFrameStore(frameIndex);
    setIsSeeking(true);
    v.pause();

    const clampedFrame = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    v.currentTime = clampedFrame / fpsRef.current;
  }, [videoReady, totalFrames, seekFrameStore, setIsSeeking, videoRef, fpsRef]);

  /**
   * 拖动时预览（只更新 UI，不 seek）
   */
  const previewFrame = useCallback((frameIndex) => {
    // 只更新当前帧显示，不实际 seek
    setCurrentFrame(Math.max(0, Math.min(frameIndex, totalFrames - 1)));
  }, [totalFrames, setCurrentFrame]);

  /**
   * 拖动结束时执行 seek
   */
  const seekFrameDebounced = useCallback((frameIndex) => {
    const v = videoRef.current;
    if (!v || !videoReady) return;

    // 清除之前的定时器
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }

    // 更新 UI 显示
    const clampedFrame = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    setCurrentFrame(clampedFrame);

    // 使用 requestAnimationFrame + 防抖优化 seek 性能
    seekTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        seekFrameStore(clampedFrame);
        setIsSeeking(true);
        v.pause();
        v.currentTime = clampedFrame / fpsRef.current;
      });
    }, 50); // 50ms 防抖
  }, [videoReady, totalFrames, seekFrameStore, setIsSeeking, setCurrentFrame, videoRef, fpsRef]);

  /**
   * 开始拖动
   */
  const startDrag = useCallback(() => {
    isDraggingRef.current = true;
    // 清除可能 pending 的 seek
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
  }, []);

  /**
   * 结束拖动
   */
  const endDrag = useCallback((frameIndex) => {
    isDraggingRef.current = false;
    // 立即执行最终的 seek
    seekFrame(frameIndex);
  }, [seekFrame]);

  return { 
    seekFrame,
    seekFrameDebounced,
    previewFrame,
    startDrag,
    endDrag,
    isDragging: () => isDraggingRef.current
  };
}
