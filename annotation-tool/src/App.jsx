import React, { useState, useCallback } from 'react';
import ProjectsPage from './pages/ProjectsPage';
import SetupPage from './pages/SetupPage';
import AnnotationPage from './pages/AnnotationPage';
import { useSessionStore } from './stores/sessionStore';
import { useLoadProject } from './hooks/usePersistence';

/**
 * 应用根组件
 * 管理页面路由：项目列表 -> 创建项目/打开项目 -> 标注页面
 */
function App() {
  // 当前视图状态
  const [view, setView] = useState('projects'); // 'projects' | 'setup' | 'annotate'
  const [currentProjectId, setCurrentProjectId] = useState(null);
  
  const started = useSessionStore((s) => s.started);
  const { loadProject, isLoading } = useLoadProject();

  // 创建新项目
  const handleCreateNew = useCallback(() => {
    setView('setup');
  }, []);

  // 打开已有项目
  const handleOpenProject = useCallback(async (projectId) => {
    try {
      await loadProject(projectId);
      setCurrentProjectId(projectId);
      setView('annotate');
    } catch (error) {
      console.error('打开项目失败:', error);
      alert('打开项目失败: ' + error.message);
    }
  }, [loadProject]);

  // 返回项目列表
  const handleBackToProjects = useCallback(() => {
    setView('projects');
    setCurrentProjectId(null);
    // 重置 session 状态
    useSessionStore.setState({ started: false });
  }, []);

  // 新项目创建完成
  const handleProjectCreated = useCallback((projectId) => {
    setCurrentProjectId(projectId);
    setView('annotate');
  }, []);

  // 根据当前视图渲染不同页面
  if (view === 'projects') {
    return (
      <ProjectsPage 
        onOpenProject={handleOpenProject}
        onCreateNew={handleCreateNew}
      />
    );
  }

  if (view === 'setup') {
    return (
      <SetupPage 
        onProjectCreated={handleProjectCreated}
        onCancel={() => setView('projects')}
      />
    );
  }

  if (view === 'annotate') {
    // 正在加载项目数据
    if (isLoading) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0a0a',
          color: '#666',
        }}>
          加载项目中...
        </div>
      );
    }

    // 会话未开始，显示 SetupPage
    if (!started) {
      return (
        <SetupPage 
          onProjectCreated={handleProjectCreated}
          onCancel={handleBackToProjects}
        />
      );
    }

    // 显示标注页面
    return (
      <AnnotationPage 
        projectId={currentProjectId}
        onBack={handleBackToProjects}
      />
    );
  }

  return null;
}

export default React.memo(App);
