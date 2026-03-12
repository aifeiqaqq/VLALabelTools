import React from 'react';

/**
 * Pill component - Small colored badge/tag
 * @param {Object} props
 * @param {string} props.color - Hex color code (e.g., "#f59e0b")
 * @param {React.ReactNode} props.children - Content to display
 * @param {Object} props.style - Additional styles
 */
const Pill = React.memo(function Pill({ color, children, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 11,
        background: color + "1a",
        color: color,
        border: `1px solid ${color}33`,
        ...style
      }}
    >
      {children}
    </span>
  );
});

export default Pill;
