import React from 'react';

/**
 * Button component - Styled button with active/inactive states
 * @param {Object} props
 * @param {boolean} props.active - Whether button is in active state
 * @param {string} props.color - Hex color code (default: "#f59e0b")
 * @param {React.ReactNode} props.children - Button content
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {Object} props.style - Additional styles
 */
const Button = React.memo(function Button({
  active = false,
  color = "#f59e0b",
  children,
  onClick,
  disabled = false,
  style,
  ...rest
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 13px",
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: 3,
        border: `1px solid ${active ? color : "#222"}`,
        background: active ? color + "1a" : "transparent",
        color: active ? color : "#666",
        opacity: disabled ? 0.4 : 1,
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
