import React, { useMemo, useState, useEffect } from 'react';
import { S } from '../../constants/styles';
import Modal from '../common/Modal';
import ModalHeader from '../common/ModalHeader';
import MetaForm from './MetaForm';

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
  
  const { target, actionName, customActionName, customTarget } = action;
  const finalActionName = actionName === 'CUSTOM' ? customActionName : actionName;
  // 判断是否显示自定义 target 输入框
  const isCustomTarget = target === 'CUSTOM_TARGET' || (target && !availableTargets.includes(target));

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

        {isCustomTarget && (
          <input
            type="text"
            placeholder="输入自定义目标对象..."
            value={customTarget || ''}
            onChange={(e) => {
              const newValue = e.target.value;
              onUpdate({ 
                ...action, 
                target: newValue.toLowerCase(),
                customTarget: newValue 
              });
            }}
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
 * 段落编辑模态框组件 - Unified Node Model (v4.0)
 * 用于编辑已存在的节点信息（包括父节点关系和多个动作）
 */
const EditModal = React.memo(function EditModal({
  // 显示控制
  isOpen,
  onClose,
  // 编辑数据
  editMark,
  // 表单数据
  stateDescription,
  onStateDescriptionChange,
  metaValues,
  onMetaValuesChange,
  taskSchema,
  // 父节点相关
  currentVideoId,
  nodes,
  parentNodeId,
  onParentNodeChange,
  // 动作编辑相关（多个动作）
  actions,
  onActionsChange,
  availableTargets,
  getActionSuggestions,
  // 提交
  onConfirm
}) {
  // 计算是否有有效数据
  const hasValidData = editMark && editMark.node_id;

  // 过滤掉当前节点，避免自己作为父节点
  const availableParentNodes = useMemo(() => {
    if (!nodes || !editMark) return [];
    return nodes.filter(n => n.node_id !== editMark.node_id);
  }, [nodes, editMark]);

  // 获取当前节点的信息（用于显示）
  const currentNode = useMemo(() => {
    if (!nodes || !editMark) return null;
    return nodes.find(n => n.node_id === editMark.node_id);
  }, [nodes, editMark]);

  // 本地状态控制是否显示动作编辑区域
  const [showActionEdit, setShowActionEdit] = useState(false);

  // 当模态框打开时，初始化动作编辑状态
  useEffect(() => {
    if (isOpen && currentNode) {
      setShowActionEdit(false);
      // 初始化动作列表
      if (currentNode.actions && currentNode.actions.length > 0) {
        const initialActions = currentNode.actions.map(a => ({
          target: a.target,
          actionName: a.action_name,
          customActionName: '',
          customTarget: ''
        }));
        onActionsChange(initialActions);
      } else {
        onActionsChange([]);
      }
    }
  }, [isOpen, currentNode, onActionsChange]);

  if (!hasValidData) return null;

  // 是否有现有动作
  const hasExistingAction = currentNode?.actions && currentNode.actions.length > 0;

  // 添加动作
  const addAction = () => {
    onActionsChange([...actions, { target: '', actionName: '', customActionName: '', customTarget: '' }]);
  };

  // 更新动作
  const updateAction = (index, updatedAction) => {
    const newActions = [...actions];
    newActions[index] = updatedAction;
    onActionsChange(newActions);
  };

  // 删除动作
  const deleteAction = (index) => {
    onActionsChange(actions.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} width={480}>
      <ModalHeader
        highlightText={editMark.node_id}
        secondaryText={editMark.frame_index !== undefined ? `帧#${editMark.frame_index}` : ''}
        onClose={onClose}
      >
        编辑段落{' '}
      </ModalHeader>

      {/* 段落信息显示 */}
      {currentNode && (
        <div style={{
          padding: '10px 14px',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 6,
          marginBottom: 14,
          fontSize: 12,
          color: '#0369a1',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            帧 {currentNode.from_frame} → {currentNode.to_frame}
          </div>
          {hasExistingAction && !showActionEdit && (
            <div style={{ color: '#f59e0b', fontWeight: 500 }}>
              ⚡ {currentNode.actions.map(a => `${a.target}·${a.action_name}`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* 警告提示 */}
      <div
        style={{
          padding: '10px 14px',
          background: '#fff3e0',
          border: '1px solid #f59e0b',
          borderRadius: 6,
          marginBottom: 14,
          fontSize: 12,
          color: '#bf7326',
        }}
        role="alert"
      >
        ⚠ 修改将影响所有引用此段落的标记，请确认
      </div>

      {/* 状态描述 */}
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>状态描述</label>
        <textarea
          value={stateDescription}
          onChange={(e) => onStateDescriptionChange(e.target.value)}
          placeholder="描述该段落结束时的状态..."
          rows={2}
          style={{ ...S.input, resize: 'vertical' }}
          aria-required="true"
        />
      </div>

      {/* 动作编辑区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={S.label}>
            段落动作
            <span style={{ color: '#999', fontWeight: 400, marginLeft: 8 }}>
              ({actions.length} 个)
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasExistingAction && !showActionEdit && (
              <button
                onClick={() => setShowActionEdit(true)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 3,
                  color: '#0284c7',
                  cursor: 'pointer',
                }}
              >
                修改动作
              </button>
            )}
          </div>
        </div>

        {/* 显示现有动作（当不编辑时） */}
        {hasExistingAction && !showActionEdit && (
          <div style={{
            padding: '10px 12px',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 4,
            fontSize: 12,
            color: '#92400e'
          }}>
            ⚡ {currentNode.actions.map(a => `${a.target}·${a.action_name}`).join(', ')}
          </div>
        )}

        {/* 动作编辑表单 */}
        {(showActionEdit || !hasExistingAction) && (
          <div>
            {actions.length === 0 ? (
              <div style={{
                padding: '16px',
                background: '#f9f9f9',
                border: '1px dashed #ddd',
                borderRadius: 6,
                textAlign: 'center',
                color: '#999',
                fontSize: 12,
                marginBottom: 10
              }}>
                暂无动作
              </div>
            ) : (
              actions.map((action, index) => (
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
              ))
            )}

            <button
              onClick={addAction}
              style={{
                width: '100%',
                fontSize: 11,
                padding: '8px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 4,
                color: '#0284c7',
                cursor: 'pointer',
                fontWeight: 500,
                marginBottom: 10
              }}
            >
              + 添加动作
            </button>

            {/* 取消编辑按钮 */}
            {showActionEdit && (
              <button
                onClick={() => {
                  setShowActionEdit(false);
                  // 重置为原始值
                  if (currentNode?.actions) {
                    const initialActions = currentNode.actions.map(a => ({
                      target: a.target,
                      actionName: a.action_name,
                      customActionName: '',
                      customTarget: ''
                    }));
                    onActionsChange(initialActions);
                  } else {
                    onActionsChange([]);
                  }
                }}
                style={{
                  fontSize: 11,
                  padding: '6px',
                  background: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: 3,
                  color: '#666',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                取消修改
              </button>
            )}
          </div>
        )}
      </div>

      {/* 父节点选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>
          父段落（逻辑来源）
          {parentNodeId && (
            <span style={{ color: '#f59e0b', marginLeft: 8, fontSize: 11 }}>
              {parentNodeId} → {editMark.node_id}
            </span>
          )}
        </label>

        {/* 根节点选项 */}
        <div style={{ marginBottom: 10 }}>
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

        {/* 可选父段落列表 */}
        {availableParentNodes.length > 0 && (
          <div
            style={{
              maxHeight: 150,
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
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: `2px solid ${isSelected ? '#f59e0b' : '#e5e5e5'}`,
                    background: isSelected ? '#f59e0b0d' : '#f9f7f4',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={S.pill('#f59e0b')}>{node.node_id}</span>
                    <span style={{ fontSize: 10, color: '#888' }}>
                      帧 {node.from_frame}→{node.to_frame}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#666' }}>
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
        )}
      </div>

      {/* Meta 表单 */}
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>段落 Meta</label>
        <MetaForm
          schema={taskSchema}
          values={metaValues}
          onChange={onMetaValuesChange}
        />
      </div>

      {/* 按钮组 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            ...S.btn(false),
            flex: 1,
            padding: '9px',
          }}
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={!stateDescription.trim()}
          style={{
            flex: 2,
            padding: '9px',
            background: '#f59e0b',
            color: '#000',
            border: 'none',
            borderRadius: 3,
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: stateDescription.trim() ? 'pointer' : 'not-allowed',
            opacity: stateDescription.trim() ? 1 : 0.5,
          }}
          aria-disabled={!stateDescription.trim()}
        >
          确认修改
        </button>
      </div>
    </Modal>
  );
});

export default EditModal;
