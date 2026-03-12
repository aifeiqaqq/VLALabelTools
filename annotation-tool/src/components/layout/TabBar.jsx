import React from 'react';
import { S } from '../../constants/styles';

/**
 * 标签页导航栏组件
 */
const TAB_CONFIG = [
  { key: 'annotate', label: '◉ 标注' },
  { key: 'graph', label: '⬡ 图结构' },
  { key: 'library', label: '⊞ 动作库' },
];

const TabBar = React.memo(function TabBar({ activeTab, onTabChange }) {
  return (
    <div
      style={{
        background: '#fdfcfb',
        borderBottom: '1px solid #e5e5e5',
        padding: '0 16px',
        display: 'flex',
        gap: 4,
      }}
      role="tablist"
      aria-label="主标签页"
    >
      {TAB_CONFIG.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          style={S.tab(activeTab === tab.key)}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`tab-panel-${tab.key}`}
          id={`tab-${tab.key}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
});

export default TabBar;
