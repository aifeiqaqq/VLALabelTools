import React from 'react';

/**
 * VideoPlayer Component
 * Displays video with canvas for frame capture
 */
const VideoPlayer = React.memo(function VideoPlayer({
  videoRef,
  canvasRef,
  videoUrl,
  videoReady,
  onLoadedMetadata,
  onTimeUpdate,
  onSeeked,
  onPlay,
  onPause
}) {
  return (
    <div style={{ background: "#000", flex: "0 0 auto", height: 450, maxHeight: 500, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <video
        ref={videoRef}
        src={videoUrl}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onSeeked={onSeeked}
        onPlay={onPlay}
        onPause={onPause}
        preload="auto"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      {!videoReady && videoUrl && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
          fontSize: 12,
          background: "rgba(0,0,0,0.5)"
        }}>
          加载视频中...
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
