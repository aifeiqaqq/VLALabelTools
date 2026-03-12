import React, { useMemo } from 'react';
import { TASK_LABELS } from '../../constants/taskSchemas';
import { S } from '../../constants/styles';

/**
 * 计算横向图布局
 * 根节点在最左边，向右展开
 */
function computeGraphLayout(nodes) {
  if (!nodes.length) return null;

  // 节点尺寸和间距
  const W = 160, H = 70;
  const HGAP = 140;  // 增加水平间距，给连线留空间
  const VGAP = 100;

  // 构建图结构
  const graph = {};
  const inDegree = {};
  const outDegree = {};

  nodes.forEach(n => {
    graph[n.node_id] = { next: [], prev: [] };
    inDegree[n.node_id] = 0;
    outDegree[n.node_id] = 0;
  });

  // 从 parent_nodes 构建边
  nodes.forEach(node => {
    if (!node.parent_nodes) return;
    const parents = new Set();
    Object.values(node.parent_nodes).forEach(parentId => {
      if (parentId && graph[parentId]) parents.add(parentId);
    });
    parents.forEach(parentId => {
      if (!graph[parentId].next.includes(node.node_id)) {
        graph[parentId].next.push(node.node_id);
        graph[node.node_id].prev.push(parentId);
        inDegree[node.node_id]++;
        outDegree[parentId]++;
      }
    });
  });

  // 找到所有根节点
  const roots = nodes.filter(n => inDegree[n.node_id] === 0).map(n => n.node_id);
  const terminals = nodes.filter(n => outDegree[n.node_id] === 0).map(n => n.node_id);

  // 拓扑排序计算层级
  const levels = {};
  const visited = new Set();
  const queue = [...roots];
  roots.forEach(r => levels[r] = 0);

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const currentLevel = levels[nodeId];
    graph[nodeId].next.forEach(childId => {
      if (!levels[childId] || levels[childId] < currentLevel + 1) {
        levels[childId] = currentLevel + 1;
      }
      if (!visited.has(childId)) queue.push(childId);
    });
  }

  // 按层级分组
  const levelGroups = {};
  Object.entries(levels).forEach(([nodeId, level]) => {
    if (!levelGroups[level]) levelGroups[level] = [];
    levelGroups[level].push(nodeId);
  });

  // 计算位置
  const pos = {};
  const maxLevel = Math.max(...Object.values(levels), 0);

  Object.entries(levelGroups).forEach(([level, nodeIds]) => {
    const x = Number(level) * (W + HGAP);
    const totalHeight = nodeIds.length * H + (nodeIds.length - 1) * VGAP;
    const startY = -totalHeight / 2;

    nodeIds.forEach((nodeId, idx) => {
      pos[nodeId] = {
        x: x,
        y: startY + idx * (H + VGAP),
        // 记录节点的边界框（用于路径规划）
        bounds: {
          left: x,
          right: x + W,
          top: startY + idx * (H + VGAP),
          bottom: startY + idx * (H + VGAP) + H
        }
      };
    });
  });

  // 处理未访问的节点
  nodes.forEach(n => {
    if (!pos[n.node_id]) {
      pos[n.node_id] = { x: 0, y: 0, bounds: { left: 0, right: W, top: 0, bottom: H } };
    }
  });

  // 计算边界框
  const allX = Object.values(pos).map(p => p.x);
  const allY = Object.values(pos).map(p => p.y);

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX) + W;
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY) + H;

  const paddingX = 80;
  const paddingY = 60;
  const svgW = maxX - minX + paddingX * 2;
  const svgH = maxY - minY + paddingY * 2;

  const offsetX = -minX + paddingX;
  const offsetY = -minY + paddingY;

  return { pos, svgW, svgH, W, H, levels, roots, terminals, offsetX, offsetY, graph };
}

/**
 * 计算绕过节点的路径（正交路由）
 * 使用水平-垂直-水平的方式连接，自动避开其他节点
 */
