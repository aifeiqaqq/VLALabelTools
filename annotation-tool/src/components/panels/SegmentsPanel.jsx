import React from 'react';
import { S } from "../../constants/styles";

/**
 * SegmentsPanel Component - Unified Node Model (v4.0)
 * 显示节点列表，包含视频段落范围和动作信息
 */
const SegmentsPanel = React.memo(function SegmentsPanel({ nodes, onEdit, onDelete }) {
  return (
    <div style={{ ...S.card, padding: 14 }}>
      <div style={{ fontSize: 11, color: "#666", letterSpacing: "1px", marginBottom: 12, fontWeight: 500 }}>
        段落列表 ({nodes?.length || 0})
      </div>
      {(!nodes || nodes.length === 0) && (
        <div style={{ color: "#999", fontSize: 13 }}>暂无段落</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nodes && nodes
          .sort((a, b) => a.from_frame - b.from_frame)
          .map((node, i) => {
            const isLatest = i === nodes.length - 1;
            const duration = node.to_timestamp - node.from_timestamp;

            return (
              <div
                key={node.node_id}
                style={{
                  background: "#f9f7f4",
                  border: `2px solid ${isLatest ? "#f59e0b" : "#e5e5e5"}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  position: "relative"
                }}
              >
                {/* 操作按钮 */}
                <div style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 4
                }}>
                  <button
                    onClick={() => onEdit && onEdit(node)}
                    style={{
                      width: 24,
                      height: 24,
                      border: "1px solid #d5d5d5",
                      background: "#ffffff",
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "#666",
                      padding: 0,
                      fontFamily: "inherit"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f0f9ff";
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.color = "#3b82f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#d5d5d5";
                      e.currentTarget.style.color = "#666";
                    }}
                    aria-label="编辑段落"
                    title="编辑段落"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(node)}
                    style={{
                      width: 24,
                      height: 24,
                      border: "1px solid #d5d5d5",
                      background: "#ffffff",
                      borderRadius: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#666",
                      padding: 0,
                      fontFamily: "inherit"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fee";
                      e.currentTarget.style.borderColor = "#f88";
                      e.currentTarget.style.color = "#c33";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#d5d5d5";
                      e.currentTarget.style.color = "#666";
                    }}
                    aria-label="删除段落"
                    title={isLatest ? "删除段落" : "只能删除最后一个段落"}
                  >
                    ×
                  </button>
                </div>

                {/* 段落头部 */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, paddingRight: 60 }}>
                  <span style={S.pill("#f59e0b")}>{node.node_id}</span>
                  {isLatest && <span style={S.pill("#10b981")}>最新</span>}
                  {node.parent_node && (
                    <span style={{ fontSize: 10, color: '#888' }}>
                      ← {node.parent_node}
                    </span>
                  )}
                </div>

                {/* 段落范围 */}
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                  帧{node.from_frame}→{node.to_frame}
                  <span style={{ marginLeft: 8 }}>
                    ({node.from_timestamp.toFixed(2)}s→{node.to_timestamp.toFixed(2)}s)
                  </span>
                  <span style={{ marginLeft: 8, fontWeight: 600, color: "#666" }}>
                    {duration.toFixed(2)}s
                  </span>
                </div>

                {/* 动作（多个） */}
                {node.actions && node.actions.length > 0 && (
                  <div style={{
                    fontSize: 11,
                    color: '#f59e0b',
                    fontWeight: 600,
                    marginBottom: 6,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>⚡</span>
                    {node.actions.map((action, idx) => (
                      <span key={idx}>
                        {action.target}·{action.action_name}
                        {idx < node.actions.length - 1 && ','}
                      </span>
                    ))}
                  </div>
                )}

                {/* 状态描述 */}
                <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5 }}>
                  → {node.state_description}
                </div>

                {/* Meta */}
                {node.node_meta && Object.keys(node.node_meta).length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(node.node_meta)
                      .filter(([k]) => k !== 'imported_at')  // 过滤掉imported_at
                      .map(([k, v]) => {
                        if (!v) return null;

                        // suggested_parents使用特殊样式
                        const isSuggestedParent = k === 'suggested_parents';

                        return (
                          <span
                            key={k}
                            style={{
                              fontSize: 11,
                              color: isSuggestedParent ? "#8b5cf6" : "#666",
                              background: isSuggestedParent ? "#f5f3ff" : "#ffffff",
                              padding: "3px 8px",
                              borderRadius: 3,
                              border: isSuggestedParent ? "1px solid #c4b5fd" : "1px solid #d5d5d5",
                              fontWeight: isSuggestedParent ? 500 : 400
                            }}
                            title={isSuggestedParent ? "导入时建议的父节点" : undefined}
                          >
                            {isSuggestedParent ? `建议父节点: ${v}` : `${k}:${v}`}
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
});

export default SegmentsPanel;
