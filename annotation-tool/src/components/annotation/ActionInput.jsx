import React from 'react';
import { S } from '../../constants/styles';

/**
 * 动作描述输入组件（带搜索建议）
 * @param {Object} props
 * @param {string} props.value - 当前输入值
 * @param {Function} props.onChange - 输入变化回调
 * @param {Array} props.suggestions - 建议列表 [{id, text, use_count}]
 * @param {string} props.sourceNodeId - 源节点ID（显示 from → ?）
 * @param {string} props.placeholder - 占位文本
 */
const ActionInput = React.memo(function ActionInput({
  value,
  onChange,
  suggestions = [],
  sourceNodeId,
  placeholder = '输入或从下方选择动作...'
}) {
  const hasSuggestions = suggestions.length > 0;

  return (
    <div
      style={{
        marginBottom: 14,
        padding: 14,
        background: '#f9f7f4',
        border: '1px solid #e5e5e5',
        borderRadius: 6,
      }}
    >
      <label style={S.label}>
        动作描述
        {sourceNodeId && (
          <span style={{ color: '#f59e0b55' }}>
            {' '}{sourceNodeId} → ？
          </span>
        )}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={S.input}
        aria-autocomplete="list"
        aria-controls={hasSuggestions ? 'action-suggestions' : undefined}
      />
      {hasSuggestions && (
        <div
          id="action-suggestions"
          style={{
            marginTop: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          role="listbox"
          aria-label="动作建议"
        >
          {suggestions.map((item) => {
            const isSelected = value === item.text;
            return (
              <div
                key={item.id}
                onClick={() => onChange(item.text)}
                style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  color: isSelected ? '#f59e0b' : '#888',
                  cursor: 'pointer',
                  borderRadius: 2,
                  background: isSelected ? '#f59e0b0d' : 'transparent',
                  border: `1px solid ${isSelected ? '#f59e0b22' : 'transparent'}`,
                }}
                role="option"
                aria-selected={isSelected}
              >
                {item.text}{' '}
                <span style={{ color: '#404040' }}>×{item.use_count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ActionInput;
