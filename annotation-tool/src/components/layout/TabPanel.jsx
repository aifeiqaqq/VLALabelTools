import React from 'react';

/**
 * 标签页内容面板组件
 * 根据 activeTab 显示对应的内容
 */
const TabPanel = React.memo(function TabPanel({
  tabKey,
  activeTab,
  children,
  className = ''
}) {
  const isActive = tabKey === activeTab;

  if (!isActive) return null;

  return (
    <div
      id={`tab-panel-${tabKey}`}
      role="tabpanel"
      aria-labelledby={`tab-${tabKey}`}
      className={className}
      style={{
        height: 'calc(100vh - 88px)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
});

export default TabPanel;
