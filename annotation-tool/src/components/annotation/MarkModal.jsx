import React, { useMemo, useState, useEffect } from 'react';
import { S } from '../../constants/styles';
import Modal from '../common/Modal';
import ModalHeader from '../common/ModalHeader';
import NodeModeSelector from './NodeModeSelector';
import NodeSelector from './NodeSelector';
import MetaForm from './MetaForm';
import { useAnnotationStore } from '../../stores/annotationStore';
import { useVideoStore } from '../../stores/videoStore';
import { useSessionStore } from '../../stores/sessionStore';

/**
 * 单个动作编辑组件
 */
const ActionEditor = React.memo(function ActionEditor({
  index,
  action,
  availableTargets,
  actionSuggestions,
  onUpdate,
  onDelete,
  canDelete
}) {
  const commonActionNames = ['open', 'close', 'pick', 'place', 'push', 'pull', 'pour', 'press'];
  
  const { target, actionName, customActionName } = action;
  const finalActionName = actionName === 'CUSTOM' ? customActionName : actionName;

  return (
    <div style={{
      padding: '12px',
      background: '#f9f7f4',
      border: '1px solid #e5e5e5',
      borderRadius: 6,
      marginBottom: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>动作 #{index + 1}</span>
        {canDelete && (
          <button
            onClick={onDelete}
            style={{
              fontSize: 10,
              padding: '2px 8px',
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: 3,
              color: '#c33',
              cursor: 'pointer',
            }}
          >
            删除
          </button>
        )}
      </div>

      {/* Target选择器 */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ ...S.label, fontSize: 11, color: '#666' }}>目标对象</label>
        <select
          value={target}
          onChange={(e) => onUpdate({ ...action, target: e.target.value, actionName: '', customActionName: '' })}
          style={{ ...S.input, cursor: 'pointer' }}
        >
          <option value="">选择目标对象...</option>
          {availableTargets.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
          <option value="CUSTOM_TARGET">+ 自定义目标</option>
        </select>

        {target === 'CUSTOM_TARGET' && (
          <input
            type="text"
            placeholder="输入自定义目标对象..."
            value={action.customTarget || ''}
            onChange={(e) => onUpdate({ ...action, target: e.target.value.toLowerCase(), customTarget: e.target.value })}
            style={{ ...S.input, marginTop: 6 }}
            autoFocus
          />
        )}
      </div>

      {/* Action Name选择器 */}
      <div>
        <label style={{ ...S.label, fontSize: 11, color: '#666' }}>
          动作名称
          {actionSuggestions.length > 0 && target && target !== 'CUSTOM_TARGET' && (
            <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 6 }}>
              {actionSuggestions.length} 个建议
            </span>
          )}
        </label>
        <select
          value={actionName}
          onChange={(e) => onUpdate({ ...action, actionName: e.target.value, customActionName: '' })}
          disabled={!target || target === 'CUSTOM_TARGET'}
          style={{
            ...S.input,
            cursor: target && target !== 'CUSTOM_TARGET' ? 'pointer' : 'not-allowed',
            opacity: target && target !== 'CUSTOM_TARGET' ? 1 : 0.5
          }}
        >
          <option value="">选择动作...</option>
          
          {actionSuggestions.length > 0 && (
            <optgroup label="历史使用">
              {actionSuggestions.map(sugg => (
                <option key={sugg.value} value={sugg.value}>
                  {sugg.label} (×{sugg.useCount})
                </option>
              ))}
            </optgroup>
          )}
          
          <optgroup label="常用动作">
            {commonActionNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </optgroup>
          
          <option value="CUSTOM">+ 自定义动作</option>
        </select>

        {actionName === 'CUSTOM' && (
          <input
            type="text"
            placeholder="输入自定义动作名称..."
            value={customActionName}
            onChange={(e) => onUpdate({ ...action, customActionName: e.target.value.toLowerCase() })}
            style={{ ...S.input, marginTop: 6 }}
            autoFocus
          />
        )}
      </div>

      {/* 动作预览 */}
      {target && target !== 'CUSTOM_TARGET' && finalActionName && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: 4,
          fontSize: 11,
          color: '#92400e'
        }}>
          ⚡ {target} · {finalActionName}
        </div>
      )}
    </div>
  );
});

/**
 * 标注模态框组件 - Unified Node Model (v4.0)
 * 支持多个动作（actions 数组）
 */
