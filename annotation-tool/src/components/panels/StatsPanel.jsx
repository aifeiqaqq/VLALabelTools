import React from 'react';
import { S } from "../../constants/styles";

/**
 * StatsPanel Component
 * Displays annotation statistics (nodes, edges, marks)
 */
const StatsPanel = React.memo(function StatsPanel({ nodeCount, edgeCount, markCount }) {
  const stats = [
    ["节点", nodeCount, "#f59e0b"],
    ["动作边", edgeCount, "#10b981"],
    ["帧实例", markCount, "#60a5fa"]
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {stats.map(([label, value, color]) => (
        <div key={label} style={{ ...S.card, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#444", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, color, fontWeight: 500 }}>{value}</div>
        </div>
      ))}
    </div>
  );
});

export default StatsPanel;
