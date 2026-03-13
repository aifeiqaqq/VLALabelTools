import React from 'react';
import { S } from '../../constants/styles';

/**
 * 现有节点选择列表
 * @param {Object} props
 * @param {Array} props.nodes - 节点列表
 * @param {string} props.selectedNodeId - 当前选中的节点ID
 * @param {Function} props.onSelect - 选择回调
 */
const NodeSelector = React.memo(function NodeSelector({
  nodes,
  selectedNodeId,
  onSelect
}) {
  if (!nodes || nodes.length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: 20 }}>
        暂无可用节点
      </div>
    );
  }

  return (
    <div>
      <label style={S.label}>选择要复用的节点</label>
      <div
        style={{
          maxHeight: 220,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
        role="listbox"
        aria-label="节点选择列表"
      >
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.node_id;
          return (
            <div
              key={node.node_id}
              onClick={() => onSelect(node.node_id)}
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                border: `2px solid ${isSelected ? '#f59e0b' : '#e5e5e5'}`,
                background: isSelected ? '#f59e0b0d' : '#f9f7f4',
              }}
              role="option"
              aria-selected={isSelected}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span style={S.pill('#f59e0b')}>{node.node_id}</span>
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {node.state_description}
              </div>
              {node.actions && node.actions.length > 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, fontWeight: 500 }}>
                  ⚡ {node.actions.map(a => `${a.target}·${a.action_name}`).join(', ')}
                </div>
              )}
              {node.video_id && (
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  来自: {node.video_id}
                </div>
              )}
              {node.node_meta && (
                <div
                  style={{
                    marginTop: 4,
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  {Object.entries(node.node_meta)
                    .filter(([key]) => key !== 'imported_at')  // 过滤掉imported_at
                    .map(([key, value]) => {
                      if (!value) return null;

                      // suggested_parents使用特殊样式
                      const isSuggestedParent = key === 'suggested_parents';

                      return (
                        <span
                          key={key}
                          style={{
                            fontSize: 10,
                            color: isSuggestedParent ? '#8b5cf6' : '#666',
                            background: isSuggestedParent ? '#f5f3ff' : '#ffffff',
                            padding: '2px 6px',
                            borderRadius: 3,
                            border: isSuggestedParent ? '1px solid #c4b5fd' : '1px solid #e5e5e5',
                            fontWeight: isSuggestedParent ? 500 : 400
                          }}
                          title={isSuggestedParent ? "导入时建议的父节点" : undefined}
                        >
                          {isSuggestedParent ? `建议父节点: ${value}` : `${key}:${value}`}
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

export default NodeSelector;
