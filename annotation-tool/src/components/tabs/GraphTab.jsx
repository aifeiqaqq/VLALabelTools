import React, { useState, useEffect, useMemo } from 'react';
import { TASK_LABELS } from '../../constants/taskSchemas';
import { S } from '../../constants/styles';

// ELK.js 导入
import ELK from 'elkjs/lib/elk.bundled.js';

/**
 * GraphTab - 使用 ELK.js 进行专业图布局 (v4.0 Unified Node Model)
 * 显示节点之间的顺序连接关系
 */

// 创建 ELK 实例
const elk = new ELK();

// 默认布局选项
const defaultLayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',            // 从上到下布局（改为纵向）
  'elk.spacing.nodeNode': '50',       // 节点间距（减小）
  'elk.spacing.componentComponent': '50',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',  // 层间距（减小）
  'elk.edgeRouting': 'ORTHOGONAL',    // 正交边路由（直角转弯）
  'elk.layered.edgeRouting.splines.mode': 'ORTHOGONAL',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  'elk.portConstraints': 'FIXED_SIDE',
  'elk.spacing.portPort': '10',
};

/**
 * 将文本按宽度分割成多行（按单词换行，不在单词内部截断）
 * @param {string} text - 要分割的文本
 * @param {number} maxWidth - 最大宽度（像素）
 * @param {number} fontSize - 字体大小
 * @returns {string[]} - 分割后的文本行数组
 */
function wrapText(text, maxWidth, fontSize = 11) {
  if (!text) return [''];

  // 估算：等宽字体 DM Mono，每个字符约占 fontSize * 0.6 像素
  const charWidth = fontSize * 2;
  const maxCharsPerLine = Math.floor(maxWidth / charWidth);

  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const lines = [];
  let currentLine = '';

  // 按单词分割（空格分隔）
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? currentLine + ' ' + word : word;

    if (testLine.length <= maxCharsPerLine) {
      // 当前行可以容纳这个单词
      currentLine = testLine;
    } else {
      // 当前行放不下这个单词
      if (currentLine) {
        // 先把当前行推入结果
        lines.push(currentLine);
        currentLine = word;
      } else {
        // 单个单词就超长，强制截断
        if (word.length > maxCharsPerLine) {
          // 单词太长，按字符截断
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        } else {
          currentLine = word;
        }
      }
    }
  }

  // 添加最后一行
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * 从统一节点构建图结构（v4.0）
 * 使用 parent_node 构建边，如果没有 parent_node 则按顺序连接
 * @param {Object} nodes - 统一节点对象 { node_id: node }
 * @param {Object} marks - 按视频分组的标记对象
 */