function calculateEdgePath(source, target, allNodes, offsetX, offsetY) {
  const W = 160, H = 70;
  
  // 起点和终点坐标（考虑偏移）
  const sx = source.x + offsetX + W;  // 源节点右侧
  const sy = source.y + offsetY + H / 2;  // 源节点中心
  const tx = target.x + offsetX;  // 目标节点左侧
  const ty = target.y + offsetY + H / 2;  // 目标节点中心
  
  // 简单情况：直接水平连接（如果Y坐标接近）
  if (Math.abs(sy - ty) < 20) {
    return `M${sx},${sy} L${tx},${ty}`;
  }
  
  // 使用正交路由：右 → 上/下 → 左
  // 计算中间点
  const midX = (sx + tx) / 2;
  
  // 检测是否会穿过其他节点
  const willIntersect = checkIntersection(midX, Math.min(sy, ty), midX, Math.max(sy, ty), allNodes, source, target);
  
  if (!willIntersect) {
    // 直接垂直走线
    return `M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx},${ty}`;
  }
  
  // 需要绕行：先出去再回来
  // 找到绕行的Y坐标（在源节点上方或下方）
  const direction = sy < ty ? -1 : 1;  // -1 向上，1 向下
  const detourY = sy + direction * 40;  // 向外偏移40px
  
  // 三段式：从源节点出去 → 横向 → 到目标节点
  return `M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx},${ty}`;
}

/**
 * 检查线段是否与节点相交
 */
