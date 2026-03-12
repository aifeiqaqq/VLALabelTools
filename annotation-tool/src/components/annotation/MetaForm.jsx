import React from 'react';
import { S } from '../../constants/styles';

/**
 * 节点元数据表单组件
 * 根据 schema 动态生成表单字段
 * @param {Object} props
 * @param {Object} props.schema - 字段定义 schema {key: {type, label, options, placeholder, required}}
 * @param {Object} props.values - 当前值 {key: value}
 * @param {Function} props.onChange - 值变化回调 (newValues) => void
 */
const MetaForm = React.memo(function MetaForm({ schema, values, onChange }) {
  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div style={{ color: '#444', fontSize: 12, padding: '10px 0' }}>
        当前任务类型无元数据字段
      </div>
    );
  }

  const handleFieldChange = (key, value) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {Object.entries(schema).map(([key, field]) => (
        <div key={key}>
          <div
            style={{
              fontSize: 10,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              marginBottom: 5,
            }}
          >
            {field.label}
            {field.required && <span style={{ color: '#f59e0b' }}> *</span>}
          </div>
          {field.type === 'enum' ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              }}
              role="radiogroup"
              aria-label={field.label}
            >
              {field.options.map((opt) => {
                const isSelected = values[key] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleFieldChange(key, opt)}
                    style={{
                      padding: '4px 11px',
                      fontSize: 12,
                      cursor: 'pointer',
                      borderRadius: 3,
                      fontFamily: 'inherit',
                      border: `1px solid ${isSelected ? '#f59e0b' : '#252525'}`,
                      background: isSelected ? '#f59e0b1a' : 'transparent',
                      color: isSelected ? '#f59e0b' : '#777',
                    }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              value={values[key] || ''}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={field.placeholder}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #d5d5d5',
                color: '#333333',
                padding: '7px 11px',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              aria-required={field.required}
            />
          )}
        </div>
      ))}
    </div>
  );
});

export default MetaForm;
