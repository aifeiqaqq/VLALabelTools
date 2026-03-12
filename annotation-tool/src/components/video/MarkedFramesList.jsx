import React from 'react';
import { S } from "../../constants/styles";

/**
 * MarkedFramesList Component - Unified Node Model (v4.0)
 * 显示段落列表（而非单个帧标记）
 * 每个段落显示范围、动作和状态
 */
const MarkedFramesList = React.memo(function MarkedFramesList({
  marks,
  nodes,
  currentFrame,
  seekFrame,
  openEdit = () => {},
  onDelete = () => {}
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #e5e5e5",
        fontSize: 11,
        color: "#666",
        letterSpacing: "1px",
        fontWeight: 500
      }}>
        已标段落 ({nodes?.length || 0}) · 点击跳转并编辑
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {(!nodes || nodes.length === 0) && (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 30 }}>
            按 M 开始标注视频段落
          </div>
        )}
        {nodes && nodes
          .sort((a, b) => a.from_frame - b.from_frame)
          .map((node, i) => {
            // 找到对应的mark（用于缩略图和跳转）
            const mark = marks?.find(m => m.node_id === node.node_id);
            const isLatest = i === nodes.length - 1;
            const duration = node.to_timestamp - node.from_timestamp;

            return (
              <div
                key={node.node_id}
                style={{
                  ...S.card,
                  padding: "10px 12px",
                  display: "flex",
                  gap: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "#f59e0b";
                  e.currentTarget.style.transform = "translateX(2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#e5e5e5";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node);
                  }}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 20,
                    height: 20,
                    border: "1px solid #e5e5e5",
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
                    e.currentTarget.style.borderColor = "#e5e5e5";
                    e.currentTarget.style.color = "#666";
                  }}
                  aria-label="删除段落"
                  title={isLatest ? "删除段落" : "只能删除最后一个段落"}
                >
                  ×
                </button>

                <div
                  onClick={() => {
                    if (mark) {
                      seekFrame(mark.frame_index);
                      openEdit(mark);
                    } else {
                      seekFrame(node.to_frame);
                    }
                  }}
                  style={{ display: "flex", gap: 12, flex: 1 }}
                >
                  {/* 缩略图 */}
                  {mark?.thumb && (
                    <img
                      src={mark.thumb}
                      style={{
                        width: 64,
                        height: 36,
                        objectFit: "cover",
                        borderRadius: 3,
                        flexShrink: 0,
                        border: "1px solid #d5d5d5"
                      }}
                      alt={`Segment ${node.node_id}`}
                    />
                  )}

                  {/* 段落信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* 标题行：node_id + 最新标签 */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={S.pill("#f59e0b")}>{node.node_id}</span>
                      {isLatest && <span style={S.pill("#10b981")}>最新</span>}
                    </div>

                    {/* 段落范围 */}
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                      帧 {node.from_frame}→{node.to_frame}
                      <span style={{ marginLeft: 8 }}>
                        ({node.from_timestamp.toFixed(2)}s→{node.to_timestamp.toFixed(2)}s)
                      </span>
                      <span style={{ marginLeft: 8, color: "#666", fontWeight: 600 }}>
                        {duration.toFixed(2)}s
                      </span>
                    </div>

                    {/* 动作显示（多个动作） */}
                    {node.actions && node.actions.length > 0 && (
                      <div style={{
                        fontSize: 11,
                        color: '#f59e0b',
                        fontWeight: 600,
                        marginBottom: 4,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <span>⚡</span>
                        {node.actions.map((action, idx) => (
                          <span key={idx} style={{ marginRight: 4 }}>
                            {action.target}·{action.action_name}
                            {idx < node.actions.length - 1 && ','}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 状态描述（段落结束状态） */}
                    <div style={{
                      fontSize: 12,
                      color: "#555",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      → {node.state_description}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
});

export default MarkedFramesList;
