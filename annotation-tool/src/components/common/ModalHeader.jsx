import React from 'react';
import { S } from '../../constants/styles';

/**
 * 模态框头部组件
 * @param {Object} props
 * @param {React.ReactNode} props.children - 标题内容
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.highlightText - 需要高亮的文本
 * @param {string} props.secondaryText - 次要文本（灰色）
 */
const ModalHeader = React.memo(function ModalHeader({
  children,
  onClose,
  highlightText,
  secondaryText
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, color: '#d0d0d0' }}>
        {children}
        {highlightText && (
          <span style={{ color: '#f59e0b' }}>{highlightText}</span>
        )}
        {secondaryText && (
          <span style={{ color: '#444', marginLeft: 8 }}>{secondaryText}</span>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            ...S.btn(false),
            fontSize: 16,
            lineHeight: 1,
          }}
          aria-label="关闭"
        >
          ✕
        </button>
      )}
    </div>
  );
});

export default ModalHeader;
