import { useMemo } from "react";
import { computeGraphLayout } from "../utils/graphLayoutUtils";

/**
 * Graph Data Hook
 * Computes graph layout for visualization
 */
export function useGraphData(nodes, edges) {
  return useMemo(() => computeGraphLayout(nodes, edges), [nodes, edges]);
}