const MarkModal = React.memo(function MarkModal({
  isOpen,
  onClose,
  pendingCapture,
  mode,
  onModeChange,
  nodes,
  allNodes,
  selectedNodeId,
  onSelectNode,
  stateDescription,
  onStateDescriptionChange,
  metaValues,
  onMetaValuesChange,
  taskSchema,
  parentNodeId,
  onParentNodeChange,
  onConfirm
}) {
  const { currentVideoId } = useVideoStore();
  const { taskType } = useSessionStore();
  const { getLastSegment, actionLib } = useAnnotationStore();

  // 本地状态：动作列表
  const [actions, setActions] = useState([]);

  // 获取段落范围信息
  const lastSegment = useMemo(() => {
    if (!currentVideoId) return null;
    return getLastSegment(currentVideoId);
  }, [currentVideoId, getLastSegment, nodes]);

  const fromFrame = lastSegment ? lastSegment.to_frame : 0;
  const fromTimestamp = lastSegment ? lastSegment.to_timestamp : 0;

  // 获取可用的targets
  const availableTargets = useMemo(() => {
    const taskActions = actionLib[taskType] || [];
    const targets = [...new Set(taskActions.map(a => a.target).filter(Boolean))];
    const commonTargets = ['drawer', 'red_mug', 'coffee_machine', 'water_tap', 'cabinet', 'plate'];
    return [...new Set([...targets, ...commonTargets])].sort();
  }, [actionLib, taskType]);

  // 获取针对当前target的action建议
  const getActionSuggestions = (target) => {
    if (!target) return [];
    const taskActions = actionLib[taskType] || [];
    return taskActions
      .filter(a => a.target === target)
      .sort((a, b) => b.use_count - a.use_count)
      .map(a => ({
        label: a.action_name,
        value: a.action_name,
        useCount: a.use_count
      }));
  };

  // 计算确认按钮是否可用
  const canConfirm = useMemo(() => {
    if (mode === 'new') {
      return stateDescription.trim().length > 0;
    } else {
      return selectedNodeId != null;
    }
  }, [mode, stateDescription, selectedNodeId]);

  // 可选的父段落（从当前视频的nodes中筛选）
  const availableParentNodes = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter(n => n.to_frame < (pendingCapture?.frameIndex || Infinity));
  }, [nodes, pendingCapture?.frameIndex]);

  // 复用模式下，显示所有唯一节点（去重）
  const uniqueNodesForReuse = useMemo(() => {
    if (!allNodes) return [];
    return allNodes;
  }, [allNodes]);

  // 添加动作
  const addAction = () => {
    setActions([...actions, { target: '', actionName: '', customActionName: '', customTarget: '' }]);
  };

  // 更新动作
  const updateAction = (index, updatedAction) => {
    const newActions = [...actions];
    newActions[index] = updatedAction;
    setActions(newActions);
  };

  // 删除动作
  const deleteAction = (index) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  // 复用模式下，当选中节点时自动填充该节点的动作
  useEffect(() => {
    if (mode === 'existing' && selectedNodeId && allNodes) {
      // 从所有节点中查找该节点（获取动作）
      const selectedNode = allNodes.find(n => n.node_id === selectedNodeId);
      if (selectedNode && selectedNode.actions && selectedNode.actions.length > 0) {
        // 填充动作
        const sourceActions = selectedNode.actions.map(a => ({
          target: a.target,
          actionName: a.action_name,
          customActionName: '',
          customTarget: ''
        }));
        setActions(sourceActions);
      } else {
        setActions([]);
      }
    }
  }, [mode, selectedNodeId, allNodes]);

  // 处理确认
  const handleConfirm = () => {
    onConfirm(parentNodeId, actions);
    // 重置动作列表
    setActions([]);
  };

  // 处理关闭
  const handleClose = () => {
    setActions([]);
    onClose();
  };

  if (!pendingCapture) return null;

  const segmentDuration = pendingCapture.timestamp - fromTimestamp;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} width={580}>
      <ModalHeader
        highlightText={`#${pendingCapture.frameIndex}`}
        secondaryText={`${pendingCapture.timestamp.toFixed(2)}s`}
        onClose={handleClose}
      >
        标注段落{' '}
      </ModalHeader>

      {/* 段落范围显示 */}
      <div style={{
        background: '#f0f9ff',
        padding: 12,
        borderRadius: 6,
        marginBottom: 16,
        border: '1px solid #bae6fd'
      }}>
        <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600, marginBottom: 6 }}>
          视频段落范围
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e', marginBottom: 4 }}>
          帧 {fromFrame} → {pendingCapture.frameIndex}
        </div>
        <div style={{ fontSize: 12, color: '#0369a1' }}>
          {fromTimestamp.toFixed(2)}s → {pendingCapture.timestamp.toFixed(2)}s
          <span style={{ marginLeft: 8, fontWeight: 600 }}>
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
            borderRadius: 3,
            marginBottom: 14,
            border: '1px solid #1e1e1e',
            display: 'block',
          }}
        />
      )}

      {/* 模式选择 */}
      <NodeModeSelector
        mode={mode}
        onModeChange={onModeChange}
        existingNodeCount={uniqueNodesForReuse.length}
      />

      {/* 新建段落表单 */}
      {mode === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>
              状态描述
              <span style={{ fontSize: 11, color: '#888', marginLeft: 8, fontWeight: 400 }}>
                （描述本段结束时的状态）
              </span>
            </label>
            <textarea
              value={stateDescription}
              onChange={(e) => onStateDescriptionChange(e.target.value)}
              placeholder="例如：抽屉完全打开，杯子已放置在咖啡机下方..."
              rows={2}
              style={{ ...S.input, resize: 'vertical' }}
              aria-required="true"
            />
          </div>

          {/* 父段落选择 */}
          {availableParentNodes.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <label style={S.label}>
                父段落（逻辑来源）<span style={{color: '#999', fontWeight: 400}}>(可选)</span>
                {parentNodeId && (
                  <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 11 }}>
                    {parentNodeId} → 新段落
                  </span>
                )}
              </label>
              
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={() => onParentNodeChange(null)}
                  style={{
                    ...S.btn(!parentNodeId),
                    width: '100%',
                    padding: '8px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>无父段落（起始段落）</span>
                  <span style={{ color: '#666', marginLeft: 8, fontSize: 11 }}>
                    这是任务的起始状态
                  </span>
                </button>
              </div>

              <div
                style={{
                  maxHeight: 120,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {availableParentNodes.map((node) => {
                  const isSelected = parentNodeId === node.node_id;
                  return (
                    <div
                      key={node.node_id}
                      onClick={() => onParentNodeChange(node.node_id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: `2px solid ${isSelected ? '#f59e0b' : '#e5e5e5'}`,
                        background: isSelected ? '#f59e0b0d' : '#f9f7f4',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ ...S.pill('#f59e0b'), fontSize: 10, padding: '2px 6px' }}>{node.node_id}</span>
                        <span style={{ fontSize: 10, color: '#888' }}>
                          帧 {node.from_frame}→{node.to_frame}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {node.state_description}
                      </div>
                      {node.actions && node.actions.length > 0 && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                          ⚡ {node.actions.map(a => `${a.target}·${a.action_name}`).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label style={S.label}>段落 Meta</label>
            <MetaForm
              schema={taskSchema}
              values={metaValues}
              onChange={onMetaValuesChange}
            />
          </div>
        </div>
      )}

      {/* 复用段落选择 */}
      {mode === 'existing' && (
        <div style={{ marginBottom: 12 }}>
          <NodeSelector
            nodes={uniqueNodesForReuse}
            selectedNodeId={selectedNodeId}
            onSelect={onSelectNode}
          />
          
          {/* 复用模式下的父节点选择 */}
          {availableParentNodes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>
                父段落（逻辑来源）<span style={{color: '#999', fontWeight: 400}}>(可选)</span>
                {parentNodeId && (
                  <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 11 }}>
                    {parentNodeId} → 复用段落
                  </span>
                )}
              </label>
              
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={() => onParentNodeChange(null)}
                  style={{
                    ...S.btn(!parentNodeId),
                    width: '100%',
                    padding: '8px',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>无父段落（起始段落）</span>
                </button>
              </div>

              <div
                style={{
                  maxHeight: 120,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {availableParentNodes.map((node) => {
                  const isSelected = parentNodeId === node.node_id;
                  return (
                    <div
                      key={node.node_id}
                      onClick={() => onParentNodeChange(node.node_id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: `2px solid ${isSelected ? '#f59e0b' : '#e5e5e5'}`,
                        background: isSelected ? '#f59e0b0d' : '#f9f7f4',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ ...S.pill('#f59e0b'), fontSize: 10, padding: '2px 6px' }}>{node.node_id}</span>
                        <span style={{ fontSize: 10, color: '#888' }}>
                          帧 {node.from_frame}→{node.to_frame}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {node.state_description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 分隔线 */}
      <div style={{ borderTop: '1px solid #1e1e1e', margin: '16px 0' }} />

      {/* 多动作输入区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={S.label}>
            段落动作
            <span style={{ color: '#999', fontWeight: 400, marginLeft: 8 }}>
              ({actions.length} 个)
            </span>
          </label>
          <button
            onClick={addAction}
            style={{
              fontSize: 11,
              padding: '6px 12px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 4,
              color: '#0284c7',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + 添加动作
          </button>
        </div>

        {/* 动作列表 */}
        {actions.length === 0 && (
          <div style={{
            padding: '16px',
            background: '#f9f9f9',
            border: '1px dashed #ddd',
            borderRadius: 6,
            textAlign: 'center',
            color: '#999',
            fontSize: 12
          }}>
            暂无动作，点击"添加动作"按钮添加
          </div>
        )}

        {actions.map((action, index) => (
          <ActionEditor
            key={index}
            index={index}
            action={action}
            availableTargets={availableTargets}
            actionSuggestions={getActionSuggestions(action.target)}
            onUpdate={(updated) => updateAction(index, updated)}
            onDelete={() => deleteAction(index)}
            canDelete={actions.length > 0}
          />
        ))}
      </div>

      {/* 确认按钮 */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        style={{
          marginTop: 8,
          width: '100%',
          padding: 11,
          fontSize: 13,
          fontFamily: 'inherit',
          fontWeight: 600,
          border: 'none',
          borderRadius: 3,
          cursor: canConfirm ? 'pointer' : 'not-allowed',
          background: '#f59e0b',
          color: '#000',
          opacity: canConfirm ? 1 : 0.35,
        }}
        aria-disabled={!canConfirm}
      >
        {mode === 'new' 
          ? `确认标注新段落${actions.length > 0 ? ` (${actions.length} 个动作)` : ''}` 
          : `确认复用段落${actions.length > 0 ? ` (${actions.length} 个动作)` : ''}`
        }
      </button>
    </Modal>
  );
});

export default MarkModal;
