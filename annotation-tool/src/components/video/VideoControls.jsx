import React, { useState, useCallback, useRef, useEffect } from 'react';
import { S } from "../../constants/styles";

/**
 * VideoControls Component - High Performance Version
 * 
 * Key optimizations:
 * 1. Dragging uses local state ONLY (no Zustand updates, no seek calls)
 * 2. RAF-scheduled seek during drag (smooth visual feedback)
 * 3. Final seek on drag end only
 */
const VideoControls = React.memo(function VideoControls({
  currentFrame,
  totalFrames,
  fps = 30,
  isPlaying,
  videoReady,
  seekFrame,      // Full seek (updates Zustand)
  seekFrameFast,  // Fast seek (local only, for dragging)
  endSeek,        // Called when drag ends
}) {
  // Local state for slider (completely decoupled from props during drag)
  const [sliderValue, setSliderValue] = useState(currentFrame);
  const [isDragging, setIsDragging] = useState(false);
  const [frameInput, setFrameInput] = useState("");
  
  // RAF ref for smooth seeking
  const rafIdRef = useRef(null);
  const lastSeekFrameRef = useRef(currentFrame);

  // Sync slider when not dragging and currentFrame changes externally
  useEffect(() => {
    if (!isDragging) {
      setSliderValue(currentFrame);
    }
  }, [currentFrame, isDragging]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Schedule seek via RAF (smooth performance)
  // Use a longer threshold for HEVC/H.265 videos in Firefox to avoid decoder errors
  const scheduleSeek = useCallback((frame) => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    // Only seek if frame changed significantly (reduces seeks)
    // Increase threshold to 5 frames during drag to reduce decoder pressure
    if (Math.abs(frame - lastSeekFrameRef.current) >= 5) {
      rafIdRef.current = requestAnimationFrame(() => {
        lastSeekFrameRef.current = frame;
        if (seekFrameFast) {
          seekFrameFast(frame);
        }
      });
    }
  }, [seekFrameFast]);

  // Slider change - update local state + schedule fast seek
  const handleSliderChange = useCallback((e) => {
    const value = parseInt(e.target.value);
    setSliderValue(value);
    scheduleSeek(value);
  }, [scheduleSeek]);

  // Start dragging
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // End dragging - commit final frame
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // Final seek to exact position
    const finalFrame = sliderValue;
    lastSeekFrameRef.current = finalFrame;
    
    // Use seekFrame for final position to ensure accuracy
    if (seekFrame) {
      seekFrame(finalFrame);
    } else if (endSeek) {
      endSeek(finalFrame);
    }
  }, [sliderValue, endSeek, seekFrame]);

  // Toggle play/pause
  const handleTogglePlay = useCallback(() => {
    // This should be handled by the parent via videoRef
    // For now, just call a no-op or implement via seekFrame
  }, []);

  // Frame input handlers
  const handleFrameInputChange = useCallback((val) => {
    setFrameInput(val);
    const frame = parseInt(val);
    if (!isNaN(frame) && frame >= 0 && frame < totalFrames) {
      if (seekFrameFast) seekFrameFast(frame);
    }
  }, [totalFrames, seekFrameFast]);

  const handleFrameInputBlur = useCallback(() => {
    const frame = parseInt(frameInput);
    if (!isNaN(frame) && frame >= 0 && frame < totalFrames) {
      if (seekFrame) seekFrame(frame);
    }
    setFrameInput("");
  }, [frameInput, totalFrames, seekFrame]);

  const handleFrameInputKey = useCallback((e) => {
    if (e.key === "Enter") {
      const frame = parseInt(frameInput);
      if (!isNaN(frame) && frame >= 0 && frame < totalFrames) {
        if (seekFrame) seekFrame(frame);
      }
      setFrameInput("");
    } else if (e.key === "Escape") {
      setFrameInput("");
    }
  }, [frameInput, totalFrames, seekFrame]);

  // Button handlers
  const seekRelative = useCallback((offset) => {
    const newFrame = Math.max(0, Math.min(sliderValue + offset, totalFrames - 1));
    setSliderValue(newFrame);
    if (seekFrame) seekFrame(newFrame);
  }, [sliderValue, totalFrames, seekFrame]);

  if (totalFrames <= 0) {
    return (
      <div style={{ 
        ...S.card, 
        borderRadius: 0, 
        borderLeft: "none", 
        borderRight: "none", 
        borderTop: "none", 
        padding: "10px 14px",
        flexShrink: 0 
      }}>
        <div style={{ color: '#666', textAlign: 'center', fontSize: 12 }}>
          请先加载视频
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      ...S.card, 
      borderRadius: 0, 
      borderLeft: "none", 
      borderRight: "none", 
      borderTop: "none", 
      padding: "10px 14px",
      flexShrink: 0 
    }}>
      {/* Progress bar - local state only during drag */}
      <input
        type="range"
        min={0}
        max={totalFrames - 1}
        value={sliderValue}
        onChange={handleSliderChange}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        disabled={!videoReady}
        style={{ 
          width: "100%", 
          marginBottom: 8, 
          opacity: videoReady ? 1 : 0.5,
          cursor: videoReady ? 'pointer' : 'not-allowed'
        }}
      />

      {/* Control buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button 
          onClick={() => seekRelative(-10)} 
          disabled={!videoReady}
          style={{ ...S.btn(false), opacity: videoReady ? 1 : 0.5 }}
        >
          «10
        </button>
        <button 
          onClick={() => seekRelative(-1)} 
          disabled={!videoReady}
          style={{ ...S.btn(false), opacity: videoReady ? 1 : 0.5 }}
        >
          ‹1
        </button>
        <button 
          onClick={handleTogglePlay} 
          disabled={!videoReady}
          style={{ 
            ...S.btn(isPlaying, "#f59e0b"), 
            minWidth: 44, 
            textAlign: "center",
            opacity: videoReady ? 1 : 0.5 
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button 
          onClick={() => seekRelative(1)} 
          disabled={!videoReady}
          style={{ ...S.btn(false), opacity: videoReady ? 1 : 0.5 }}
        >
          1›
        </button>
        <button 
          onClick={() => seekRelative(10)} 
          disabled={!videoReady}
          style={{ ...S.btn(false), opacity: videoReady ? 1 : 0.5 }}
        >
          10»
        </button>

        {/* Frame input */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: 8 
        }}>
          <span style={{ fontSize: 11, color: "#666" }}>帧</span>
          <input
            type="number"
            value={frameInput}
            onChange={e => handleFrameInputChange(e.target.value)}
            onFocus={e => {
              setFrameInput(String(sliderValue));
              e.target.select();
            }}
            onBlur={handleFrameInputBlur}
            onKeyDown={handleFrameInputKey}
            placeholder={String(sliderValue)}
            disabled={!videoReady}
            style={{
              width: 70,
              background: "#ffffff",
              border: "1px solid #d5d5d5",
              color: "#f59e0b",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              textAlign: "center",
              opacity: videoReady ? 1 : 0.5,
              fontWeight: 600
            }}
          />
          <span style={{ fontSize: 12, color: "#888" }}>/ {totalFrames}</span>
          <span style={{ color: "#d5d5d5", marginLeft: 8 }}>|</span>
          <span style={{ color: "#666", marginLeft: 8, fontWeight: 500 }}>
            {(sliderValue / fps).toFixed(2)}s
          </span>
        </div>

        {/* Mark button placeholder */}
        <div style={{ width: 100 }} />
      </div>

      {/* Shortcuts hint */}
      <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
        键盘：← → 移帧 · Shift 加速×10 · Space 播放 · M 打标
      </div>
    </div>
  );
});

export default VideoControls;
