import { useRef, useCallback, useEffect, useState } from "react";
import { useVideoStore } from "../stores/videoStore";

/**
 * Video Player Hook - Optimized for Performance
 * 
 * Architecture:
 * - Local state for UI-responsive values (currentFrame, isPlaying)
 * - Zustand only for persistent/app-wide state
 * - RAF-based smooth updates without React re-renders
 */
export function useVideoPlayer(videoRef) {
  // Local refs for smooth animation (no React re-renders)
  const fpsRef = useRef(30);
  const totalFramesRef = useRef(0);
  const isSeekingRef = useRef(false);
  const rafIdRef = useRef(null);
  
  // Local state for UI components (separate from Zustand)
  const [localState, setLocalState] = useState({
    currentFrame: 0,
    isPlaying: false,
    videoReady: false,
  });

  // Zustand actions (stable references)
  const setVideoMetadata = useVideoStore((s) => s.setVideoMetadata);
  const setCurrentFrame = useVideoStore((s) => s.setCurrentFrame);
  const setIsPlaying = useVideoStore((s) => s.setIsPlaying);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const fps = 30;
    fpsRef.current = fps;
    const totalFrames = Math.floor(v.duration * fps);
    totalFramesRef.current = totalFrames;
    
    setVideoMetadata(fps, totalFrames);
    
    v.currentTime = 0;
    v.pause();
    
    setLocalState(prev => ({
      ...prev,
      currentFrame: 0,
      videoReady: true,
    }));
    setCurrentFrame(0);
  }, [videoRef, setVideoMetadata, setCurrentFrame]);

  // Smooth frame update using RAF (no re-renders during playback)
  const updateFrameLoop = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused || v.ended || isSeekingRef.current) {
      rafIdRef.current = null;
      return;
    }

    const frame = Math.round(v.currentTime * fpsRef.current);
    
    // Only update if frame changed
    if (frame !== localState.currentFrame) {
      setLocalState(prev => ({ ...prev, currentFrame: frame }));
    }
    
    rafIdRef.current = requestAnimationFrame(updateFrameLoop);
  }, [videoRef, localState.currentFrame]);

  const onPlay = useCallback(() => {
    setLocalState(prev => ({ ...prev, isPlaying: true }));
    setIsPlaying(true);
    // Start RAF loop for smooth updates
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(updateFrameLoop);
    }
  }, [setIsPlaying, updateFrameLoop]);

  const onPause = useCallback(() => {
    setLocalState(prev => ({ ...prev, isPlaying: false }));
    setIsPlaying(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [setIsPlaying]);

  const onTimeUpdate = useCallback(() => {
    // Skip if seeking (we handle seeked separately)
    if (isSeekingRef.current) return;
    
    const v = videoRef.current;
    if (!v) return;

    const frame = Math.round(v.currentTime * fpsRef.current);
    if (frame !== localState.currentFrame) {
      setLocalState(prev => ({ ...prev, currentFrame: frame }));
    }
  }, [videoRef, localState.currentFrame]);

  const onSeeked = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    
    const frame = Math.round(v.currentTime * fpsRef.current);
    isSeekingRef.current = false;
    
    setLocalState(prev => ({ ...prev, currentFrame: frame }));
    setCurrentFrame(frame);
  }, [videoRef, setCurrentFrame]);

  // Seek function (returns Promise for smooth dragging)
  const seekFrame = useCallback((frame) => {
    const v = videoRef.current;
    if (!v || totalFramesRef.current === 0) return Promise.resolve();

    isSeekingRef.current = true;
    const time = Math.max(0, Math.min(frame / fpsRef.current, v.duration || 0));
    
    return new Promise((resolve) => {
      const onSeek = () => {
        v.removeEventListener("seeked", onSeek);
        isSeekingRef.current = false;
        const actualFrame = Math.round(v.currentTime * fpsRef.current);
        setLocalState(prev => ({ ...prev, currentFrame: actualFrame }));
        setCurrentFrame(actualFrame);
        resolve(actualFrame);
      };
      v.addEventListener("seeked", onSeek, { once: true });
      v.currentTime = time;
    });
  }, [videoRef, setCurrentFrame]);

  // Fast seek for dragging (no Promise, just update time)
  const seekFrameFast = useCallback((frame) => {
    const v = videoRef.current;
    if (!v || totalFramesRef.current === 0) return;

    isSeekingRef.current = true;
    const time = Math.max(0, Math.min(frame / fpsRef.current, v.duration || 0));
    v.currentTime = time;
    
    // Update local state immediately for responsive UI
    setLocalState(prev => ({ ...prev, currentFrame: frame }));
  }, [videoRef]);

  // Mark seeking ended (for drag end)
  const endSeek = useCallback(() => {
    const v = videoRef.current;
    isSeekingRef.current = false;
    if (v) {
      const frame = Math.round(v.currentTime * fpsRef.current);
      setCurrentFrame(frame);
    }
  }, [videoRef, setCurrentFrame]);

  return {
    // Local state (for UI)
    currentFrame: localState.currentFrame,
    isPlaying: localState.isPlaying,
    videoReady: localState.videoReady,
    fps: fpsRef.current,
    totalFrames: totalFramesRef.current,
    
    // Actions
    seekFrame,
    seekFrameFast,
    endSeek,
    onVideoLoaded,
    onTimeUpdate,
    onSeeked,
    onPlay,
    onPause,
  };
}
