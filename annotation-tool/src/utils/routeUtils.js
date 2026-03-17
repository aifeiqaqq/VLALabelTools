/**
 * Route Utilities - Route extraction, hashing, and deduplication
 * 路线工具 - 路线提取、哈希生成和去重
 */

/**
 * Extract node sequence from video segments
 * 从视频片段提取节点序列
 * @param {Array} segments - Video segments with from_frame and node_id
 * @returns {Array} Ordered array of node_ids
 */
export function extractNodeSequence(segments) {
  if (!segments || segments.length === 0) return [];

  return segments
    .sort((a, b) => a.from_frame - b.from_frame)
    .map(seg => seg.node_id);
}

/**
 * Generate SHA-256 hash of node sequence for deduplication
 * 生成节点序列的SHA-256哈希用于去重
 * @param {Array} nodeSequence - Array of node_ids (e.g., ['001', '002', '003'])
 * @returns {Promise<string>} Hash string
 */
export async function generateSequenceHash(nodeSequence) {
  if (!nodeSequence || nodeSequence.length === 0) {
    return '';
  }

  const str = nodeSequence.join('->');
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract all unique routes from project videos
 * 从项目视频中提取所有唯一路线
 * @param {Object} nodes - Unified nodes object from annotationStore
 * @param {Array} videos - Array of video objects
 * @returns {Promise<Object>} Routes object keyed by route_id
 */
export async function extractRoutesFromProject(nodes, videos) {
  if (!nodes || !videos || videos.length === 0) {
    return {};
  }

  const routeMap = new Map(); // hash -> { sequence, videos }

  // Step 1: Extract sequences from each video
  for (const video of videos) {
    // Get all segments for this video
    const videoSegments = Object.values(nodes)
      .filter(node => node.video_segments && node.video_segments[video.id])
      .map(node => ({
        node_id: node.node_id,
        from_frame: node.video_segments[video.id].from_frame,
        to_frame: node.video_segments[video.id].to_frame
      }));

    // Skip videos without annotations
    if (videoSegments.length === 0) {
      continue;
    }

    // Extract node sequence
    const sequence = extractNodeSequence(videoSegments);

    // Generate hash for deduplication
    const hash = await generateSequenceHash(sequence);

    // Group videos by sequence hash
    if (routeMap.has(hash)) {
      routeMap.get(hash).videos.push(video.id);
    } else {
      routeMap.set(hash, {
        sequence,
        videos: [video.id]
      });
    }
  }

  // Step 2: Convert to route objects with auto-generated names
  const routes = {};
  let routeCounter = 1;

  for (const [hash, data] of routeMap.entries()) {
    const routeId = `route_${String(routeCounter).padStart(3, '0')}`;

    routes[routeId] = {
      route_id: routeId,
      route_name: `Route ${routeCounter}`,
      node_sequence: data.sequence,
      source_videos: data.videos,
      sequence_hash: hash,
      created_at: new Date().toISOString()
    };

    routeCounter++;
  }

  return routes;
}

/**
 * Validate route data structure
 * 验证路线数据结构
 * @param {Object} route - Route object to validate
 * @returns {boolean} True if valid
 */
export function validateRoute(route) {
  if (!route) return false;

  if (!route.route_id || typeof route.route_id !== 'string') {
    return false;
  }

  if (!route.route_name || typeof route.route_name !== 'string') {
    return false;
  }

  if (!Array.isArray(route.node_sequence) || route.node_sequence.length === 0) {
    return false;
  }

  // All node_ids should be strings
  if (!route.node_sequence.every(id => typeof id === 'string')) {
    return false;
  }

  return true;
}

/**
 * Check if a route's nodes exist in the node library
 * 检查路线中的节点是否存在于节点库中
 * @param {Object} route - Route object
 * @param {Object} nodes - Nodes object from store
 * @returns {Object} { allExist: boolean, missingNodes: Array }
 */
export function checkRouteNodes(route, nodes) {
  if (!route || !route.node_sequence || !nodes) {
    return { allExist: false, missingNodes: [] };
  }

  const missingNodes = route.node_sequence.filter(nodeId => !nodes[nodeId]);

  return {
    allExist: missingNodes.length === 0,
    missingNodes
  };
}
