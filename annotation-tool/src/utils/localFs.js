/**
 * Origin Private File System (OPFS) 封装
 * 用于在浏览器本地存储视频文件 - 优化版本
 * 
 * 优化点：
 * - 使用分块写入提高性能
 * - 使用 requestAnimationFrame 减少 UI 阻塞
 * - 支持取消操作
 */

const VIDEOS_DIR = 'videos';
const CHUNK_SIZE = 1024 * 1024; // 1MB 分块大小

/**
 * 检查 OPFS 是否可用
 */
export const isOPFSAvailable = () => {
  return 'storage' in navigator && 'getDirectory' in navigator.storage;
};

/**
 * 获取视频目录句柄
 */
const getVideosDir = async () => {
  if (!isOPFSAvailable()) {
    throw new Error('您的浏览器不支持本地文件存储');
  }

  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(VIDEOS_DIR, { create: true });
};

/**
 * 保存视频文件 - 优化版本
 * 使用分块写入和节流进度回调提高性能
 * 
 * @param {File} file - 视频文件对象
 * @param {string} videoId - 视频唯一标识
 * @param {Function} onProgress - 进度回调 (loaded, total)
 * @param {AbortSignal} signal - 取消信号
 */
export const saveVideoFile = async (file, videoId, onProgress = null, signal = null) => {
  const videosDir = await getVideosDir();
  const fileHandle = await videosDir.getFileHandle(videoId, { create: true });

  // 使用流式写入
  const writable = await fileHandle.createWritable();
  
  try {
    // 使用 Blob 分块而不是 Stream，性能更好
    const total = file.size;
    let loaded = 0;
    let lastProgressUpdate = 0;
    
    // 分块处理
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      // 检查是否取消
      if (signal?.aborted) {
        throw new Error('用户取消');
      }
      
      const end = Math.min(start + CHUNK_SIZE, total);
      const chunk = file.slice(start, end);
      
      await writable.write(chunk);
      loaded += chunk.size;
      
      // 节流进度回调（每 100ms 最多一次）
      const now = Date.now();
      if (onProgress && (now - lastProgressUpdate > 100 || loaded === total)) {
        onProgress(loaded, total);
        lastProgressUpdate = now;
        
        // 让出主线程，避免阻塞 UI
        if (loaded < total) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
    }
  } catch (error) {
    // 出错时删除不完整的文件
    try {
      await writable.abort();
    } catch (e) {
      // ignore
    }
    throw error;
  } finally {
    try {
      await writable.close();
    } catch (e) {
      // ignore
    }
  }

  return videoId;
};

/**
 * 快速保存视频（不显示进度，用于小文件）
 */
export const saveVideoFileFast = async (file, videoId) => {
  const videosDir = await getVideosDir();
  const fileHandle = await videosDir.getFileHandle(videoId, { create: true });
  
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(file);
  } finally {
    await writable.close();
  }
  
  return videoId;
};

/**
 * 获取视频文件
 */
export const getVideoFile = async (videoId) => {
  try {
    const videosDir = await getVideosDir();
    const fileHandle = await videosDir.getFileHandle(videoId);
    return fileHandle.getFile();
  } catch (error) {
    if (error.name === 'NotFoundError') {
      throw new Error('视频文件不存在');
    }
    throw error;
  }
};

/**
 * 获取视频文件的 Blob URL（用于播放）
 */
export const getVideoUrl = async (videoId) => {
  const file = await getVideoFile(videoId);
  return URL.createObjectURL(file);
};

/**
 * 检查视频文件是否存在
 */
export const hasVideoFile = async (videoId) => {
  try {
    const videosDir = await getVideosDir();
    await videosDir.getFileHandle(videoId);
    return true;
  } catch {
    return false;
  }
};

/**
 * 删除视频文件
 */
export const deleteVideoFile = async (videoId) => {
  try {
    const videosDir = await getVideosDir();
    await videosDir.removeEntry(videoId);
  } catch (error) {
    if (error.name !== 'NotFoundError') {
      throw error;
    }
  }
};

/**
 * 复制视频文件
 */
export const copyVideoFile = async (sourceId, targetId) => {
  const sourceFile = await getVideoFile(sourceId);
  await saveVideoFile(sourceFile, targetId);
};

/**
 * 获取视频文件信息
 */
export const getVideoFileInfo = async (videoId) => {
  const file = await getVideoFile(videoId);
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    sizeFormatted: formatFileSize(file.size),
  };
};

/**
 * 列出所有视频文件
 */
export const listVideoFiles = async () => {
  const videosDir = await getVideosDir();
  const files = [];

  for await (const [name, handle] of videosDir.entries()) {
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      files.push({
        id: name,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        lastModified: file.lastModified,
      });
    }
  }

  return files.sort((a, b) => b.lastModified - a.lastModified);
};

/**
 * 清理未关联的视频文件
 */
export const cleanupVideoFiles = async (validIds) => {
  const allFiles = await listVideoFiles();
  let cleaned = 0;

  for (const file of allFiles) {
    if (!validIds.has(file.id)) {
      await deleteVideoFile(file.id);
      cleaned++;
    }
  }

  return cleaned;
};

/**
 * 计算视频文件总大小
 */
export const getTotalVideoSize = async () => {
  const files = await listVideoFiles();
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return {
    bytes: total,
    formatted: formatFileSize(total),
    count: files.length,
  };
};

// ==================== 工具函数 ====================

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/**
 * 从 File 对象读取视频元数据
 */
export const extractVideoMetadata = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error('无法读取视频元数据'));
    };

    video.src = URL.createObjectURL(file);
  });
};

// ==================== 兼容性处理 ====================

const FALLBACK_DB_NAME = 'VLAVideoFallbackDB';

export const fallbackStorage = {
  save: async (file, videoId, onProgress) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FALLBACK_DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // 分块存储大文件
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const chunks = Math.ceil(file.size / chunkSize);
        let currentChunk = 0;
        
        const storeChunk = () => {
          if (currentChunk >= chunks) {
            resolve(videoId);
            return;
          }
          
          const start = currentChunk * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const blob = file.slice(start, end);
          
          const reader = new FileReader();
          reader.onload = () => {
            const tx = db.transaction('videos', 'readwrite');
            const store = tx.objectStore('videos');
            
            store.put({
              id: `${videoId}_chunk_${currentChunk}`,
              data: reader.result,
              index: currentChunk,
              totalChunks: chunks,
            });
            
            tx.oncomplete = () => {
              currentChunk++;
              if (onProgress) {
                onProgress(Math.min(end, file.size), file.size);
              }
              storeChunk();
            };
          };
          reader.readAsArrayBuffer(blob);
        };
        
        storeChunk();
      };

      request.onerror = () => reject(request.error);
    });
  },

  get: async (videoId) => {
    // 实现获取逻辑...
    throw new Error('Fallback get not fully implemented');
  },
};
