import React from 'react';
import { S } from '../../constants/styles';

/**
 * 节点选择模式切换器（新建节点 vs 复用现有节点 vs 复用路由）
 * @param {Object} props
 * @param {string} props.mode - 当前模式 ('new' | 'existing' | 'route')
 * @param {Function} props.onModeChange - 模式切换回调
 * @param {number} props.existingNodeCount - 现有节点数量
 * @param {number} props.existingRouteCount - 现有路线数量
 */
const NodeModeSelector = React.memo(function NodeModeSelector({
  mode,
  onModeChange,
  existingNodeCount = 0,
  existingRouteCount = 0
}) {
  const canSelectExisting = existingNodeCount > 0;
  const canSelectRoute = existingRouteCount > 0;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button
        onClick={() => onModeChange('new')}
        style={{
          ...S.btn(mode === 'new'),
          flex: 1,
          padding: '8px',
        }}
        aria-pressed={mode === 'new'}
      >
        + 新建节点
      </button>
      <button
        onClick={() => canSelectExisting && onModeChange('existing')}
        style={{
          ...S.btn(mode === 'existing'),
          flex: 1,
          padding: '8px',
          opacity: canSelectExisting ? 1 : 0.4,
          cursor: canSelectExisting ? 'pointer' : 'not-allowed',
        }}
        disabled={!canSelectExisting}
        aria-pressed={mode === 'existing'}
        aria-disabled={!canSelectExisting}
      >
        复用节点 ({existingNodeCount})
      </button>
      <button
        onClick={() => canSelectRoute && onModeChange('route')}
        style={{
          ...S.btn(mode === 'route', '#8b5cf6'),
          flex: 1,
          padding: '8px',
          opacity: canSelectRoute ? 1 : 0.4,
          cursor: canSelectRoute ? 'pointer' : 'not-allowed',
        }}
        disabled={!canSelectRoute}
        aria-pressed={mode === 'route'}
        aria-disabled={!canSelectRoute}
      >
        复用路由 ({existingRouteCount})
      </button>
    </div>
  );
});

export default NodeModeSelector;
