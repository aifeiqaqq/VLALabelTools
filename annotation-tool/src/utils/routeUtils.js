/**
 * Route Utilities - Route extraction, hashing, and deduplication
 * 路线工具 - 路线提取、哈希生成和去重
 */

/**
 * Extract node sequence from video segments
 * 从视频片段提取节点序列
 * @param {Array} segments - Video segments with from_frame and node_id
 * @param {boolean} deduplicateConsecutive - 是否去除连续重复的节点（默认false）
 * @returns {Array} Ordered array of node_ids
 */
export function extractNodeSequence(segments, deduplicateConsecutive = false) {
  if (!segments || segments.length === 0) return [];

  const sequence = segments
    .sort((a, b) => a.from_frame - b.from_frame)
    .map(seg => seg.node_id);

  // 可选：去除连续重复的节点（如 ["001", "002", "002", "003"] → ["001", "002", "003"]）
  if (deduplicateConsecutive) {
    return sequence.filter((nodeId, index) => {
      return index === 0 || nodeId !== sequence[index - 1];
    });
  }

  return sequence;
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
 *
 * 修改：从marks提取序列而不是从nodes.video_segments
 * 原因：marks支持同一节点在同一视频中多次出现（如001→002→003→002）
 *
 * @param {Object} nodes - Unified nodes object from annotationStore
 * @param {Array} videos - Array of video objects
 * @param {Object} marks - Marks object from annotationStore (按视频分组)
 * @returns {Promise<Object>} Routes object keyed by route_id
 */
export async function extractRoutesFromProject(nodes, videos, marks = {}) {
  if (!nodes || !videos || videos.length === 0) {
    return {};
  }

  const routeMap = new Map(); // hash -> { sequence, videos }

  // Step 1: Extract sequences from each video
  for (const video of videos) {
    // 优先从marks提取序列（支持重复节点）
    const videoMarks = marks[video.id] || [];

    let sequence;

    if (videoMarks.length > 0) {
      // 从marks提取：按frame_index排序，提取node_id
      // 这样可以保留同一节点的多次出现
      const rawSequence = videoMarks
        .sort((a, b) => a.frame_index - b.frame_index)
        .map(mark => mark.node_id);

      console.log(`[Route Extract] Video ${video.id}: Raw sequence length = ${rawSequence.length}`);

      // 去除连续重复的节点（通常是误操作导致）
      // 例如：["001", "002", "002", "003"] → ["001", "002", "003"]
      // 但保留非连续的重复（如 ["001", "002", "003", "002"] 保持不变）
      sequence = rawSequence.filter((nodeId, index) => {
        return index === 0 || nodeId !== rawSequence[index - 1];
      });

      console.log(`[Route Extract] Video ${video.id}: Deduplicated sequence length = ${sequence.length}`);
      if (rawSequence.length !== sequence.length) {
        console.log(`[Route Extract] Removed ${rawSequence.length - sequence.length} consecutive duplicates`);
      }
    } else {
      // 降级方案：从nodes.video_segments提取（兼容旧数据）
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

      sequence = extractNodeSequence(videoSegments, true); // 启用去重
    }

    // Skip empty sequences
    if (!sequence || sequence.length === 0) {
      continue;
    }

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
