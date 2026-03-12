import React, { useState, useEffect, useCallback } from 'react';
import { S, CSS } from '../constants/styles';
import { TASK_LABELS } from '../constants/taskSchemas';
import { listProjects, deleteProject, exportProject, importProject, getStorageStats, getVideosByProject } from '../utils/db';
import { getTotalVideoSize, deleteVideoFile } from '../utils/localFs';

/**
 * 项目管理页面
 * 支持多视频项目，显示所有标注项目
 */
const ProjectsPage = React.memo(function ProjectsPage({ onOpenProject, onCreateNew }) {
  const [projects, setProjects] = useState([]);
  const [projectVideos, setProjectVideos] = useState({}); // 项目ID -> 视频列表
  const [isLoading, setIsLoading] = useState(true);
  const [storageStats, setStorageStats] = useState(null);
  const [videoStats, setVideoStats] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [importError, setImportError] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null); // 展开显示视频列表
  const [dbError, setDbError] = useState(null); // 数据库错误

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const [projectList, storage, videos] = await Promise.all([
        listProjects(),
        getStorageStats(),
        getTotalVideoSize().catch(() => ({ bytes: 0, formatted: '0 B', count: 0 })),
      ]);
      
      setProjects(projectList);
      setStorageStats(storage);
      setVideoStats(videos);

      // 加载每个项目的视频列表
      const videosMap = {};
      for (const project of projectList) {
        const videos = await getVideosByProject(project.id);
        videosMap[project.id] = videos;
      }
      setProjectVideos(videosMap);
    } catch (error) {
      console.error('加载项目列表失败:', error);
      setDbError(error.message || '无法访问本地存储，请检查浏览器权限');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 删除项目
  const handleDelete = async (project) => {
    if (deleteConfirm !== project.id) {
      setDeleteConfirm(project.id);
      return;
    }

    try {
      // 删除所有视频文件
      const videos = projectVideos[project.id] || [];
      for (const video of videos) {
        await deleteVideoFile(video.id);
      }

      await deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('删除项目失败:', error);
      alert('删除失败: ' + error.message);
    }
  };

  // 导出项目
  const handleExport = async (project) => {
    try {
      const data = await exportProject(project.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      // 使用 File System Access API 让用户选择保存位置
      if ('showSaveFilePicker' in window) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const suggestedName = `${project.videoName || 'project'}_${timestamp}.json`;
        
        const fileHandle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'JSON 文件', accept: { 'application/json': ['.json'] } }],
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // 回退到普通下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.videoName || 'project'}_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出项目失败:', error);
      alert('导出失败: ' + error.message);
    }
  };

  // 导入项目
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportError(null);
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await importProject(data);
      await loadProjects();
      
      alert('项目导入成功！');
    } catch (error) {
      console.error('导入项目失败:', error);
      setImportError(error.message);
    }
    
    e.target.value = '';
  };

  // 格式化日期
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // 计算项目持续时间
  const getProjectAge = (createdAt) => {
    if (!createdAt) return '';
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    return `${days} 天前`;
  };

  return (
    <div style={{ ...S.root, minHeight: '100vh' }}>
      <style>{CSS}</style>
      
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '3px', marginBottom: 8, fontWeight: 600 }}>
              VLA ANNOTATION SYSTEM v2.0
            </div>
            <div style={{ fontSize: 24, color: '#333333', fontWeight: 500 }}>
              我的标注项目
            </div>
          </div>
          
          {/* 存储统计 */}
          <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: 10, color: '#666' }}>项目数量</div>
              <div style={{ fontSize: 18, color: '#f59e0b' }}>{projects.length}</div>
            </div>
            {videoStats && (
              <div>
                <div style={{ fontSize: 10, color: '#666' }}>视频文件</div>
                <div style={{ fontSize: 18, color: '#10b981' }}>{videoStats.count}</div>
                <div style={{ fontSize: 10, color: '#444' }}>{videoStats.formatted}</div>
              </div>
            )}
            {storageStats && (
              <div>
                <div style={{ fontSize: 10, color: '#666' }}>存储使用</div>
                <div style={{ fontSize: 18, color: '#60a5fa' }}>{storageStats.percent}%</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '16px 32px', display: 'flex', gap: 12, borderBottom: '1px solid #e5e5e5' }}>
        <button onClick={onCreateNew} style={{ padding: '8px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <span>+</span> 新建项目
        </button>
        
        <label style={{ position: 'relative' }}>
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <span style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 4, fontSize: 13, cursor: 'pointer', display: 'inline-block' }}>
            ↓ 导入项目
          </span>
        </label>

        <button onClick={async () => {
          // 详细存储诊断
          const estimate = await navigator.storage?.estimate?.() || {};
          const videoInfo = await getTotalVideoSize().catch(() => ({ bytes: 0, formatted: '0 B', count: 0 }));
          const allProjects = await listProjects().catch(() => []);
          
          let totalVideoBytes = 0;
          for (const p of allProjects) {
            const vids = await getVideosByProject(p.id).catch(() => []);
            totalVideoBytes += vids.reduce((sum, v) => sum + (v.size || 0), 0);
          }
          
          alert(`存储诊断报告:

总存储空间: ${(estimate.quota / 1024 / 1024).toFixed(2)} MB
已使用: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB (${((estimate.usage / estimate.quota) * 100).toFixed(1)}%)

视频文件:
  - 数量: ${videoInfo.count} 个
  - 大小: ${videoInfo.formatted}
  - IndexedDB 记录: ${(totalVideoBytes / 1024 / 1024).toFixed(2)} MB

项目数量: ${allProjects.length} 个

如果视频被覆盖或标注残留，请尝试:
1. 删除旧项目释放空间
2. 刷新页面后重新导入视频`);
        }} style={{ padding: '8px 16px', background: 'transparent', color: '#666', border: '1px solid #d5d5d5', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>
          🔍 存储诊断
        </button>

        {importError && <div style={{ color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center' }}>导入失败: {importError}</div>}
      </div>

      {/* Database Error */}
      {dbError && (
        <div style={{ 
          margin: '20px 32px', 
          padding: '16px 20px', 
          background: '#fef2f2', 
          border: '1px solid #ef4444', 
          borderRadius: 6,
          color: '#dc2626',
          fontSize: 14 
        }}>
          <strong>⚠️ 数据库访问错误</strong>
          <div style={{ marginTop: 8, color: '#991b1b' }}>{dbError}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#7f1d1d' }}>
            建议：尝试刷新页面，或使用 Chrome/Edge 浏览器的最新版本
          </div>
        </div>
      )}

      {/* Project List */}
      <div style={{ padding: '24px 32px' }}>
        {isLoading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: 60 }}>加载中...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🎬</div>
            <div style={{ color: '#333', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              欢迎使用 VLA 标注工具
            </div>
            <div style={{ color: '#666', fontSize: 14, marginBottom: 32, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
              这是一个用于机器人 VLA（Vision-Language-Action）任务视频的结构化标注工具。
              <br/><br/>
              开始之前，请准备一个视频文件（MP4格式）。
            </div>
            
            {/* 快速开始步骤 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 32, 
              marginBottom: 40,
              flexWrap: 'wrap'
            }}>
              <div style={{ textAlign: 'center', width: 120 }}>
                <div style={{ 
                  width: 48, height: 48, 
                  background: '#f0ede8', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: 20 
                }}>1</div>
                <div style={{ fontSize: 12, color: '#666' }}>创建项目</div>
              </div>
              <div style={{ textAlign: 'center', width: 120 }}>
                <div style={{ 
                  width: 48, height: 48, 
                  background: '#f0ede8', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: 20 
                }}>2</div>
                <div style={{ fontSize: 12, color: '#666' }}>选择视频</div>
              </div>
              <div style={{ textAlign: 'center', width: 120 }}>
                <div style={{ 
                  width: 48, height: 48, 
                  background: '#f0ede8', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: 20 
                }}>3</div>
                <div style={{ fontSize: 12, color: '#666' }}>开始标注</div>
              </div>
            </div>
            
            <button 
              onClick={onCreateNew} 
              style={{ 
                padding: '14px 32px', 
                background: '#f59e0b', 
                color: '#000', 
                border: 'none', 
                borderRadius: 6, 
                fontSize: 16, 
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
              }}
            >
              🚀 创建第一个项目
            </button>
            
            <div style={{ marginTop: 24, fontSize: 12, color: '#999' }}>
              或者 <label style={{ cursor: 'pointer', color: '#f59e0b', textDecoration: 'underline' }}>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  style={{ display: 'none' }} 
                />
                导入已有项目
              </label>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map((project) => {
              const videos = projectVideos[project.id] || [];
              const isExpanded = expandedProject === project.id;
              
              return (
                <div key={project.id} style={{ ...S.card, padding: 16 }}>
                  {/* 项目头部信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* 展开按钮 */}
                    <button 
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                      style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>

                    <div style={{ width: 60, height: 34, background: '#f0ede8', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      🎬
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: '#333333', fontWeight: 500 }}>{project.videoName}</span>
                        <span style={S.pill('#f59e0b')}>{TASK_LABELS[project.taskType]}</span>
                        <span style={{ fontSize: 11, color: '#666', background: '#f0ede8', padding: '3px 8px', borderRadius: 3, fontWeight: 500 }}>
                          {videos.length} 个视频
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888' }}>
                        <span>👤 {project.annotatorId}</span>
                        <span>📍 {project.sceneId}</span>
                        <span>🕒 {formatDate(project.updatedAt)} ({getProjectAge(project.createdAt)})</span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => onOpenProject(project.id)} style={{ padding: '6px 14px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>
                        打开
                      </button>
                      <button onClick={() => handleExport(project)} style={{ ...S.btn(false), padding: '6px 14px' }} title="导出备份">↓</button>
                      <button onClick={() => handleDelete(project)} style={{ padding: '6px 14px', background: deleteConfirm === project.id ? '#ef4444' : 'transparent', color: deleteConfirm === project.id ? '#fff' : '#666', border: '1px solid #333', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}>
                        {deleteConfirm === project.id ? '确认' : '✕'}
                      </button>
                    </div>
                  </div>

                  {/* 展开的视频列表 */}
                  {isExpanded && videos.length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e5e5', marginLeft: 32 }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 500 }}>项目中的视频：</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {videos.map((video, idx) => (
                          <div key={video.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9f7f4', border: '1px solid #e5e5e5', borderRadius: 6 }}>
                            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>视频 {idx + 1}</span>
                            <span style={{ fontSize: 13, color: '#333', flex: 1 }}>{video.name}</span>
                            <span style={{ fontSize: 12, color: '#888' }}>{video.duration?.toFixed(1)}s</span>
                            <span style={{ fontSize: 12, color: '#888' }}>{video.width}x{video.height}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div style={{ padding: '24px 32px', borderTop: '1px solid #e5e5e5', marginTop: 'auto' }}>
        <div style={{ fontSize: 13, color: '#666' }}>
          <strong style={{ color: '#333' }}>提示：</strong>
          所有数据存储在浏览器本地。支持多视频项目，一个项目可包含多个相关视频，共享图结构和动作库。
        </div>
      </div>
    </div>
  );
});

export default ProjectsPage;
