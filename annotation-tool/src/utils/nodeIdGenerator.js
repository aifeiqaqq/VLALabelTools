/**
 * Generates the next node ID in sequence (001, 002, 003...)
 * @param {Array} nodes - Array of existing nodes with node_id property
 * @returns {string} Next node ID as zero-padded 3-digit string
 */
export function nextNodeId(nodes) {
  if (!nodes.length) return "001";
  return String(Math.max(...nodes.map(n => +n.node_id)) + 1).padStart(3, "0");
}
