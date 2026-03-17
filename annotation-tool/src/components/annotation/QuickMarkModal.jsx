import React, { useEffect, useCallback } from 'react';
import { S } from '../../constants/styles';
import Modal from '../common/Modal';
import ModalHeader from '../common/ModalHeader';

/**
 * QuickMarkModal Component
 * 快速标注模态框 - 简化版标注对话框，用于路由快速标注模式
 * 用户只需按 Enter 确认，无需填写任何信息
 *
 * @param {boolean} isOpen - 是否显示
 * @param {Function} onClose - 关闭回调
 * @param {Function} onConfirm - 确认回调
 * @param {Object} pendingCapture - 当前帧捕获信息 { frameIndex, timestamp, thumb }
 * @param {Object} activeRoute - 当前激活的路由
 * @param {Object} routeProgress - 当前路由进度 { currentIndex, totalNodes }
 * @param {Array} allNodes - 所有节点列表
 * @param {number} fromFrame - 起始帧
 * @param {number} fromTimestamp - 起始时间戳
 */
const QuickMarkModal = React.memo(function QuickMarkModal({
  isOpen,
  onClose,
  onConfirm,
  pendingCapture,
  activeRoute,
  routeProgress,
  allNodes,
  fromFrame,
  fromTimestamp
}) {
  // 获取当前节点信息
  const currentNodeId = activeRoute?.node_sequence?.[routeProgress?.currentIndex];
  const currentNode = allNodes?.find(n => n.node_id === currentNodeId);
  const progress = routeProgress ? ((routeProgress.currentIndex + 1) / routeProgress.totalNodes) * 100 : 0;

  // 键盘事件处理 - Enter 确认, Esc 取消
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        onConfirm();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }, [isOpen, onConfirm, onClose]);

  // 注册键盘监听
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!pendingCapture || !activeRoute || !routeProgress) return null;

  const segmentDuration = pendingCapture.timestamp - fromTimestamp;

  return (
    <Modal isOpen={isOpen} onClose={onClose} width={480}>
      <ModalHeader
        highlightText={`#${pendingCapture.frameIndex}`}
        secondaryText={`${pendingCapture.timestamp.toFixed(2)}s`}
        onClose={onClose}
      >
        快速标注{' '}
        <span style={{ 
          fontSize: 12, 
          color: '#8b5cf6',
          fontWeight: 600,
          marginLeft: 4
        }}>
          ⚡ {activeRoute.route_name}
        </span>
      </ModalHeader>

      {/* 进度指示器 */}
      <div style={{
        background: '#f5f3ff',
        padding: '10px 14px',
        borderRadius: 6,
        marginBottom: 14,
        border: '1px solid #c4b5fd'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8
        }}>
          <span style={{
            fontSize: 11,
            color: '#8b5cf6',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            路由进度
          </span>
          <span style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>
            {routeProgress.currentIndex + 1} / {routeProgress.totalNodes}
          </span>
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
            width: `${progress}%`,
            background: '#8b5cf6',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* 节点序列预览 */}
        <div style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {activeRoute.node_sequence.map((nodeId, idx) => {
            const isDone = idx < routeProgress.currentIndex;
            const isCurrent = idx === routeProgress.currentIndex;
            const isPending = idx > routeProgress.currentIndex;

            return (
              <span
                key={`${nodeId}-${idx}`}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: isDone
                    ? '#c4b5fd'
                    : isCurrent
                    ? '#8b5cf6'
                    : '#e9d5ff',
                  color: isCurrent ? '#fff' : '#1f2937',
                  fontWeight: isCurrent ? 600 : isDone ? 500 : 400,
                  border: isCurrent ? '2px solid #6d28d9' : 'none',
                  opacity: isPending ? 0.5 : 1
                }}
                title={allNodes?.find(n => n.node_id === nodeId)?.state_description || nodeId}
              >
                {nodeId}
                {isDone && ' ✓'}
              </span>
            );
          })}
        </div>
      </div>

      {/* 段落范围显示 */}
      <div style={{
        background: '#f0f9ff',
        padding: 10,
        borderRadius: 6,
        marginBottom: 14,
        border: '1px solid #bae6fd'
      }}>
        <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600, marginBottom: 4 }}>
          视频段落范围
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0c4a6e' }}>
          帧 {fromFrame} → {pendingCapture.frameIndex}
        </div>
        <div style={{ fontSize: 11, color: '#0369a1', marginTop: 2 }}>
          {fromTimestamp.toFixed(2)}s → {pendingCapture.timestamp.toFixed(2)}s
          <span style={{ marginLeft: 8, fontWeight: 500 }}>
            (时长: {segmentDuration.toFixed(2)}s)
          </span>
        </div>
      </div>

      {/* 帧缩略图 */}
      {pendingCapture.thumb && (
        <img
          src={pendingCapture.thumb}
          alt={`帧 ${pendingCapture.frameIndex} 预览`}
          style={{
            width: '100%',
            borderRadius: 6,
            marginBottom: 14,
            border: '1px solid #e5e5e5',
            display: 'block',
          }}
        />
      )}

      {/* 当前节点信息卡片 */}
      <div style={{
        background: '#fff',
        padding: 14,
        borderRadius: 6,
        border: '2px solid #8b5cf6',
        marginBottom: 14
      }}>
        <div style={{
          fontSize: 10,
          color: '#8b5cf6',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: 8,
          fontWeight: 600
        }}>
          当前节点 (自动填充)
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span style={{
            ...S.pill('#8b5cf6'),
            fontWeight: 600,
            fontSize: 12
          }}>
            {currentNodeId}
          </span>
          <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 600 }}>
            {currentNode?.state_description || '加载中...'}
          </span>
        </div>

        {/* 动作预览 */}
        {currentNode?.actions && currentNode.actions.length > 0 && (
          <div style={{
            fontSize: 11,
            color: '#f59e0b',
            marginTop: 8,
            padding: '8px 10px',
            background: '#fef3c7',
            borderRadius: 4,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600 }}>⚡ 动作:</span>
            {currentNode.actions.map((action, idx) => (
              <span key={idx} style={{ fontWeight: 500 }}>
                {action.target}·{action.action_name}
                {idx < currentNode.actions.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}

        {/* 自动填充提示 */}
        <div style={{
          marginTop: 10,
          padding: '8px 10px',
          background: '#f5f3ff',
          borderRadius: 4,
          fontSize: 10,
          color: '#6b7280'
        }}>
          ✓ 状态描述、动作列表、节点元数据、父节点关系将自动填充
        </div>
      </div>

      {/* 操作提示 */}
      <div style={{
        background: '#f9fafb',
        padding: '12px 16px',
        borderRadius: 6,
        border: '1px dashed #d1d5db',
        marginBottom: 14,
        textAlign: 'center'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          fontSize: 12,
          color: '#4b5563'
        }}>
          <span>
            <kbd style={{
              background: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              fontFamily: 'inherit',
              fontWeight: 600
            }}>Enter</kbd>
            {' '}确认标注
          </span>
          <span>
            <kbd style={{
              background: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              fontFamily: 'inherit',
              fontWeight: 600
            }}>Esc</kbd>
            {' '}取消
          </span>
        </div>
      </div>

      {/* 确认按钮 */}
      <button
        onClick={onConfirm}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          fontFamily: 'inherit',
          fontWeight: 600,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          background: '#8b5cf6',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
      >
        <span>⚡</span>
        <span>确认标注 ({routeProgress.currentIndex + 1}/{routeProgress.totalNodes})</span>
        <span style={{
          fontSize: 11,
          opacity: 0.8,
          fontWeight: 400,
          marginLeft: 4
        }}>
          按 Enter
        </span>
      </button>
    </Modal>
  );
});

export default QuickMarkModal;
