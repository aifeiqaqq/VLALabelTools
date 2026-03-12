/**
 * IndexedDB 数据库封装
 * 用于本地存储项目和标注数据
 * 支持多视频项目
 */

const DB_NAME = 'VLAAnnotationDB';
const DB_VERSION = 2;  // 升级版本号

/**
 * 检查浏览器是否支持 IndexedDB
 */
const checkIndexedDBSupport = () => {
  if (!window.indexedDB) {
    throw new Error('您的浏览器不支持 IndexedDB，请使用 Chrome、Edge 或 Firefox 最新版');
  }
};

/**
 * 初始化数据库
 */
export const initDB = () => {
  return new Promise((resolve, reject) => {
    try {
      checkIndexedDBSupport();
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(new Error('无法打开本地数据库，请检查浏览器存储权限'));
      };
      
      request.onsuccess = () => {
        console.log('IndexedDB 初始化成功');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // 项目存储（包含会话信息和元数据）
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectStore.createIndex('annotatorId', 'annotatorId', { unique: false });
        }

        // 视频存储（多视频支持）
        if (!db.objectStoreNames.contains('videos')) {
          const videoStore = db.createObjectStore('videos', { keyPath: 'id' });
          videoStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // 标注数据存储（按项目分组，内部按视频分组）
        if (!db.objectStoreNames.contains('annotations')) {
          db.createObjectStore('annotations', { keyPath: 'projectId' });
        }

        // 动作库存储
        if (!db.objectStoreNames.contains('actionLibrary')) {
          db.createObjectStore('actionLibrary', { keyPath: 'taskType' });
        }

        // 数据迁移（从旧版本）
        if (oldVersion < 2) {
          console.log('数据库升级：支持多视频');
        }
      };
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * 获取数据库连接（单例）
 */
let dbPromise = null;
const getDB = () => {
  if (!dbPromise) {
    dbPromise = initDB();
  }
  return dbPromise;
};

// ==================== 项目操作 ====================

export const saveProject = async (project) => {
  const db = await getDB();
  const tx = db.transaction('projects', 'readwrite');
  const store = tx.objectStore('projects');

  const data = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
};

export const getProject = async (id) => {
  const db = await getDB();
  const tx = db.transaction('projects', 'readonly');
  const store = tx.objectStore('projects');

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const listProjects = async (options = {}) => {
  const db = await getDB();
  const tx = db.transaction('projects', 'readonly');
  const store = tx.objectStore('projects');

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      let projects = request.result;
      if (options.annotatorId) {
        projects = projects.filter(p => p.annotatorId === options.annotatorId);
      }
      projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      resolve(projects);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteProject = async (id) => {
  const db = await getDB();
  const tx = db.transaction('projects', 'readwrite');
  const store = tx.objectStore('projects');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ==================== 视频操作 ====================

export const saveVideo = async (video) => {
  const db = await getDB();
  const tx = db.transaction('videos', 'readwrite');
  const store = tx.objectStore('videos');

  return new Promise((resolve, reject) => {
    const request = store.put(video);
    request.onsuccess = () => resolve(video);
    request.onerror = () => reject(request.error);
  });
};

export const getVideo = async (videoId) => {
  const db = await getDB();
  const tx = db.transaction('videos', 'readonly');
  const store = tx.objectStore('videos');

  return new Promise((resolve, reject) => {
    const request = store.get(videoId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getVideosByProject = async (projectId) => {
  const db = await getDB();
  const tx = db.transaction('videos', 'readonly');
  const store = tx.objectStore('videos');
  const index = store.index('projectId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteVideo = async (videoId) => {
  const db = await getDB();
  const tx = db.transaction('videos', 'readwrite');
  const store = tx.objectStore('videos');

  return new Promise((resolve, reject) => {
    const request = store.delete(videoId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ==================== 标注数据操作 ====================

export const saveAnnotations = async (projectId, data) => {
  const db = await getDB();
  const tx = db.transaction('annotations', 'readwrite');
  const store = tx.objectStore('annotations');

  return new Promise((resolve, reject) => {
    const request = store.put({
      projectId,
      ...data,
      savedAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAnnotations = async (projectId) => {
  const db = await getDB();
  const tx = db.transaction('annotations', 'readonly');
  const store = tx.objectStore('annotations');

  return new Promise((resolve, reject) => {
    const request = store.get(projectId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ==================== 动作库操作 ====================

export const saveActionLibrary = async (taskType, actions) => {
  const db = await getDB();
  const tx = db.transaction('actionLibrary', 'readwrite');
  const store = tx.objectStore('actionLibrary');

  return new Promise((resolve, reject) => {
    const request = store.put({
      taskType,
      actions,
      updatedAt: new Date().toISOString(),
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getActionLibrary = async (taskType) => {
  const db = await getDB();
  const tx = db.transaction('actionLibrary', 'readonly');
  const store = tx.objectStore('actionLibrary');

  return new Promise((resolve, reject) => {
    const request = store.get(taskType);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.actions : []);
    };
    request.onerror = () => reject(request.error);
  });
};

// ==================== 导出/导入 ====================

export const exportProject = async (projectId) => {
  const [project, videos, annotations] = await Promise.all([
    getProject(projectId),
    getVideosByProject(projectId),
    getAnnotations(projectId),
  ]);

  if (!project) throw new Error('项目不存在');

  return {
    version: '2.0',  // 版本升级
    exportedAt: new Date().toISOString(),
    project,
    videos,
    annotations,
  };
};

export const importProject = async (data) => {
  // 兼容两种格式：
  // 1. 备份格式: project.id
  // 2. 详细版格式: project.project_id
  const projectId = data.project?.id || data.project?.project_id;
  if (!projectId) throw new Error('无效的项目数据，缺少项目 ID');

  const newProjectId = `${projectId}_imported_${Date.now()}`;
  const idMapping = {};  // 旧ID到新ID的映射

  // 保存项目
  await saveProject({
    ...data.project,
    id: newProjectId,
    createdAt: new Date().toISOString(),
  });

  // 保存视频（生成新ID，标记文件缺失）
  if (data.videos) {
    for (const video of data.videos) {
      const newVideoId = `video_${newProjectId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 兼容两种格式: video.id 或 video.video_id
      const oldVideoId = video.id || video.video_id;
      if (oldVideoId) {
        idMapping[oldVideoId] = newVideoId;
      }
      
      await saveVideo({
        ...video,
        id: newVideoId,
        projectId: newProjectId,
        fileMissing: true,  // 标记视频文件需要重新选择
        url: null,  // 清除旧URL
      });
    }
  }

  // 保存标注数据（更新视频ID引用）
  // 兼容两种格式：
  // 1. 备份格式: data.annotations { nodes, edges, marks, actionLib }
  // 2. 详细版格式: data { nodes, marks, action_library }
  const annotations = data.annotations || {
    nodes: data.nodes || {},
    marks: data.marks || {},
    actionLib: data.action_library || data.actionLib || { drawer: [], coffee_machine: [] },
  };
  
  if (annotations) {
    const processedAnnotations = { ...annotations };
    
    // 更新 edges 和 marks 中的 video_id
    if (processedAnnotations.edges) {
      const newEdges = {};
      for (const [oldVideoId, edges] of Object.entries(processedAnnotations.edges)) {
        const newVideoId = idMapping[oldVideoId] || oldVideoId;
        newEdges[newVideoId] = edges.map(e => ({
          ...e,
          video_id: newVideoId,
          edge_id: crypto.randomUUID(),  // 重新生成ID
        }));
      }
      processedAnnotations.edges = newEdges;
    }
    
    if (processedAnnotations.marks) {
      const newMarks = {};
      for (const [oldVideoId, marks] of Object.entries(processedAnnotations.marks)) {
        const newVideoId = idMapping[oldVideoId] || oldVideoId;
        newMarks[newVideoId] = marks.map(m => ({
          ...m,
          video_id: newVideoId,
          ref_id: crypto.randomUUID(),  // 重新生成ID
        }));
      }
      processedAnnotations.marks = newMarks;
    }
    
    await saveAnnotations(newProjectId, processedAnnotations);
  }

  return newProjectId;
};

// ==================== 存储统计 ====================

export const getStorageStats = async () => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percent: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0,
    };
  }
  return null;
};
