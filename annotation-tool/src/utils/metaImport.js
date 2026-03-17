/**
 * Meta JSON Import Utility
 *
 * Imports node definitions from lightweight meta JSON exports
 * to reuse node taxonomies across different projects.
 *
 * Version: 1.0
 * Phase: MVP - Basic import with conflict skipping
 */

/**
 * Validate meta JSON format
 * @param {Object} data - Parsed JSON data
 * @throws {Error} If validation fails
 * @returns {boolean} True if valid
 */
export function validateMetaJson(data) {
  if (!data.nodes || !Array.isArray(data.nodes)) {
    throw new Error('文件格式错误：缺少 nodes 数组');
  }

  if (data.nodes.some(n => !n.node_id)) {
    throw new Error('文件格式错误：某些节点缺少 node_id');
  }

  if (data.nodes.some(n => !n.state_description || !n.state_description.trim())) {
    throw new Error('文件格式错误：某些节点缺少 state_description');
  }

  // Note: project metadata is optional for backward compatibility with older meta files
  // New files will include project.project_id, project.task_type, etc.

  return true;
}

/**
 * Normalize parent field from meta format to array format
 * Handles: null, "001" (string), ["001", "002"] (array)
 *
 * @param {null|string|string[]} parents - Parent data from meta JSON
 * @returns {string[]} Normalized parent array
 */
function normalizeParents(parents) {
  if (!parents) return [];
  if (typeof parents === 'string') return [parents];
  if (Array.isArray(parents)) return parents; // 返回完整数组
  return [];
}

/**
 * Transform meta node to internal format
 *
 * Meta format:
 * {
 *   node_id: "001",
 *   state_description: "...",
 *   next_action: [{target: "...", action_name: "..."}] | null,
 *   parents: null | "001" | ["001", "002"],
 *   center_feature: null
 * }
 *
 * Internal format:
 * {
 *   node_id: "001",
 *   state_description: "...",
 *   actions: [{target: "...", action_name: "..."}],
 *   node_meta: { suggested_parents: ["001"] | ["001", "002"], imported_at: "..." },
 *   video_segments: {},
 *   task_type: "drawer",
 *   annotator_id: "...",
 *   created_at: "...",
 *   updated_at: "..."
 * }
 *
 * @param {Object} metaNode - Node from meta JSON
 * @param {Object} sessionData - Current session { taskType, annotatorId }
 * @returns {Object} Transformed node in internal format
 */
function transformMetaNode(metaNode, sessionData) {
  return {
    node_id: metaNode.node_id,
    state_description: metaNode.state_description.trim(),

    // Convert next_action → actions, handle null case
    actions: Array.isArray(metaNode.next_action)
      ? metaNode.next_action.map(a => ({
          target: a.target || '',
          action_name: a.action_name || ''
        }))
      : [],

    // Store parent suggestion for future use (Phase 2 will use this in EditModal)
    node_meta: {
      suggested_parents: normalizeParents(metaNode.parents),
      imported_at: new Date().toISOString()
    },

    // Initialize empty - user will fill when annotating videos
    video_segments: {},

    // Session data
    task_type: sessionData.taskType,
    annotator_id: sessionData.annotatorId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Import node library from meta JSON
 * MVP: Skip conflicts, no action library import
 *
 * @param {Object} metaData - Parsed meta JSON data
 * @param {Object} sessionData - { taskType, annotatorId }
 * @param {Object} existingNodes - Current nodes from annotationStore
 * @returns {Object} Import result with nodes to import and conflict info
 */
export function importNodeLibrary(metaData, sessionData, existingNodes) {
  // 1. Validate format
  validateMetaJson(metaData);

  // 2. Transform all nodes from meta to internal format
  const transformedNodes = {};
  for (const metaNode of metaData.nodes) {
    const nodeId = metaNode.node_id;
    transformedNodes[nodeId] = transformMetaNode(metaNode, sessionData);
  }

  // 3. Check for conflicts (skip conflicts in MVP)
  const conflicts = [];
  const nonConflicts = {};

  for (const [nodeId, nodeData] of Object.entries(transformedNodes)) {
    if (existingNodes[nodeId]) {
      conflicts.push({
        nodeId,
        existing: existingNodes[nodeId].state_description,
        imported: nodeData.state_description
      });
    } else {
      nonConflicts[nodeId] = nodeData;
    }
  }

  // 4. Return results
  return {
    nodesToImport: nonConflicts,
    conflicts,
    totalCount: Object.keys(transformedNodes).length,
    importCount: Object.keys(nonConflicts).length,
    skipCount: conflicts.length
  };
}

/**
 * Validate routes in meta JSON
 * @param {Array} routes - Routes array from JSON
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
export function validateRoutes(routes) {
  if (!Array.isArray(routes)) {
    throw new Error('路由数据格式错误：routes 必须是数组');
  }

  for (const route of routes) {
    if (!route.route_id || typeof route.route_id !== 'string') {
      throw new Error('路由数据格式错误：route_id 缺失或格式不正确');
    }

    if (!route.route_name || typeof route.route_name !== 'string') {
      throw new Error('路由数据格式错误：route_name 缺失或格式不正确');
    }

    if (!Array.isArray(route.node_sequence) || route.node_sequence.length === 0) {
      throw new Error(`路由 ${route.route_id} 的 node_sequence 必须是非空数组`);
    }

    // 验证所有节点ID都是字符串
    if (!route.node_sequence.every(id => typeof id === 'string')) {
      throw new Error(`路由 ${route.route_id} 的 node_sequence 包含无效的节点ID`);
    }
  }

  return true;
}

/**
 * Import routes from meta JSON
 * @param {Object} metaData - Parsed meta JSON data
 * @param {Object} existingNodes - Current nodes from annotationStore (for validation)
 * @returns {Object} Import result with routes to import and warnings
 */
export function importRoutes(metaData, existingNodes) {
  const routes = metaData.routes || [];

  // If no routes in the file, return empty result
  if (routes.length === 0) {
    return {
      routesToImport: {},
      warnings: [],
      totalCount: 0,
      importCount: 0
    };
  }

  // Validate format
  try {
    validateRoutes(routes);
  } catch (error) {
    throw new Error(`路由导入失败: ${error.message}`);
  }

  // Transform and validate routes
  const routesToImport = {};
  const warnings = [];

  for (const route of routes) {
    // Check if all nodes in the sequence exist
    const missingNodes = route.node_sequence.filter(
      nodeId => !existingNodes[nodeId]
    );

    if (missingNodes.length > 0) {
      warnings.push({
        routeId: route.route_id,
        routeName: route.route_name,
        message: `缺少节点: ${missingNodes.join(', ')}`,
        missingNodes
      });
    }

    // Import the route even if some nodes are missing
    // The UI should handle this gracefully by showing warnings
    routesToImport[route.route_id] = {
      route_id: route.route_id,
      route_name: route.route_name,
      node_sequence: route.node_sequence,
      created_at: new Date().toISOString(),
      source_videos: [] // Will be populated as routes are used
    };
  }

  return {
    routesToImport,
    warnings,
    totalCount: routes.length,
    importCount: Object.keys(routesToImport).length
  };
}
