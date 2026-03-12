/**
 * 导出标注数据为 JSON 文件 (v4.0 - Unified Node Model)
 * 
 * 文件名格式：{项目名}_{时间戳}.json
 * 例如：task_drawer_001_2026-03-08T10-30-00.json
 */

/**
 * 格式化日期为文件名安全格式
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的字符串
 */
function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * 生成安全的文件名
 * @param {string} videoName - 视频文件名
 * @param {string} timestamp - 时间戳
 * @returns {string} 安全的文件名
 */
function generateFilename(videoName, timestamp) {
  // 移除视频文件的扩展名
  const baseName = videoName.replace(/\.[^/.]+$/, '');
  
  // 移除或替换不安全的文件名字符
  const safeName = baseName
    .replace(/[<>:"/\\|?*]/g, '_')  // Windows 不允许的字符
    .replace(/\s+/g, '_')            // 空格替换为下划线
    .substring(0, 50);               // 限制长度
  
  return `${safeName}_${timestamp}.json`;
}

/**
 * 检查是否支持 File System Access API
 */
function isFileSystemAccessSupported() {
  return 'showSaveFilePicker' in window;
}

/**
 * 使用 File System Access API 保存文件
 * @param {Blob} blob - 文件内容
 * @param {string} suggestedName - 建议的文件名
 * @returns {Promise<boolean>} 是否成功
 */
async function saveWithFileSystemAccess(blob, suggestedName) {
  try {
    // 显示保存对话框，让用户选择位置
    const fileHandle = await window.showSaveFilePicker({
      suggestedName: suggestedName,
      types: [
        {
          description: 'JSON 文件',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    // 写入文件
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return true;
  } catch (error) {
    // 用户取消或发生错误
    if (error.name === 'AbortError') {
      console.log('用户取消了保存');
      return false;
    }
    throw error;
  }
}

/**
 * 使用传统下载方式保存文件
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 文件名
 */
function saveWithDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 格式化 Action Library 用于导出
 * @param {Object} actionLib - 动作库对象
 * @param {string} taskType - 任务类型
 * @returns {Array} 格式化的动作库列表
 */
function formatActionLibrary(actionLib, taskType) {
  const taskActions = actionLib[taskType] || [];
  return taskActions.map(action => ({
    id: action.id,
    target: action.target,
    action_name: action.action_name,
    use_count: action.use_count || 0,
    created_by: action.created_by,
    created_at: action.created_at
  }));
}

/**
 * 导出单个视频的标注数据为 JSON (v4.0 Unified Node Model)
 * 
 * @param {Object} params - 导出参数
 * @param {string} params.annotatorId - 标注员 ID
 * @param {string} params.taskType - 任务类型
 * @param {string} params.sceneId - 场景 ID
 * @param {string} params.videoName - 视频文件名（用于生成导出文件名）
 * @param {string} params.videoId - 当前视频ID
 * @param {Array} params.segments - 段落数组（当前视频的节点列表）
 * @param {Array} params.marks - 标记/帧引用数组
 * @param {Object} params.actionLib - 动作库对象
 * @param {boolean} params.useFilePicker - 是否使用文件选择器（默认 true，如果支持）
 * @returns {Promise<{success: boolean, filename: string, method: string}>}
 */
export async function exportJson({
  annotatorId,
  taskType,
  sceneId,
  videoName,
  videoId,
  segments,
  marks,
  actionLib,
  useFilePicker = true,
}) {
  // 计算总时长
  const totalDuration = segments.reduce((sum, seg) => 
    sum + (seg.to_timestamp - seg.from_timestamp), 0
  );

  // 构建导出数据 (使用 'nodes' 字段名保持下游兼容)
  const data = {
    version: '4.0',
    export_type: 'unified_node_model',
    exported_at: new Date().toISOString(),

    session: {
      annotator_id: annotatorId,
      task_type: taskType,
      scene_id: sceneId,
      video: videoName,
    },

    statistics: {
      node_count: segments.length,
      mark_count: marks.length,
      total_duration: totalDuration,
    },

    // 使用 'nodes' 字段名保持下游ML管道兼容
    nodes: segments.map(s => ({
      node_id: s.node_id,
      from_frame: s.from_frame,
      to_frame: s.to_frame,
      from_timestamp: s.from_timestamp,
      to_timestamp: s.to_timestamp,
      parent_node: s.parent_node || null,
      actions: (s.actions || []).map(a => ({
        target: a.target || '',
        action_name: a.action_name || '',
        action_lib_id: a.action_lib_id || null,
      })),
      state_description: s.state_description,
      node_meta: s.node_meta || {},
      video_id: s.video_id,
      annotator_id: s.annotator_id,
      created_at: s.created_at,
    })),

    marks: marks.map(m => ({
      ref_id: m.ref_id,
      frame_index: m.frame_index,
      timestamp: m.timestamp,
      node_id: m.node_id,
      video_id: m.video_id,
    })),

    action_library: formatActionLibrary(actionLib, taskType),
  };

  // 生成文件名
  const timestamp = formatTimestamp();
  const filename = generateFilename(videoName || 'annotation', timestamp);

  // 创建 Blob
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  // 选择保存方式
  let method = 'download';
  let success = true;

  if (useFilePicker && isFileSystemAccessSupported()) {
    try {
      success = await saveWithFileSystemAccess(blob, filename);
      method = 'file_system_api';
      
      if (!success) {
        // 用户取消了文件选择器，尝试普通下载
        saveWithDownload(blob, filename);
      }
    } catch (error) {
      console.error('File System Access API 失败，回退到普通下载:', error);
      saveWithDownload(blob, filename);
    }
  } else {
    // 不支持 File System Access API，使用普通下载
    saveWithDownload(blob, filename);
  }

  return {
    success,
    filename,
    method,
  };
}

/**
 * 导出到指定路径（仅适用于 Electron 环境或有特定权限的 PWA）
 * 
 * @param {Object} params - 导出参数
 * @param {string} params.targetPath - 目标路径
 */
export async function exportJsonToPath({
  annotatorId,
  taskType,
  sceneId,
  videoName,
  videoId,
  segments,
  marks,
  actionLib,
  targetPath = 'data/output/output_json/',
}) {
  // 生成文件名
  const timestamp = formatTimestamp();
  const filename = generateFilename(videoName || 'annotation', timestamp);
  const fullPath = `${targetPath}${filename}`;

  // 计算总时长
  const totalDuration = segments.reduce((sum, seg) => 
    sum + (seg.to_timestamp - seg.from_timestamp), 0
  );

  // 构建导出数据
  const data = {
    version: '4.0',
    export_type: 'unified_node_model',
    exported_at: new Date().toISOString(),
    export_path: fullPath,

    session: {
      annotator_id: annotatorId,
      task_type: taskType,
      scene_id: sceneId,
      video: videoName,
    },

    statistics: {
      node_count: segments.length,
      mark_count: marks.length,
      total_duration: totalDuration,
    },

    nodes: segments.map(s => ({
      node_id: s.node_id,
      from_frame: s.from_frame,
      to_frame: s.to_frame,
      from_timestamp: s.from_timestamp,
      to_timestamp: s.to_timestamp,
      parent_node: s.parent_node || null,
      actions: (s.actions || []).map(a => ({
        target: a.target || '',
        action_name: a.action_name || '',
        action_lib_id: a.action_lib_id || null,
      })),
      state_description: s.state_description,
      node_meta: s.node_meta || {},
      video_id: s.video_id,
      annotator_id: s.annotator_id,
      created_at: s.created_at,
    })),

    marks: marks.map(m => ({
      ref_id: m.ref_id,
      frame_index: m.frame_index,
      timestamp: m.timestamp,
      node_id: m.node_id,
      video_id: m.video_id,
    })),

    action_library: formatActionLibrary(actionLib, taskType),
  };

  console.log(`尝试导出到: ${fullPath}`);

  return {
    filename,
    fullPath,
    data,
    jsonContent: JSON.stringify(data, null, 2),
  };
}

/**
 * 快速导出（使用默认设置）
 * 保持与旧版本 API 兼容
 */
export function exportJsonQuick(params) {
  return exportJson({ ...params, useFilePicker: false });
}

/**
 * 导出整个项目的所有标注数据为 JSON (v4.0 Unified Node Model)
 *
 * @param {Object} params - 导出参数
 * @param {string} params.projectId - 项目ID
 * @param {string} params.annotatorId - 标注员 ID
 * @param {string} params.taskType - 任务类型
 * @param {string} params.sceneId - 场景 ID
 * @param {Array} params.videos - 视频列表数组 [{ id, name, fps, totalFrames, duration }]
 * @param {Object} params.nodes - 统一节点对象 { node_id: node }
 * @param {Object} params.marks - 按视频分组的标记对象 { video_1: [...], video_2: [...] }
 * @param {Object} params.actionLib - 动作库对象
 * @param {boolean} params.useFilePicker - 是否使用文件选择器（默认 true，如果支持）
 * @returns {Promise<{success: boolean, filename: string, method: string}>}
 */
export async function exportProjectJson({
  projectId,
  annotatorId,
  taskType,
  sceneId,
  videos,
  nodes,
  marks,
  actionLib,
  useFilePicker = true,
}) {
  // 处理统一节点数据（删除冗余属性）
  const processedNodes = {};
  Object.entries(nodes || {}).forEach(([nodeId, node]) => {
    // 处理 video_segments，删除时间戳等冗余属性
    const processedSegments = {};
    Object.entries(node.video_segments || {}).forEach(([vid, segment]) => {
      processedSegments[vid] = {
        from_frame: segment.from_frame,
        to_frame: segment.to_frame,
        parent_node: segment.parent_node || null,
        actions: (segment.actions || []).map(a => ({
          target: a.target || '',
          action_name: a.action_name || '',
        })),
      };
    });

    processedNodes[nodeId] = {
      node_id: node.node_id,
      state_description: node.state_description,
      actions: (node.actions || []).map(a => ({
        target: a.target || '',
        action_name: a.action_name || '',
      })),
      node_meta: node.node_meta || {},
      video_segments: processedSegments,
      task_type: node.task_type,
    };
  });

  // 计算统计数据
  const totalNodes = Object.keys(nodes || {}).length;
  const totalSegments = Object.values(nodes || {}).reduce(
    (sum, node) => sum + Object.keys(node.video_segments || {}).length, 0
  );
  const totalMarks = Object.values(marks || {}).reduce(
    (sum, ms) => sum + (ms?.length || 0), 0
  );

  // 处理每个视频的 marks
  const processedMarksByVideo = {};
  Object.entries(marks || {}).forEach(([videoId, videoMarks]) => {
    processedMarksByVideo[videoId] = videoMarks.map(mark => {
      const { thumb, ...markWithoutThumb } = mark;
      return markWithoutThumb;
    });
  });

  // 构建导出数据
  const data = {
    version: '4.0',
    export_type: 'project_unified_node_model',
    exported_at: new Date().toISOString(),
    project: {
      project_id: projectId,
      annotator_id: annotatorId,
      task_type: taskType,
      scene_id: sceneId,
    },
    videos: videos.map(v => ({
      video_id: v.id,
      video_name: v.name,
      fps: v.fps,
      total_frames: v.totalFrames,
      duration: v.duration,
    })),
    statistics: {
      video_count: videos.length,
      unique_node_count: totalNodes,
      total_segment_count: totalSegments,
      total_mark_count: totalMarks,
    },
    nodes: processedNodes,
    marks: processedMarksByVideo,
    action_library: formatActionLibrary(actionLib, taskType),
  };

  // 生成文件名：使用项目ID和场景ID
  const timestamp = formatTimestamp();
  const projectName = `project_${sceneId}`;
  const filename = generateFilename(projectName, timestamp);

  // 创建 Blob
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  // 选择保存方式
  let method = 'download';
  let success = true;

  if (useFilePicker && isFileSystemAccessSupported()) {
    try {
      success = await saveWithFileSystemAccess(blob, filename);
      method = 'file_system_api';

      if (!success) {
        saveWithDownload(blob, filename);
      }
    } catch (error) {
      console.error('File System Access API 失败，回退到普通下载:', error);
      saveWithDownload(blob, filename);
    }
  } else {
    saveWithDownload(blob, filename);
  }

  return {
    success,
    filename,
    method,
  };
}

/**
 * 导出项目 Graph Meta 简略版 (参考 graph_info.json 格式)
 * 
 * @param {Object} params - 导出参数
 * @param {string} params.projectId - 项目ID
 * @param {string} params.sceneId - 场景 ID
 * @param {Object} params.nodes - 统一节点对象 { node_id: node }
 * @param {boolean} params.useFilePicker - 是否使用文件选择器（默认 true）
 * @returns {Promise<{success: boolean, filename: string, method: string}>}
 */
export async function exportProjectGraphMeta({
  projectId,
  sceneId,
  nodes,
  useFilePicker = true,
}) {
  // 转换节点为 graph_info.json 格式
  const graphNodes = Object.values(nodes || {}).map((node) => {
    // 从所有 video_segments 中收集 parents
    const videoSegments = Object.values(node.video_segments || {});
    const parentSet = new Set();
    
    videoSegments.forEach((segment) => {
      if (segment.parent_node) {
        parentSet.add(segment.parent_node);
      }
    });
    
    const parents = parentSet.size === 0 
      ? null 
      : parentSet.size === 1 
        ? Array.from(parentSet)[0]  // 单个 parent 用字符串
        : Array.from(parentSet);     // 多个 parent 用数组

    // 转换 actions 为 next_action 格式
    const nextAction = (node.actions || []).length > 0
      ? node.actions.map((a) => ({
          target: a.target || '',
          action_name: a.action_name || '',
        }))
      : null;

    return {
      node_id: node.node_id,
      state_description: node.state_description,
      next_action: nextAction,
      parents,
      center_feature: null,
    };
  });

  // 按 node_id 排序
  graphNodes.sort((a, b) => a.node_id.localeCompare(b.node_id));

  // 构建输出数据
  const data = {
    nodes: graphNodes,
  };

  // 生成文件名
  const timestamp = formatTimestamp();
  const projectName = `project_${sceneId}_meta`;
  const filename = generateFilename(projectName, timestamp);

  // 创建 Blob
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });

  // 选择保存方式
  let method = 'download';
  let success = true;

  if (useFilePicker && isFileSystemAccessSupported()) {
    try {
      success = await saveWithFileSystemAccess(blob, filename);
      method = 'file_system_api';

      if (!success) {
        saveWithDownload(blob, filename);
      }
    } catch (error) {
      console.error('File System Access API 失败，回退到普通下载:', error);
      saveWithDownload(blob, filename);
    }
  } else {
    saveWithDownload(blob, filename);
  }

  return {
    success,
    filename,
    method,
  };
}

export default exportJson;
