import React from 'react';
import { S } from '../../constants/styles';

/**
 * Route Selector Component
 * 路线选择器组件 - 显示可用路线列表供用户选择
 *
 * @param {Array} routes - Array of route objects
 * @param {string} selectedRouteId - Currently selected route ID
 * @param {Function} onSelect - Callback when a route is selected
 * @param {Array} allNodes - All nodes for displaying state descriptions
 */
const RouteSelector = React.memo(function RouteSelector({
  routes,
  selectedRouteId,
  onSelect,
  allNodes
}) {
  if (!routes || routes.length === 0) {
    return (
      <div style={{
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        padding: 24,
        background: '#f9f7f4',
        borderRadius: 6,
        border: '1px solid #e5e5e5'
      }}>
        暂无可用路线
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.label}>选择要复用的路线</label>
      <div
        style={{
          maxHeight: 220,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 2
        }}
      >
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.route_id;

          return (
            <div
              key={route.route_id}
              onClick={() => onSelect(route.route_id)}
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                border: `2px solid ${isSelected ? '#8b5cf6' : '#e5e5e5'}`,
                background: isSelected ? '#f5f3ff' : '#f9f7f4',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Route Header */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 8
                }}
              >
                <span
                  style={{
                    ...S.pill('#8b5cf6'),
                    fontWeight: 600,
                    fontSize: 11
                  }}
                >
                  {route.route_name}
                </span>
                <span style={{ fontSize: 10, color: '#888' }}>
                  {route.node_sequence.length} 个节点
                </span>
              </div>

              {/* Node Sequence Preview */}
              <div
                style={{
                  fontSize: 11,
                  color: '#666',
                  display: 'flex',
                  gap: 5,
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}
              >
                {route.node_sequence.map((nodeId, idx) => {
                  const node = allNodes.find(n => n.node_id === nodeId);
                  const nodeDesc = node?.state_description || nodeId;

                  return (
                    <React.Fragment key={`${nodeId}-${idx}`}>
                      <span
                        style={{
                          background: '#fff',
                          padding: '3px 8px',
                          borderRadius: 3,
                          border: '1px solid #ddd',
                          fontSize: 10,
                          fontWeight: 500,
                          color: '#333'
                        }}
                        title={nodeDesc}
                      >
                        {nodeId}
                      </span>
                      {idx < route.node_sequence.length - 1 && (
                        <span
                          style={{
                            color: '#8b5cf6',
                            fontWeight: 700,
                            fontSize: 12
                          }}
                        >
                          →
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Source Videos Info */}
              {route.source_videos && route.source_videos.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#8b5cf6',
                    marginTop: 6,
                    opacity: 0.8
                  }}
                >
                  来自 {route.source_videos.length} 个视频
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default RouteSelector;
