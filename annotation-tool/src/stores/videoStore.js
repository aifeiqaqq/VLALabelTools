import { create } from 'zustand';

/**
 * Video Store - 支持多视频管理
 * Manages multiple videos in a project
 */
export const useVideoStore = create((set, get) => ({
  // ===== State =====
  
  // 当前项目中的所有视频
  videos: [],
  
  // 当前激活的视频ID
  currentVideoId: null,
  
  // 当前视频的播放状态
  currentFrame: 0,
  totalFrames: 0,
  fps: 30,
  videoReady: false,
  isPlaying: false,
  isSeeking: false,
  
  // 每个视频的初始帧位置 { videoId: frameIndex }
  initialFrames: {},

  // ===== Getters =====
  
  getCurrentVideo: () => {
    const { videos, currentVideoId } = get();
    return videos.find(v => v.id === currentVideoId) || null;
  },
  
  getVideoById: (videoId) => {
    const { videos } = get();
    return videos.find(v => v.id === videoId) || null;
  },

  // ===== Actions - Video Management =====
  
  // 添加新视频到项目
  addVideo: (videoData) => set((state) => ({
    videos: [...state.videos, {
      ...videoData,
      createdAt: new Date().toISOString(),
    }],
  })),
  
  // 移除视频
  removeVideo: (videoId) => set((state) => ({
    videos: state.videos.filter(v => v.id !== videoId),
    currentVideoId: state.currentVideoId === videoId 
      ? (state.videos.find(v => v.id !== videoId)?.id || null)
      : state.currentVideoId,
  })),
  
  // 切换当前视频
  switchVideo: (videoId) => set((state) => {
    const video = state.videos.find(v => v.id === videoId);
    if (!video) return {};
    
    return {
      currentVideoId: videoId,
      currentFrame: 0,
      totalFrames: video.totalFrames || 0,
      fps: video.fps || 30,
      videoReady: false,
      isPlaying: false,
      isSeeking: false,
    };
  }),
  
  // 设置当前视频ID（初始化时使用）
  setCurrentVideoId: (videoId) => set({ currentVideoId: videoId }),

  // ===== Actions - Playback State =====
  
  setVideoMetadata: (fps, totalFrames) => set({
    fps,
    totalFrames,
    videoReady: true,
  }),

  setCurrentFrame: (frame) => set({ currentFrame: frame }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsSeeking: (seeking) => set({ isSeeking: seeking }),

  seekFrame: (frameIndex) => {
    const { totalFrames } = get();
    const clamped = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    set({ currentFrame: clamped, isSeeking: true });
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  // ===== Actions - Initial Frame =====
  
  setInitialFrame: (videoId, frameIndex) => set((state) => ({
    initialFrames: { ...state.initialFrames, [videoId]: frameIndex },
  })),
  
  getInitialFrame: (videoId) => {
    return get().initialFrames[videoId] ?? 0;
  },
  
  clearInitialFrame: (videoId) => set((state) => {
    const { [videoId]: _, ...rest } = state.initialFrames;
    return { initialFrames: rest };
  }),

  // ===== Reset =====
  
  resetVideos: () => set({
    videos: [],
    currentVideoId: null,
    currentFrame: 0,
    totalFrames: 0,
    fps: 30,
    videoReady: false,
    isPlaying: false,
    isSeeking: false,
  }),
}));
