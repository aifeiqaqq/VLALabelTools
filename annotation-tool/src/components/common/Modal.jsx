import React from 'react';
import { S } from '../../constants/styles';

/**
 * 通用模态框容器组件
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否显示
 * @param {Function} props.onClose - 关闭回调
 * @param {React.ReactNode} props.children - 内容
 * @param {number} props.width - 宽度 (默认 420)
 * @param {string} props.className - 额外类名
 */
const Modal = React.memo(function Modal({
  isOpen,
  onClose,
  children,
  width = 420,
  className = ''
}) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      style={S.modalOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      className={className}
    >
      <div
        style={{
          ...S.modal,
          width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
});

export default Modal;