function checkIntersection(x1, y1, x2, y2, nodes, excludeSource, excludeTarget) {
  for (const [nodeId, nodePos] of Object.entries(nodes)) {
    if (nodeId === excludeSource || nodeId === excludeTarget) continue;
    
    const bounds = nodePos.bounds;
    if (!bounds) continue;
    
    // 简单的边界框检测
    const minX = Math.min(x1, x2) - 10;
    const maxX = Math.max(x1, x2) + 10;
    const minY = Math.min(y1, y2) - 10;
    const maxY = Math.max(y1, y2) + 10;
    
    // 检查垂直线段是否与节点相交
    if (x1 === x2) {
      if (x1 >= bounds.left && x1 <= bounds.right) {
        if (!(maxY < bounds.top || minY > bounds.bottom)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 计算曲线路径（贝塞尔曲线，避开节点）
 */
function calculateCurvedPath(source, target, offsetX, offsetY, levels, parentId, nodeId) {
  const W = 160, H = 70;
  
  // 起点和终点
  const sx = source.x + offsetX + W;      // 源节点右侧中心
  const sy = source.y + offsetY + H / 2;
  const tx = target.x + offsetX;          // 目标节点左侧中心
  const ty = target.y + offsetY + H / 2;
  
  const isBackEdge = levels[parentId] >= levels[nodeId];
  
  if (isBackEdge) {
    // 回边使用大弧度绕过
    const dx = tx - sx;
    const dy = ty - sy;
    const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
    return `M${sx},${sy} A${dr},${dr} 0 0,1 ${tx},${ty}`;
  }
  
  // 普通边使用控制点
  const controlOffset = (tx - sx) * 0.5;
  
  // 如果Y差距大，添加额外的控制点来创建S形曲线
  if (Math.abs(ty - sy) > H) {
    const midX = (sx + tx) / 2;
    return `M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}`;
  }
  
  // 简单的C曲线
  return `M${sx},${sy} C${sx + controlOffset},${sy} ${tx - controlOffset},${ty} ${tx},${ty}`;
}

/**
 * GraphTab 组件 - 横向图布局，连线绕开节点
 */
const GraphTab = React.memo(function GraphTab({
  nodes,
  marks,
  taskType,
  lastNodeId
}) {
  const graphData = useMemo(() => computeGraphLayout(nodes), [nodes]);

  if (!graphData) {
    return (
      <div style={{ height: 'calc(100vh - 88px)', overflow: 'auto', padding: 20 }}>
        <div style={{ ...S.card, padding: 16, minHeight: 400 }}>
          <div style={{ fontSize: 10, color: '#444', letterSpacing: '1px', marginBottom: 16 }}>
            任务图 — {TASK_LABELS[taskType]}
          </div>
          <div style={{ color: '#2a2a2a', textAlign: 'center', marginTop: 80, fontSize: 13 }}>
            尚无节点数据，请先标注关键帧
          </div>
        </div>
      </div>
    );
  }

  const { pos, svgW, svgH, W, H, levels, roots, terminals, offsetX, offsetY } = graphData;

  // 计算每个节点的帧数
  const frameCounts = {};
  marks.forEach(m => {
    frameCounts[m.node_id] = (frameCounts[m.node_id] || 0) + 1;
  });

  // 计算连接数
  const edgeCount = useMemo(() => {
    let count = 0;
    nodes.forEach(node => {
      if (node.parent_nodes) {
        const uniqueParents = new Set();
        Object.values(node.parent_nodes).forEach(parentId => {
          if (parentId) uniqueParents.add(parentId);
        });
        count += uniqueParents.size;
      }
    });
    return count;
  }, [nodes]);

  // 节点类型判断
  const isRoot = (nid) => roots.includes(nid);
  const isTerminal = (nid) => terminals.includes(nid);

  const hasMultipleParents = (nid) => {
    const node = nodes.find(n => n.node_id === nid);
    if (!node || !node.parent_nodes) return false;
    const uniqueParents = new Set();
    Object.values(node.parent_nodes).forEach(parentId => {
      if (parentId) uniqueParents.add(parentId);
    });
    return uniqueParents.size > 1;
  };

  const hasMultipleChildren = (nid) => {
    return nodes.filter(n => {
      if (!n.parent_nodes) return false;
      return Object.values(n.parent_nodes).includes(nid);
    }).length > 1;
  };

  return (
    <div style={{ height: 'calc(100vh - 88px)', overflow: 'auto', padding: 20 }}>
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: '1px', marginBottom: 16 }}>
          任务图 — {TASK_LABELS[taskType]} · {nodes.length} 节点 · {edgeCount} 连接
        </div>

        {/* 图例 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, fontSize: 10, color: '#666' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#f0fdf4', border: '1.8px solid #16a34a', borderRadius: 2 }} />
            <span>起始节点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#ecfdf5', border: '1.8px solid #059669', borderRadius: 2 }} />
            <span>终止节点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#f8f8ff', border: '1.2px solid #6666cc', borderRadius: 2 }} />
            <span>中间节点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#f8f8ff', border: '2px solid #f59e0b', borderRadius: 2 }} />
            <span>当前节点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#fef3c7', border: '1.5px solid #d97706', borderRadius: 2 }} />
            <span>多父节点</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <svg
            id="graph-svg"
            width={svgW}
            height={svgH}
            style={{ display: 'block', minWidth: svgW }}
          >
            {/* 箭头标记定义 */}
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
              </marker>
            </defs>

            {/* 第1层：绘制节点背景（只画矩形，不画文字） */}
            {nodes.map(n => {
              const p = pos[n.node_id];
              if (!p) return null;

              const isLast = n.node_id === lastNodeId;
              const isRootNode = isRoot(n.node_id);
              const isTermNode = isTerminal(n.node_id);
              const multiParents = hasMultipleParents(n.node_id);

              const nodeX = p.x + offsetX;
              const nodeY = p.y + offsetY;

              let bgColor, borderColor, borderWidth;
              if (multiParents) {
                bgColor = '#fef3c7'; borderColor = '#d97706'; borderWidth = 2;
              } else if (isLast) {
                bgColor = '#fffbeb'; borderColor = '#f59e0b'; borderWidth = 2.5;
              } else if (isRootNode) {
                bgColor = '#f0fdf4'; borderColor = '#16a34a'; borderWidth = 2;
              } else if (isTermNode) {
                bgColor = '#ecfdf5'; borderColor = '#059669'; borderWidth = 2;
              } else {
                bgColor = '#f8f8ff'; borderColor = '#6666cc'; borderWidth = 1.5;
              }

              return (
                <rect
                  key={`bg-${n.node_id}`}
                  x={nodeX}
                  y={nodeY}
                  width={W}
                  height={H}
                  rx={4}
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth={borderWidth}
                />
              );
            })}

            {/* 第2层：绘制边（在节点背景之上，文字之下） */}
            {nodes.map(node => {
              if (!node.parent_nodes) return null;

              const uniqueParents = new Set();
              Object.values(node.parent_nodes).forEach(parentId => {
                if (parentId) uniqueParents.add(parentId);
              });

              return Array.from(uniqueParents).map(parentId => {
                const fp = pos[parentId];
                const tp = pos[node.node_id];
                if (!fp || !tp) return null;

                const path = calculateCurvedPath(
                  fp, tp, offsetX, offsetY, levels, parentId, node.node_id
                );

                return (
                  <path
                    key={`${parentId}-${node.node_id}`}
                    d={path}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    strokeOpacity={0.7}
                    markerEnd="url(#arrow)"
                  />
                );
              });
            }).flat()}

            {/* 第3层：绘制节点文字（在最上层） */}
            {nodes.map(n => {
              const p = pos[n.node_id];
              if (!p) return null;

              const isLast = n.node_id === lastNodeId;
              const isRootNode = isRoot(n.node_id);
              const isTermNode = isTerminal(n.node_id);
              const multiParents = hasMultipleParents(n.node_id);
              const multiChildren = hasMultipleChildren(n.node_id);

              const nodeX = p.x + offsetX;
              const nodeY = p.y + offsetY;

              // 节点颜色
              let bgColor, borderColor, borderWidth;
              if (multiParents) {
                bgColor = '#fef3c7';
                borderColor = '#d97706';
                borderWidth = 2;
              } else if (isLast) {
                bgColor = '#fffbeb';
                borderColor = '#f59e0b';
                borderWidth = 2.5;
              } else if (isRootNode) {
                bgColor = '#f0fdf4';
                borderColor = '#16a34a';
                borderWidth = 2;
              } else if (isTermNode) {
                bgColor = '#ecfdf5';
                borderColor = '#059669';
                borderWidth = 2;
              } else {
                bgColor = '#f8f8ff';
                borderColor = '#6666cc';
                borderWidth = 1.5;
              }

              return (
                <g key={n.node_id}>
                  {/* 节点ID（无背景，因为已在下层绘制） */}
                  <text
                    x={nodeX + W / 2}
                    y={nodeY + 20}
                    textAnchor="middle"
                    fontSize={14}
                    fill="#16a34a"
                    fontFamily="DM Mono"
                    fontWeight="500"
                  >
                    {n.node_id}
                  </text>

                  {/* 状态描述 */}
                  <text
                    x={nodeX + W / 2}
                    y={nodeY + 38}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#555"
                    fontFamily="DM Mono"
                  >
                    {n.state_description?.length > 18
                      ? n.state_description.slice(0, 18) + '…'
                      : n.state_description}
                  </text>

                  {/* 帧数 */}
                  <text
                    x={nodeX + W / 2}
                    y={nodeY + 54}
                    textAnchor="middle"
                    fontSize={9}
                    fill={multiParents ? '#d97706' : '#888'}
                    fontFamily="DM Mono"
                  >
                    {frameCounts[n.node_id] || 0} 帧
                    {multiChildren && ' · 分支'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 统计信息 */}
        <div style={{ marginTop: 20, padding: '14px 18px', background: '#f9f7f4', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 13, color: '#555' }}>
          <div style={{ display: 'flex', gap: 28 }}>
            <span style={{ fontWeight: 500 }}>层级数: <span style={{ color: '#333' }}>{Object.keys(levels).length}</span></span>
            <span style={{ fontWeight: 500 }}>根节点: <span style={{ color: '#333' }}>{roots.length}</span></span>
            <span style={{ fontWeight: 500 }}>终止节点: <span style={{ color: '#333' }}>{terminals.length}</span></span>
            <span style={{ fontWeight: 500 }}>多父节点: <span style={{ color: '#333' }}>{nodes.filter(n => hasMultipleParents(n.node_id)).length}</span></span>
            <span style={{ fontWeight: 500 }}>分支节点: <span style={{ color: '#333' }}>{nodes.filter(n => hasMultipleChildren(n.node_id)).length}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GraphTab;