function buildGraphFromNodes(nodes, marks) {
  // 获取所有节点
  const allNodes = Object.values(nodes);
  
  // 按创建时间排序节点
  const sortedNodes = [...allNodes].sort((a, b) => a.node_id.localeCompare(b.node_id));

  // 构建图节点（每个唯一节点一个）
  const graphNodes = sortedNodes.map(node => ({
    id: node.node_id,
    width: 320,   // 增加宽度：280 → 320px，容纳更多文字
    height: 140,  // 增加高度：100 → 140px，支持更多行
    data: {
      node_id: node.node_id,
      state_description: node.state_description,
      actions: node.actions || [],
      // 从所有视频段落中聚合时间范围
      video_segments: node.video_segments || {},
    },
  }));

  // 构建边（基于各视频的 parent_node 关系，或 node_meta.suggested_parents）
  const edges = [];
  const edgeSet = new Set();

  // 遍历所有节点，收集所有视频中的 parent_node 关系
  sortedNodes.forEach(node => {
    const segments = node.video_segments || {};
    const hasSegments = Object.keys(segments).length > 0;

    if (hasSegments) {
      // 如果有视频段落，从 video_segments 读取父节点
      Object.entries(segments).forEach(([videoId, segment]) => {
        if (segment.parent_node) {
          // 处理父节点数组和旧的字符串格式
          const parentNodes = Array.isArray(segment.parent_node)
            ? segment.parent_node
            : [segment.parent_node];

          // 为每个父节点创建一条边
          parentNodes.forEach(parentId => {
            const edgeId = `${parentId}->${node.node_id}`;
            if (!edgeSet.has(edgeId)) {
              edgeSet.add(edgeId);
              edges.push({
                id: edgeId,
                sources: [parentId],
                targets: [node.node_id],
                actions: segment.actions || node.actions || [],
              });
            }
          });
        }
      });
    } else if (node.node_meta?.suggested_parents && node.node_meta.suggested_parents.length > 0) {
      // 如果没有视频段落，从 node_meta.suggested_parents 读取（导入的 meta 节点）
      const suggestedParents = Array.isArray(node.node_meta.suggested_parents)
        ? node.node_meta.suggested_parents
        : [node.node_meta.suggested_parents];

      suggestedParents.forEach(parentId => {
        if (parentId) {  // 确保 parentId 不是空值
          const edgeId = `${parentId}->${node.node_id}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            edges.push({
              id: edgeId,
              sources: [parentId],
              targets: [node.node_id],
              actions: node.actions || [],
            });
          }
        }
      });
    }
  });

  // 如果没有 parent_node 定义的边，使用节点ID顺序边作为回退
  if (edges.length === 0 && sortedNodes.length > 1) {
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      edges.push({
        id: `${sortedNodes[i].node_id}->${sortedNodes[i + 1].node_id}`,
        sources: [sortedNodes[i].node_id],
        targets: [sortedNodes[i + 1].node_id],
        actions: sortedNodes[i + 1].actions || [],
      });
    }
  }

  return {
    id: 'root',
    children: graphNodes,
    edges,
  };
}

/**
 * 计算总段落数（跨所有视频的节点实例）
 */
function countTotalSegments(nodes) {
  return Object.values(nodes).reduce((sum, node) => {
    return sum + Object.keys(node.video_segments || {}).length;
  }, 0);
}

/**
 * GraphTab 组件 (v4.0)
 */
const GraphTab = React.memo(function GraphTab({
  nodes,
  marks,
  taskType,
}) {
  const [layoutResult, setLayoutResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // 收集所有唯一节点
  const allNodes = useMemo(() => {
    if (!nodes) return [];
    return Object.values(nodes);
  }, [nodes]);

  // 计算总标记数
  const totalMarkCount = useMemo(() => {
    if (!marks) return 0;
    return Object.values(marks).flat().length;
  }, [marks]);

  // 使用 ELK 计算布局
  useEffect(() => {
    if (!allNodes.length) {
      setLayoutResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const graph = buildGraphFromNodes(nodes, marks);

    elk.layout(graph, {
      layoutOptions: defaultLayoutOptions,
    }).then(result => {
      setLayoutResult(result);
      setLoading(false);
    }).catch(err => {
      console.error('ELK layout error:', err);
      setLoading(false);
    });
  }, [nodes, marks]);

  // 没有数据时显示
  if (!allNodes.length) {
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

  // 加载中
  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 88px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#666', fontSize: 14 }}>计算图布局...</div>
      </div>
    );
  }

  if (!layoutResult) {
    return (
      <div style={{ height: 'calc(100vh - 88px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e74c3c', fontSize: 14 }}>布局计算失败</div>
      </div>
    );
  }

  // 计算 SVG 尺寸
  const padding = 40;
  const svgWidth = (layoutResult.width || 800) + padding * 2;
  const svgHeight = (layoutResult.height || 600) + padding * 2;

  // 边数
  const edgeCount = layoutResult.edges?.length || 0;
  
  // 总段落数
  const totalSegments = countTotalSegments(nodes);

  // 绘制正交边
  const renderEdge = (edge) => {
    const sections = edge.sections || [];
    
    return sections.map((section, idx) => {
      const startPoint = section.startPoint;
      const endPoint = section.endPoint;
      const bendPoints = section.bendPoints || [];
      
      // 构建路径：起点 -> 所有拐点 -> 终点
      let path = `M${startPoint.x + padding},${startPoint.y + padding}`;
      
      bendPoints.forEach(bp => {
        path += ` L${bp.x + padding},${bp.y + padding}`;
      });
      
      path += ` L${endPoint.x + padding},${endPoint.y + padding}`;
      
      return (
        <path
          key={`${edge.id}-${idx}`}
          d={path}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeOpacity={0.7}
          markerEnd="url(#arrow-elk)"
        />
      );
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 88px)', overflow: 'auto', padding: 20 }}>
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: '1px', marginBottom: 16 }}>
          任务图 — {TASK_LABELS[taskType]} · {allNodes.length} 唯一节点 · {totalSegments} 段落 · {edgeCount} 连接 (ELK布局)
        </div>

        {/* 图例 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, fontSize: 10, color: '#666', flexWrap: 'wrap' }}>
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
            <div style={{ width: 24, height: 2, background: '#10b981' }} />
            <span>节点连接</span>
          </div>
        </div>

        <div style={{ overflow: 'auto' }}>
          <svg
            id="graph-svg"
            width={svgWidth}
            height={svgHeight}
            style={{ display: 'block' }}
          >
            {/* 箭头标记 */}
            <defs>
              <marker
                id="arrow-elk"
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

            {/* 绘制边（正交路由） */}
            {layoutResult.edges.map(edge => renderEdge(edge))}

            {/* 绘制节点 */}
            {layoutResult.children.map((n, index) => {
              const nodeData = n.data;
              const isFirst = index === 0;
              const isLast = index === layoutResult.children.length - 1;

              const x = n.x + padding;
              const y = n.y + padding;
              const W = n.width;
              const H = n.height;

              // 节点颜色
              let bgColor, borderColor, borderWidth;
              if (isFirst) {
                bgColor = '#f0fdf4'; borderColor = '#16a34a'; borderWidth = 2;
              } else if (isLast) {
                bgColor = '#ecfdf5'; borderColor = '#059669'; borderWidth = 2;
              } else {
                bgColor = '#f8f8ff'; borderColor = '#6666cc'; borderWidth = 1.5;
              }

              // 计算该节点在所有视频中的总标记数
              const nodeMarkCount = Object.values(marks || {})
                .flat()
                .filter(m => m.node_id === nodeData.node_id).length;

              return (
                <g key={n.id}>
                  {/* 节点背景 */}
                  <rect
                    x={x}
                    y={y}
                    width={W}
                    height={H}
                    rx={4}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                  />

                  {/* 节点ID */}
                  <text
                    x={x + W / 2}
                    y={y + 20}
                    textAnchor="middle"
                    fontSize={16}
                    fill="#16a34a"
                    fontFamily="DM Mono"
                    fontWeight="600"
                  >
                    {nodeData.node_id}
                  </text>

                  {/* 动作信息（多个） */}
                  {nodeData.actions && nodeData.actions.length > 0 && (
                    (() => {
                      const actionText = nodeData.actions.map(a => `${a.target}·${a.action_name}`).join(', ');
                      const maxActionLength = 40;  // 增加动作文本长度：30 → 40
                      return (
                        <text
                          x={x + W / 2}
                          y={y + 38}
                          textAnchor="middle"
                          fontSize={11}
                          fill="#f59e0b"
                          fontFamily="DM Mono"
                          fontWeight="500"
                        >
                          ⚡ {actionText.length > maxActionLength ? actionText.slice(0, maxActionLength) + '...' : actionText}
                        </text>
                      );
                    })()
                  )}

                  {/* 状态描述 - 自动换行 */}
                  {(() => {
                    // 将文字分割成多行（留出左右padding 20px）
                    const descFontSize = 12;
                    const lines = wrapText(nodeData.state_description, W - 40, descFontSize);
                    const lineHeight = 15;
                    const startY = y + 56;
                    const maxLines = 6;  // 增加显示行数：3 → 6

                    return (
                      <text
                        textAnchor="middle"
                        fontSize={descFontSize}
                        fill="#555"
                        fontFamily="DM Mono"
                      >
                        {lines.slice(0, maxLines).map((line, idx) => (
                          <tspan
                            key={idx}
                            x={x + W / 2}
                            y={idx === 0 ? startY : undefined}
                            dy={idx === 0 ? 0 : lineHeight}
                          >
                            {line}
                          </tspan>
                        ))}
                        {lines.length > maxLines && (
                          <tspan
                            x={x + W / 2}
                            dy={lineHeight}
                            fill="#999"
                            fontSize={11}
                          >
                            ...
                          </tspan>
                        )}
                      </text>
                    );
                  })()}

                  {/* 标记数 */}
                  <text
                    x={x + W / 2}
                    y={y + H - 10}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#888"
                    fontFamily="DM Mono"
                  >
                    {Object.keys(nodeData.video_segments).length} 视频 · {nodeMarkCount} 标记
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 统计信息 */}
        <div style={{ marginTop: 20, padding: '14px 18px', background: '#f9f7f4', border: '1px solid #e5e5e5', borderRadius: 6, fontSize: 13, color: '#555' }}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>唯一节点: <span style={{ color: '#333' }}>{allNodes.length}</span></span>
            <span style={{ fontWeight: 500 }}>总段落: <span style={{ color: '#333' }}>{totalSegments}</span></span>
            <span style={{ fontWeight: 500 }}>总标记数: <span style={{ color: '#333' }}>{totalMarkCount}</span></span>
            <span style={{ fontWeight: 500 }}>视频数: <span style={{ color: '#333' }}>{Object.keys(nodes).length > 0 ? 
              new Set(Object.values(nodes).flatMap(n => Object.keys(n.video_segments || {}))).size : 0
            }</span></span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GraphTab;
