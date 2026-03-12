import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnnotationStore } from '../stores/annotationStore';
import { useSessionStore } from '../stores/sessionStore';
import { useVideoStore } from '../stores/videoStore';
import { saveAnnotations, getAnnotations, getVideosByProject, getProject } from '../utils/db';
import { getVideoUrl } from '../utils/localFs';

/**
 * 防抖函数
 */
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * 持久化 Hook
 * 自动保存标注数据（多视频版本，统一节点模型）
 */
export const usePersistence = (projectId, options = {}) => {
  const { saveDelay = 2000, enabled = true } = options;
  
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  // 订阅标注数据变化并自动保存
  useEffect(() => {
    if (!enabled || !projectId) return;

    const unsubscribe = useAnnotationStore.subscribe(
      debounce((state) => {
        saveAnnotations(projectId, {
          nodes: state.nodes,
          marks: state.marks,
          actionLib: state.actionLib,
        }).then(() => {
          setLastSaved(new Date());
        }).catch((err) => {
          console.error('自动保存失败:', err);
          setError(err.message);
        });
      }, saveDelay)
    );

    return () => unsubscribe();
  }, [projectId, enabled, saveDelay]);

  return { lastSaved, error };
};

/**
 * 创建新项目的 Hook（简化版）
 */
export const useCreateProject = () => {
  const [isCreating, setIsCreating] = useState(false);

  const createProject = useCallback(async (params) => {
    setIsCreating(true);
    // 实际逻辑在 SetupPage 中实现
    setIsCreating(false);
  }, []);

  return { createProject, isCreating, error: null };
};

/**
 * 加载项目的 Hook
 * 加载标注数据和视频数据（统一节点模型 v4.0）
 */
export const useLoadProject = () => {
  const [isLoading, setIsLoading] = useState(false);

  const loadProject = useCallback(async (projectId) => {
    setIsLoading(true);
    console.log('[Debug] 开始加载项目:', projectId);
    try {
      // 并行加载项目信息、标注数据和视频列表
      const [project, annotations, videoList] = await Promise.all([
        getProject(projectId),
        getAnnotations(projectId),
        getVideosByProject(projectId),
      ]);
      
      console.log('[Debug] 加载结果:', {
        project: project ? '找到' : '未找到',
        annotations: annotations ? '找到' : '未找到',
        videoCount: videoList?.length || 0
      });

      // 设置 session 状态
      if (project) {
        console.log('[Debug] 设置 session 状态:', {
          annotatorId: project.annotatorId,
          taskType: project.taskType,
          started: true
        });
        useSessionStore.setState({
          annotatorId: project.annotatorId || 'annotator_01',
          taskType: project.taskType || 'drawer',
          sceneId: project.sceneId || 'lab_001',
          started: true,  // 标记会话已开始
        });
        console.log('[Debug] session 状态已设置');
      } else {
        console.error('[Debug] 项目不存在:', projectId);
      }

      // 加载标注数据（统一节点模型 v4.0）
      if (annotations) {
        // 支持新旧数据格式的迁移：如果有旧格式的 segments，尝试转换
        let nodes = annotations.nodes || {};
        
        // 数据迁移：如果存在旧格式的 segments 但没有 nodes，尝试转换
        if (Object.keys(nodes).length === 0 && annotations.segments) {
          console.log('[Debug] 检测到旧格式数据，进行迁移...');
          nodes = migrateSegmentsToNodes(annotations.segments);
        }

        useAnnotationStore.setState({
          nodes: nodes,
          marks: annotations.marks || {},
          actionLib: annotations.actionLib || { drawer: [], coffee_machine: [] },
        });
      }

      // 加载视频数据 - 从 OPFS 获取 Blob URL
      console.log('[Debug] 视频列表:', videoList);
      if (videoList && videoList.length > 0) {
        console.log('[Debug] 开始加载视频 URL，数量:', videoList.length);
        const videosWithUrls = await Promise.all(
          videoList.map(async (video) => {
            try {
              console.log('[Debug] 加载视频:', video.id, video.name);
              const url = await getVideoUrl(video.id);
              console.log('[Debug] 视频 URL 创建成功:', video.id);
              return {
                ...video,
                url,
              };
            } catch (err) {
              console.error(`[Debug] 加载视频 ${video.id} 失败:`, err);
              return null;
            }
          })
        );
        console.log('[Debug] 有效视频数量:', videosWithUrls.filter(v => v !== null).length);

        // 过滤掉加载失败的视频
        const validVideos = videosWithUrls.filter(v => v !== null);

        // 设置视频列表
        console.log('[Debug] 设置 videoStore，视频数:', validVideos.length);
        useVideoStore.setState({
          videos: validVideos,
          currentVideoId: validVideos.length > 0 ? validVideos[0].id : null,
          currentFrame: 0,
          totalFrames: validVideos.length > 0 ? validVideos[0].totalFrames : 0,
          fps: validVideos.length > 0 ? validVideos[0].fps : 30,
          videoReady: false,
          isPlaying: false,
          isSeeking: false,
        });
        console.log('[Debug] videoStore 已设置');
      } else {
        console.log('[Debug] 没有视频需要加载');
        // 没有视频时清空视频状态
        useVideoStore.setState({
          videos: [],
          currentVideoId: null,
          currentFrame: 0,
          totalFrames: 0,
          fps: 30,
          videoReady: false,
          isPlaying: false,
          isSeeking: false,
        });
      }

      console.log('[Debug] 项目加载完成');
      return true;
    } catch (error) {
      console.error('[Debug] 加载项目失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { loadProject, isLoading, error: null };
};

/**
 * 数据迁移：将旧格式的 segments 转换为统一节点模型
 * @param {Object} segments - 旧格式的 segments { videoId: [segment, ...] }
 * @returns {Object} 新格式的 nodes { node_id: node }
 */
function migrateSegmentsToNodes(segments) {
  const nodes = {};
  
  Object.entries(segments).forEach(([videoId, videoSegments]) => {
    videoSegments.forEach(segment => {
      const nodeId = segment.node_id;
      
      if (!nodes[nodeId]) {
        // 创建新节点
        nodes[nodeId] = {
          node_id: nodeId,
          state_description: segment.state_description,
          actions: segment.actions || (segment.action ? [segment.action] : []),
          node_meta: segment.node_meta || {},
          video_segments: {},
          task_type: segment.task_type,
          annotator_id: segment.annotator_id,
          created_at: segment.created_at,
          updated_at: new Date().toISOString(),
        };
      }
      
      // 添加该视频的段落信息
      nodes[nodeId].video_segments[videoId] = {
        from_frame: segment.from_frame,
        to_frame: segment.to_frame,
        from_timestamp: segment.from_timestamp,
        to_timestamp: segment.to_timestamp,
        parent_node: segment.parent_node || null,
        actions: segment.actions || (segment.action ? [segment.action] : []),
        annotator_id: segment.annotator_id,
        created_at: segment.created_at,
      };
    });
  });
  
  console.log('[Debug] 数据迁移完成，节点数:', Object.keys(nodes).length);
  return nodes;
}

/**
 * 删除项目的 Hook
 */
export const useDeleteProject = () => {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteProject = useCallback(async (projectId) => {
    setIsDeleting(true);
    // 实际逻辑在 ProjectsPage 中实现
    setIsDeleting(false);
  }, []);

  return { deleteProject, isDeleting };
};
