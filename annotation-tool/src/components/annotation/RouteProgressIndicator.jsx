import React from 'react';
import { S } from '../../constants/styles';

/**
 * Route Progress Indicator Component
 * 路线进度指示器组件 - 显示路线标注进度和当前节点信息
 *
 * @param {Object} route - Current active route object
 * @param {number} currentIndex - Current node index in the sequence
 * @param {Array} allNodes - All nodes for displaying node details
 */
const RouteProgressIndicator = React.memo(function RouteProgressIndicator({
  route,
  currentIndex,
  allNodes
}) {
  if (!route || currentIndex === undefined || currentIndex === null) {
    return null;
  }

  const currentNodeId = route.node_sequence[currentIndex];
  const currentNode = allNodes.find(n => n.node_id === currentNodeId);
  const progress = ((currentIndex + 1) / route.node_sequence.length) * 100;

  return (
    <div
      style={{
        background: '#f5f3ff',
        border: '2px solid #8b5cf6',
        borderRadius: 6,
        padding: 14,
        marginBottom: 14
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#8b5cf6',
            letterSpacing: '0.5px'
          }}
        >
          路由标注进度: {route.route_name}
        </span>
        <span style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>
          {currentIndex + 1} / {route.node_sequence.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: 6,
          background: '#e9d5ff',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 12
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#8b5cf6',
            transition: 'width 0.4s ease',
            borderRadius: 3
          }}
        />
      </div>

      {/* Current Node Info */}
      <div
        style={{
          background: '#fff',
          padding: 12,
          borderRadius: 5,
          border: '1px solid #c4b5fd',
          marginBottom: 10
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#8b5cf6',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: 6,
            fontWeight: 500
          }}
        >
          当前节点:
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              ...S.pill('#8b5cf6'),
              fontWeight: 600,
              fontSize: 11
            }}
          >
            {currentNodeId}
          </span>
          <span style={{ fontSize: 12, color: '#1f2937', fontWeight: 500 }}>
            {currentNode?.state_description || '加载中...'}
          </span>
        </div>

        {/* Actions Preview */}
        {currentNode?.actions && currentNode.actions.length > 0 && (
          <div
            style={{
              fontSize: 10,
              color: '#f59e0b',
              marginTop: 6,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontWeight: 600 }}>⚡</span>
            {currentNode.actions.map((action, idx) => (
              <span key={idx} style={{ fontWeight: 500 }}>
                {action.target}·{action.action_name}
                {idx < currentNode.actions.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Node Sequence Visualization */}
      <div
        style={{
          display: 'flex',
          gap: 5,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        {route.node_sequence.map((nodeId, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isPending = idx > currentIndex;

          return (
            <span
              key={`${nodeId}-${idx}`}
              style={{
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 4,
                background: isDone
                  ? '#c4b5fd'
                  : isCurrent
                  ? '#8b5cf6'
                  : '#e9d5ff',
                color: isCurrent ? '#fff' : '#1f2937',
                fontWeight: isCurrent ? 600 : isDone ? 500 : 400,
                border: isCurrent ? '2px solid #6d28d9' : 'none',
                transition: 'all 0.3s ease',
                opacity: isPending ? 0.6 : 1
              }}
              title={
                allNodes.find(n => n.node_id === nodeId)?.state_description ||
                nodeId
              }
            >
              {nodeId}
              {isDone && ' ✓'}
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default RouteProgressIndicator;
