import React, { useMemo } from 'react';
import { S } from '../../constants/styles';

/**
 * RoutePreselector Component
 * 路由预选择器 - 在主界面允许用户预选择要复用的路由
 * 选中后按 M 键可直接进入快速标注模式
 *
 * @param {Array} routes - 可用路由列表
 * @param {string} selectedRouteId - 当前选中的路由ID
 * @param {Function} onSelectRoute - 选择路由回调
 * @param {Function} onClearRoute - 清除选择回调
 * @param {Object} activeRoute - 当前激活的路由对象
 * @param {Object} routeProgress - 当前路由进度 { currentIndex, totalNodes }
 * @param {Array} allNodes - 所有节点列表
 */
const RoutePreselector = React.memo(function RoutePreselector({
  routes,
  selectedRouteId,
  onSelectRoute,
  onClearRoute,
  activeRoute,
  routeProgress,
  allNodes
}) {
  // 获取当前节点的信息
  const currentNodeInfo = useMemo(() => {
    if (!activeRoute || !routeProgress) return null;
    const nodeId = activeRoute.node_sequence[routeProgress.currentIndex];
    const node = allNodes?.find(n => n.node_id === nodeId);
    return {
      nodeId,
      node,
      progress: ((routeProgress.currentIndex + 1) / routeProgress.totalNodes) * 100
    };
  }, [activeRoute, routeProgress, allNodes]);

  // 没有可用路由
  if (!routes || routes.length === 0) {
    return (
      <div style={{
        padding: '10px 14px',
        background: '#f9f7f4',
        borderRadius: 6,
        border: '1px dashed #d1d5db',
        fontSize: 12,
        color: '#9ca3af',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span>📋</span>
        <span>暂无可用路由（请先完成一些标注）</span>
      </div>
    );
  }

  // 快速模式激活中
  if (activeRoute && routeProgress) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#f5f3ff',
        borderRadius: 6,
        border: '2px solid #8b5cf6',
      }}>
        {/* 头部信息 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              ...S.pill('#8b5cf6'),
              fontWeight: 600,
              fontSize: 11
            }}>
              ⚡ 快速模式
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
              {activeRoute.route_name}
            </span>
          </div>
          <button
            onClick={onClearRoute}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: 4,
              color: '#dc2626',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            退出快速模式
          </button>
        </div>

        {/* 进度条 */}
        <div style={{
          height: 6,
          background: '#e9d5ff',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 10
        }}>
          <div style={{
            height: '100%',
            width: `${currentNodeInfo?.progress || 0}%`,
            background: '#8b5cf6',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* 当前节点信息 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6b7280' }}>
              进度: {routeProgress.currentIndex + 1} / {routeProgress.totalNodes}
            </span>
            {currentNodeInfo?.node && (
              <span style={{
                padding: '2px 8px',
                background: '#fff',
                borderRadius: 4,
                border: '1px solid #c4b5fd',
                color: '#1f2937',
                fontWeight: 500
              }}>
                {currentNodeInfo.nodeId}: {currentNodeInfo.node.state_description}
              </span>
            )}
          </div>
          <span style={{ color: '#8b5cf6', fontWeight: 500, fontSize: 11 }}>
            按 M 键快速标注
          </span>
        </div>

        {/* 动作预览 */}
        {currentNodeInfo?.node?.actions && currentNodeInfo.node.actions.length > 0 && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            background: '#fff',
            borderRadius: 4,
            border: '1px solid #e9d5ff',
            fontSize: 11,
            color: '#f59e0b',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap'
          }}>
            <span>⚡</span>
            {currentNodeInfo.node.actions.map((action, idx) => (
              <span key={idx} style={{ fontWeight: 500 }}>
                {action.target}·{action.action_name}
                {idx < currentNodeInfo.node.actions.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 路由选择下拉模式
  return (
    <div style={{
      padding: '10px 14px',
      background: '#f9f7f4',
      borderRadius: 6,
      border: '1px solid #e5e5e5',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
        📋 复用路由:
      </span>
      
      <select
        value={selectedRouteId || ''}
        onChange={(e) => onSelectRoute(e.target.value || null)}
        style={{
          flex: 1,
          padding: '6px 10px',
          fontSize: 13,
          border: '1px solid #d1d5db',
          borderRadius: 4,
          background: '#fff',
          cursor: 'pointer',
          color: selectedRouteId ? '#1f2937' : '#9ca3af'
        }}
      >
        <option value="">-- 选择要复用的路由 --</option>
        {routes.map(route => (
          <option key={route.route_id} value={route.route_id}>
            {route.route_name} ({route.node_sequence.length} 个节点)
          </option>
        ))}
      </select>

      {selectedRouteId && (
        <button
          onClick={() => onSelectRoute(selectedRouteId)}
          style={{
            fontSize: 12,
            padding: '6px 14px',
            background: '#8b5cf6',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          开始快速标注
        </button>
      )}
    </div>
  );
});

export default RoutePreselector;
