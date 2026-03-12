import { create } from 'zustand';

/**
 * Annotation Store - Unified Node Model (v4.0)
 * 统一节点模型：一个 node_id 对应多个视频的时间范围
 * nodes: {
 *   '001': {
 *     node_id: '001',
 *     state_description: '抽屉完全打开',
 *     actions: [{ target: 'drawer', action_name: 'open' }],
 *     node_meta: { drawer_state: 'open' },
 *     video_segments: {
 *       video_1: { from_frame: 0, to_frame: 100, from_timestamp: 0, to_timestamp: 3.33, parent_node: null },
 *       video_2: { from_frame: 0, to_frame: 120, from_timestamp: 0, to_timestamp: 4.0, parent_node: null }
 *     },
 *     task_type: 'drawer',
 *     annotator_id: 'user_01',
 *     created_at: '2026-03-11T...'
 *   }
 * }
 */
export const useAnnotationStore = create((set, get) => ({
  // ===== State =====

  // 统一节点存储
  nodes: {},

  // 帧引用（按视频分组）
  marks: {},

  // 动作库
  actionLib: { drawer: [], coffee_machine: [] },

  // ===== Getters =====

  // 获取所有节点列表
  getAllNodes: () => {
    const { nodes } = get();
    return Object.values(nodes).sort((a, b) => a.node_id.localeCompare(b.node_id));
  },

  // 获取指定视频的节点列表（包含该视频的段落信息）
  getNodesByVideo: (videoId) => {
    const { nodes } = get();
    return Object.values(nodes)
      .filter(node => node.video_segments[videoId])
      .map(node => ({
        ...node,
        ...node.video_segments[videoId],  // 展开该视频的段落信息
        video_id: videoId
      }))
      .sort((a, b) => a.from_frame - b.from_frame);
  },

  // 获取指定视频的最后一个段落
  getLastSegment: (videoId) => {
    const videoNodes = get().getNodesByVideo(videoId);
    if (videoNodes.length === 0) return null;
    return videoNodes.reduce((max, node) =>
      node.to_frame > max.to_frame ? node : max
    );
  },

  // 根据node_id查找节点
  getNodeById: (nodeId) => {
    const { nodes } = get();
    return nodes[nodeId] || null;
  },

  // 获取指定视频的标记
  getMarksByVideo: (videoId) => {
    const { marks } = get();
    return marks[videoId] || [];
  },

  // ===== Actions - Nodes =====

  // 添加或更新节点
  // 如果是新节点，创建节点；如果是已存在的节点，添加视频段落
  addOrUpdateNode: (nodeId, videoId, segmentData) => set((state) => {
    const existingNode = state.nodes[nodeId];
    
    if (existingNode) {
      // 已存在的节点，添加/更新该视频的段落
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...existingNode,
            video_segments: {
              ...existingNode.video_segments,
              [videoId]: {
                from_frame: segmentData.from_frame,
                to_frame: segmentData.to_frame,
                from_timestamp: segmentData.from_timestamp,
                to_timestamp: segmentData.to_timestamp,
                parent_node: segmentData.parent_node,
                actions: segmentData.actions,
                annotator_id: segmentData.annotator_id,
                created_at: segmentData.created_at
              }
            },
            updated_at: new Date().toISOString()
          }
        }
      };
    } else {
      // 新节点
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            node_id: nodeId,
            state_description: segmentData.state_description,
            actions: segmentData.actions,
            node_meta: segmentData.node_meta,
            video_segments: {
              [videoId]: {
                from_frame: segmentData.from_frame,
                to_frame: segmentData.to_frame,
                from_timestamp: segmentData.from_timestamp,
                to_timestamp: segmentData.to_timestamp,
                parent_node: segmentData.parent_node,
                actions: segmentData.actions,
                annotator_id: segmentData.annotator_id,
                created_at: segmentData.created_at
              }
            },
            task_type: segmentData.task_type,
            annotator_id: segmentData.annotator_id,
            created_at: segmentData.created_at,
            updated_at: new Date().toISOString()
          }
        }
      };
    }
  }),

  // 更新节点基本信息
  updateNode: (nodeId, updates) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          ...updates,
          updated_at: new Date().toISOString()
        }
      }
    };
  }),

  // 设置节点的父节点（按视频）
  setNodeParent: (nodeId, videoId, parentNodeId) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node || !node.video_segments[videoId]) return state;
    
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          video_segments: {
            ...node.video_segments,
            [videoId]: {
              ...node.video_segments[videoId],
              parent_node: parentNodeId,
              updated_at: new Date().toISOString()
            }
          },
          updated_at: new Date().toISOString()
        }
      }
    };
  }),

  // 删除节点在指定视频的段落
  deleteNodeVideoSegment: (nodeId, videoId) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;
    
    const { [videoId]: _, ...remainingSegments } = node.video_segments;
    
    // 如果该节点在所有视频中都没有段落了，则删除整个节点
    if (Object.keys(remainingSegments).length === 0) {
      const { [nodeId]: _, ...remainingNodes } = state.nodes;
      return { nodes: remainingNodes };
    }
    
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          video_segments: remainingSegments,
          updated_at: new Date().toISOString()
        }
      }
    };
  }),

  // ===== Actions - Marks =====

  addMark: (videoId, mark) => set((state) => ({
    marks: {
      ...state.marks,
      [videoId]: [...(state.marks[videoId] || []), mark]
    }
  })),

  deleteMark: (videoId, refId) => set((state) => ({
    marks: {
      ...state.marks,
      [videoId]: (state.marks[videoId] || []).filter(m => m.ref_id !== refId)
    }
  })),

  // ===== Actions - Action Library =====

  addActionLibEntry: (taskType, entry) => set((state) => ({
    actionLib: {
      ...state.actionLib,
      [taskType]: [...(state.actionLib[taskType] || []), entry]
    }
  })),

  incrementActionUseCount: (taskType, actionLibId) => set((state) => ({
    actionLib: {
      ...state.actionLib,
      [taskType]: (state.actionLib[taskType] || []).map(e =>
        e.id === actionLibId ? { ...e, use_count: e.use_count + 1 } : e
      )
    }
  })),

  deleteActionLibEntry: (taskType, actionLibId) => set((state) => ({
    actionLib: {
      ...state.actionLib,
      [taskType]: (state.actionLib[taskType] || []).filter(e => e.id !== actionLibId)
    }
  })),

  findOrCreateActionEntry: (taskType, target, actionName, annotatorId) => {
    const { actionLib } = get();
    const taskActions = actionLib[taskType] || [];

    const existing = taskActions.find(
      a => a.target === target && a.action_name === actionName
    );

    if (existing) {
      return existing.id;
    }

    const newEntry = {
      id: crypto.randomUUID(),
      target,
      action_name: actionName,
      use_count: 0,
      created_by: annotatorId,
      created_at: new Date().toISOString()
    };

    set((state) => ({
      actionLib: {
        ...state.actionLib,
        [taskType]: [...(state.actionLib[taskType] || []), newEntry]
      }
    }));

    return newEntry.id;
  },

  // ===== Actions - Reset =====

  resetAnnotations: () => set({
    nodes: {},
    marks: {},
    actionLib: { drawer: [], coffee_machine: [] }
  })
}));
