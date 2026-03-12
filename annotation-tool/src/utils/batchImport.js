/**
 * 批量导入视频工具函数
 * 用于支持目录批量导入功能
 */

import { saveVideoFile, extractVideoMetadata } from './localFs';
import { saveVideo } from './db';

/**
 * 验证单个视频文件
 * @param {File} file - 视频文件对象
 * @throws {Error} 如果文件无效
 * @returns {boolean} 验证通过返回true
 */
export const validateVideoFile = (file) => {
  if (!file.type.startsWith('video/')) {
    throw new Error('不是视频文件');
  }

  const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
  if (file.size > maxSize) {
    throw new Error('文件过大（超过2GB）');
  }

  return true;
};

/**
 * 从文件列表中过滤出视频文件
 * @param {FileList} fileList - 文件列表（来自input或拖拽）
 * @returns {{videoFiles: File[], errors: Array<{file: string, error: string}>}}
 */
export const filterVideoFiles = (fileList) => {
  const files = Array.from(fileList);
  const videoFiles = [];
  const errors = [];

  for (const file of files) {
    try {
      if (file.type.startsWith('video/')) {
        validateVideoFile(file);
        videoFiles.push(file);
      }
    } catch (err) {
      errors.push({ file: file.name, error: err.message });
    }
  }

  return { videoFiles, errors };
};

/**
 * 处理单个视频文件（核心复用函数）
 * 包含：保存到OPFS、提取元数据、保存到IndexedDB
 *
 * @param {File} file - 视频文件对象
 * @param {string} projectId - 项目ID
 * @param {number} videoIndex - 视频序号（从1开始）
 * @param {Function} onProgress - 进度回调函数 (loaded, total)
 * @returns {Promise<{videoId: string, metadata: object, videoUrl: string}>}
 */
export const processSingleVideo = async (file, projectId, videoIndex, onProgress = null) => {
  const randomSuffix = Math.random().toString(36).substr(2, 6);
  const videoId = `v${videoIndex}_${randomSuffix}`;

  // 1. 保存视频文件到OPFS
  await saveVideoFile(file, videoId, onProgress);

  // 2. 提取视频元数据
  const metadata = await extractVideoMetadata(file);
  const fps = 30; // 固定30fps
  const totalFrames = Math.floor(metadata.duration * fps);

  // 3. 保存视频信息到IndexedDB
  await saveVideo({
    id: videoId,
    projectId,
    name: file.name,
    fps,
    totalFrames,
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    createdAt: new Date().toISOString(),
  });

  // 4. 创建Blob URL用于前端播放
  const videoUrl = URL.createObjectURL(file);

  // 5. 返回VideoStore所需的数据
  return {
    videoId,
    metadata: {
      fps,
      totalFrames,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
    },
    videoUrl,
  };
};

/**
 * 计算总体进度百分比
 * @param {number} currentIndex - 当前视频索引（从1开始）
 * @param {number} totalCount - 视频总数
 * @param {number} filePercent - 当前文件进度（0-100）
 * @returns {number} 总体进度百分比（0-100）
 */
export const calculateOverallProgress = (currentIndex, totalCount, filePercent) => {
  // 公式：((当前索引-1) / 总数 + 当前文件进度/100/总数) * 100
  return Math.round(
    ((currentIndex - 1) / totalCount + filePercent / 100 / totalCount) * 100
  );
};
