import React from 'react';
import TopBar from './TopBar';
import TabBar from './TabBar';

/**
 * Layout Component
 * Provides consistent layout with TopBar, TabBar, and content area
 */
const Layout = React.memo(function Layout({ 
  activeTab, 
  setActiveTab, 
  children 
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#faf8f5'
    }}>
      <TopBar />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={{ 
        flex: 1, 
        overflow: 'hidden',
        position: 'relative'
      }}>
        {children}
      </div>
    </div>
  );
});

export default Layout;
