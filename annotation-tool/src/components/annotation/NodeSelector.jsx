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
      <label style={S.label}>选择要挂载的节点</label>
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
                  {Object.entries(node.node_meta).map(
                    ([key, value]) =>
                      value && (
                        <span
                          key={key}
                          style={{
                            fontSize: 10,
                            color: '#555',
                            background: '#141414',
                            padding: '1px 5px',
                            borderRadius: 2,
                          }}
                        >
                          {key}:{value}
                        </span>
                      )
                  )}
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
