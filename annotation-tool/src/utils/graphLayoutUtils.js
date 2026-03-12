/**
 * Computes a DAG layout for nodes and edges
 * Uses topological sort to organize nodes into layers
 * @param {Array} nodes - Array of node objects with node_id
 * @param {Array} edges - Array of edge objects with from_node_id and to_node_id
 * @returns {Object|null} Layout data with positions, dimensions or null if no nodes
 */
export function computeGraphLayout(nodes, edges) {
  if (!nodes.length) return null;

  // Layout constants
  const W = 148;  // Node width
  const H = 58;   // Node height
  const HG = 56;  // Horizontal gap
  const VG = 24;  // Vertical gap

  // Calculate in-degree for each node
  const indeg = Object.fromEntries(nodes.map(n => [n.node_id, 0]));
  edges.forEach(e => {
    if (indeg[e.to_node_id] !== undefined) indeg[e.to_node_id]++;
  });

  // Topological sort to create layers
  const layers = [];
  const seen = {};
  let queue = nodes.filter(n => indeg[n.node_id] === 0).map(n => n.node_id);

  while (queue.length) {
    layers.push(queue);
    queue.forEach(id => (seen[id] = layers.length - 1));

    const next = [];
    edges.forEach(e => {
      if (seen[e.from_node_id] !== undefined && seen[e.to_node_id] === undefined && !next.includes(e.to_node_id))
        next.push(e.to_node_id);
    });
    queue = next.filter(id => !seen[id]);
  }

  // Handle isolated nodes (no edges)
  nodes.forEach(n => {
    if (!seen[n.node_id]) {
      layers.push([n.node_id]);
      seen[n.node_id] = layers.length - 1;
    }
  });

  // Calculate positions
  const pos = {};
  layers.forEach((layer, li) => {
    layer.forEach((id, ni) => {
      pos[id] = {
        x: li * (W + HG) + 24,
        y: ni * (H + VG) + 24
      };
    });
  });

  // Calculate SVG dimensions
  const svgW = Math.max(...Object.values(pos).map(p => p.x + W)) + 40;
  const svgH = Math.max(...Object.values(pos).map(p => p.y + H)) + 40;

  return { pos, svgW, svgH, W, H };
}
