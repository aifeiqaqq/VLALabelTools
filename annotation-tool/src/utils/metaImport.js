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

  return true;
}

/**
 * Normalize parent field from meta format
 * Handles: null, "001" (string), ["001", "002"] (array)
 *
 * @param {null|string|string[]} parents - Parent data from meta JSON
 * @returns {null|string} Normalized parent (first if array, or null)
 */
function normalizeParents(parents) {
  if (!parents) return null;
  if (typeof parents === 'string') return parents;
  if (Array.isArray(parents)) {
    // Return first parent as suggestion, or null if empty
    return parents.length > 0 ? parents[0] : null;
  }
  return null;
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
 *   node_meta: { suggested_parents: "001", imported_at: "..." },
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
