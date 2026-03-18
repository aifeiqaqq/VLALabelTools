import { create } from 'zustand';

/**
 * Normalize parent_node field to array format
 * Ensures backward compatibility with old single-parent format
 *
 * @param {null|string|string[]} parentNode - Parent node(s)
 * @returns {string[]} Normalized array of parent node IDs
 *
 * @example
 * normalizeParentNode(null) => []
 * normalizeParentNode("001") => ["001"]
 * normalizeParentNode(["001", "002"]) => ["001", "002"]
 */
export function normalizeParentNode(parentNode) {
  if (!parentNode) return [];
  if (Array.isArray(parentNode)) return parentNode;
  if (typeof parentNode === 'string') return [parentNode];
  return [];
}

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
 *       video_1: { from_frame: 0, to_frame: 100, from_timestamp: 0, to_timestamp: 3.33, parent_node: [] },
 *       video_2: { from_frame: 0, to_frame: 120, from_timestamp: 0, to_timestamp: 4.0, parent_node: [] }
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

  // 路线存储
  routes: {},

  // 当前激活的路线（用于路线标注模式）
  activeRoute: null,

  // 路线标注进度
  routeProgress: null, // { routeId, currentIndex, totalNodes }

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

  // 获取所有路线列表
  getAllRoutes: () => {
    const { routes } = get();
    return Object.values(routes).sort((a, b) => a.route_id.localeCompare(b.route_id));
  },

  // 根据route_id查找路线
  getRouteById: (routeId) => {
    const { routes } = get();
    return routes[routeId] || null;
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

    // 如果更新包含actions，同步更新所有video_segments中的actions
    let updatedVideoSegments = node.video_segments;
    if (updates.actions !== undefined && node.video_segments) {
      updatedVideoSegments = { ...node.video_segments };
      Object.keys(updatedVideoSegments).forEach(videoId => {
        updatedVideoSegments[videoId] = {
          ...updatedVideoSegments[videoId],
          actions: updates.actions
        };
      });
    }

    return {
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          ...updates,
          video_segments: updatedVideoSegments,
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
  // 注意：只删除video_segments中的对应视频，保留节点定义
  // 这样从JSON导入的节点分类会被保留，即使在所有视频中都没有实例
  // 同时删除该视频中所有引用该节点的marks，保持数据一致性
  deleteNodeVideoSegment: (nodeId, videoId) => set((state) => {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const { [videoId]: _, ...remainingSegments } = node.video_segments;

    // 删除该视频中所有引用该节点的marks
    const videoMarks = state.marks[videoId] || [];
    const cleanedMarks = videoMarks.filter(mark => mark.node_id !== nodeId);

    // 保留节点定义，只删除当前视频的segment
    // 即使remainingSegments为空，也保留节点（用于导入的节点分类）
    return {
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...node,
          video_segments: remainingSegments,
          updated_at: new Date().toISOString()
        }
      },
      marks: {
        ...state.marks,
        [videoId]: cleanedMarks
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

  // 删除视频的所有标注数据（marks 和 nodes 中的 video_segments）
  deleteVideoAnnotations: (videoId) => set((state) => {
    // 1. 删除该视频的所有 marks
    const { [videoId]: _, ...remainingMarks } = state.marks;
    
    // 2. 从所有 nodes 中删除该视频的 video_segments
    const updatedNodes = {};
    Object.entries(state.nodes).forEach(([nodeId, node]) => {
      const { [videoId]: removedSegment, ...remainingSegments } = node.video_segments || {};
      // 如果节点还有其他视频的段落，保留节点；否则删除整个节点
      if (Object.keys(remainingSegments).length > 0) {
        updatedNodes[nodeId] = {
          ...node,
          video_segments: remainingSegments
        };
      }
      // 如果没有剩余段落，则不添加到 updatedNodes（即删除）
    });
    
    return {
      marks: remainingMarks,
      nodes: updatedNodes
    };
  }),

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

  // ===== Actions - Routes =====

  /**
   * Add a route to the store
   */
  addRoute: (route) => set((state) => ({
    routes: {
      ...state.routes,
      [route.route_id]: route
    }
  })),

  /**
   * Delete a route from the store
   */
  deleteRoute: (routeId) => set((state) => {
    const { [routeId]: _, ...remainingRoutes } = state.routes;
    return { routes: remainingRoutes };
  }),

  /**
   * Set active route and initialize progress
   */
  setActiveRoute: (routeId) => {
    const route = get().getRouteById(routeId);
    if (!route) return;

    set({
      activeRoute: route,
      routeProgress: {
        routeId: routeId,
        currentIndex: 0,
        totalNodes: route.node_sequence.length
      }
    });
  },

  /**
   * Advance to next node in route
   */
  advanceRouteProgress: () => set((state) => {
    if (!state.routeProgress || !state.activeRoute) return state;

    const newIndex = state.routeProgress.currentIndex + 1;

    // Check if we've reached the end
    if (newIndex >= state.activeRoute.node_sequence.length) {
      return state; // Don't advance past the end
    }

    return {
      routeProgress: {
        ...state.routeProgress,
        currentIndex: newIndex
      }
    };
  }),

  /**
   * Go back to previous node in route
   * 回退到上一个节点（撤销功能）
   */
  retreatRouteProgress: () => set((state) => {
    if (!state.routeProgress || !state.activeRoute) return state;

    const newIndex = state.routeProgress.currentIndex - 1;

    // Check if we're already at the beginning
    if (newIndex < 0) {
      return state; // Don't go before the start
    }

    return {
      routeProgress: {
        ...state.routeProgress,
        currentIndex: newIndex
      }
    };
  }),

  /**
   * Jump to specific node index in route
   * 跳转到路由中的指定节点索引
   */
  setRouteProgressIndex: (index) => set((state) => {
    if (!state.routeProgress || !state.activeRoute) return state;

    // Validate index bounds
    if (index < 0 || index >= state.activeRoute.node_sequence.length) {
      return state;
    }

    return {
      routeProgress: {
        ...state.routeProgress,
        currentIndex: index
      }
    };
  }),

  /**
   * Reset route progress and clear active route
   */
  resetRouteProgress: () => set({
    activeRoute: null,
    routeProgress: null
  }),

  // ===== Actions - Meta Import =====

  /**
   * Import nodes from meta JSON (bulk operation)
   * Merges imported nodes with existing nodes
   */
  importMetaNodes: (nodesToImport) => set((state) => ({
    nodes: { ...state.nodes, ...nodesToImport }
  })),

  /**
   * Import routes from meta JSON (bulk operation)
   * Merges imported routes with existing routes
   */
  importMetaRoutes: (routesToImport) => set((state) => ({
    routes: { ...state.routes, ...routesToImport }
  })),

  // ===== Actions - Reset =====

  resetAnnotations: () => set({
    nodes: {},
    marks: {},
    actionLib: { drawer: [], coffee_machine: [] },
    routes: {},
    activeRoute: null,
    routeProgress: null
  })
}));
