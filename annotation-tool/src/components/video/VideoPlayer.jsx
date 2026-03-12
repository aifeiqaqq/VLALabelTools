import React, { useState, useEffect } from 'react';

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
  const [videoError, setVideoError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const handleError = (e) => {
    const videoElement = videoRef.current;
    const errorCode = videoElement?.error?.code;
    const errorMessage = videoElement?.error?.message;
    // 错误代码含义：1=下载中断, 2=网络错误, 3=解码错误, 4=格式不支持
    const errorMsgs = {
      1: '视频下载被中断',
      2: '网络错误',
      3: '视频解码错误（可能文件损坏）',
      4: '视频格式不支持'
    };
    const errorMsg = errorMsgs[errorCode] || errorMessage || '无法加载视频文件';
    setVideoError(errorMsg);
  };
  
  const handleLoad = (e) => {
    const video = e?.target || videoRef.current;
    if (video) {
      // 如果视频尺寸为0，说明编码格式不被支持
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setVideoError('视频编码格式不被浏览器支持。请使用 H.264 编码的 MP4 视频，或使用工具转换视频格式。');
        setIsLoaded(false);
        return;
      }
    }
    
    setVideoError(null);
    setIsLoaded(true);
  };
  
  const handleCanPlay = () => {
    setIsLoaded(true);
  };
  
  // videoUrl 变化时重置加载状态
  useEffect(() => {
    if (videoUrl) {
      setIsLoaded(false);
      setVideoError(null);
    }
  }, [videoUrl]);

  return (
    <div style={{ 
      background: "#000", 
      flex: "0 0 auto", 
      maxHeight: 500, 
      position: "relative", 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {videoUrl ? (
        <video
          key={videoUrl}
          ref={videoRef}
          src={videoUrl}
          onLoadedMetadata={(e) => {
            handleLoad(e);
            onLoadedMetadata?.(e);
          }}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onTimeUpdate={onTimeUpdate}
          onSeeked={onSeeked}
          onPlay={onPlay}
          onPause={onPause}
          preload="auto"
          playsInline
          muted
          style={{ 
            width: "100%", 
            maxHeight: 500,
            objectFit: "contain",
            display: videoError ? "none" : "block"
          }}
        />
      ) : (
        <div style={{ 
          color: '#666', 
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '150px 20px'
        }}>
          请先上传视频
        </div>
      )}
      {videoError ? (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444",
          fontSize: 14,
          background: "rgba(0,0,0,0.9)",
          padding: "40px 30px",
          textAlign: "center",
          minHeight: 300
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>视频无法播放</div>
          <div style={{ color: "#ccc", fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
            {videoError}
          </div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 20, maxWidth: 380 }}>
            💡 转换工具推荐：使用 FFmpeg 或 HandBrake 将视频转为 H.264 编码<br/>
            命令：ffmpeg -i input.mp4 -c:v libx264 -c:a copy output.mp4
          </div>
        </div>
      ) : null}
      {videoUrl && !isLoaded && !videoError && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 14,
          background: "rgba(0,0,0,0.7)",
          zIndex: 10,
          minHeight: 300
        }}>
          <div>加载视频中...</div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
