import React, { useState, useRef, useEffect } from 'react';
import { S } from '../../constants/styles';
import { TASK_LABELS } from '../../constants/taskSchemas';

/**
 * 顶部导航栏组件
 * 显示系统标识、当前任务信息、统计和导出按钮
 */
const TopBar = React.memo(function TopBar({
  taskType,
  videoName,
  annotatorId,
  nodeCount,
  edgeCount,
  markCount,
  onExport,
  onExportGraph,
  onExportProject,
  onExportGraphMeta,
  videos = [],
  currentVideoId,
  onVideoChange,
  onBack,
  onAddVideo,
  onDeleteVideo
}) {
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const menuRef = useRef(null);
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowVideoMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleDelete = (videoId, videoName) => {
    if (window.confirm(`确定要删除视频 "${videoName}" 吗？\n\n此操作不可恢复，但已有的标注数据会保留。`)) {
      onDeleteVideo?.(videoId);
    }
    setShowVideoMenu(false);
  };
  return (
    <div
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e5e5',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      {/* Back Button */}
      {onBack && (
        <>
          <button
            onClick={onBack}
            style={{
              ...S.btn(false),
              padding: '6px 12px',
              fontSize: 12,
              color: '#666',
              borderColor: '#d5d5d5',
            }}
            aria-label="返回项目列表"
          >
            ← 返回
          </button>
          <div style={{ width: 1, height: 16, background: '#e5e5e5' }} />
        </>
      )}

      {/* Logo */}
      <span style={{ fontSize: 11, color: '#f59e0b', letterSpacing: '2.5px', fontWeight: 600 }}>
        VLA ANNOTATOR
      </span>

      <div style={{ width: 1, height: 16, background: '#e5e5e5' }} />

      {/* Task Type Badge */}
      <span style={S.pill('#f59e0b')}>{TASK_LABELS[taskType] || '未选择'}</span>

      {/* Video Switcher / Name */}
      {videos.length > 0 ? (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowVideoMenu(!showVideoMenu)}
            style={{
              ...S.btn(false),
              padding: '6px 12px',
              fontSize: 12,
              color: '#333',
              borderColor: '#d5d5d5',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 220,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              视频 ({videos.length}) {videoName}
            </span>
            <span style={{ fontSize: 10 }}>{showVideoMenu ? '▲' : '▼'}</span>
          </button>
          
          {showVideoMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#ffffff',
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: 280,
              maxWidth: 350,
              maxHeight: 400,
              overflow: 'auto',
              zIndex: 1000,
            }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>项目中的视频</span>
              </div>
              {videos.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f5f5f5',
                    background: v.id === currentVideoId ? '#f9f7f4' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onVideoChange?.(v.id);
                    setShowVideoMenu(false);
                  }}
                >
                  <span style={{ fontSize: 11, color: '#888', width: 50 }}>视频 {i + 1}</span>
                  <span style={{
                    fontSize: 12,
                    color: v.id === currentVideoId ? '#f59e0b' : '#333',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: v.id === currentVideoId ? 500 : 400,
                  }} title={v.name}>
                    {v.name}
                  </span>
                  {videos.length > 1 && onDeleteVideo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(v.id, v.name);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        color: '#ef4444',
                        background: 'transparent',
                        border: '1px solid #ef444433',
                        borderRadius: 4,
                        cursor: 'pointer',
                        marginLeft: 8,
                      }}
                      title="删除视频"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
              {onAddVideo && (
                <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
                  <button
                    onClick={() => {
                      onAddVideo();
                      setShowVideoMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#8b5cf6',
                      background: '#f9f7f4',
                      border: '1px dashed #8b5cf699',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    ➕ 添加新视频
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: '#888888' }}>没有视频</span>
      )}

      {/* Annotator */}
      <span style={{ fontSize: 12, color: '#888888' }}>@{annotatorId}</span>

      <div style={{ flex: 1 }} />

      {/* Stats */}
      <span style={{ fontSize: 12, color: '#666666' }}>
        <span style={{ color: '#333333', fontWeight: 500 }}>{nodeCount}</span> 节点 ·{' '}
        <span style={{ color: '#333333', fontWeight: 500 }}>{edgeCount}</span> 边 ·{' '}
        <span style={{ color: '#333333', fontWeight: 500 }}>{markCount}</span> 帧标记
      </span>

      {/* Export Buttons */}
      <button
        onClick={onExport}
        style={{
          ...S.btn(false),
          color: '#10b981',
          borderColor: '#10b98133',
        }}
        aria-label="导出当前视频JSON"
        title="导出当前视频的标注数据"
      >
        ↓ 导出视频
      </button>

      {onExportProject && (
        <button
          onClick={onExportProject}
          style={{
            ...S.btn(false),
            color: '#f59e0b',
            borderColor: '#f59e0b33',
            fontWeight: 600,
          }}
          aria-label="导出详细版JSON"
          title="导出整个项目的详细数据"
        >
          📦 详细版 JSON
        </button>
      )}

      {onExportGraphMeta && (
        <button
          onClick={onExportGraphMeta}
          style={{
            ...S.btn(false),
            color: '#8b5cf6',
            borderColor: '#8b5cf633',
          }}
          aria-label="导出Graph Meta"
          title="导出简化的节点关系图"
        >
          🌐 Graph Meta
        </button>
      )}

      <button
        onClick={onExportGraph}
        style={{
          ...S.btn(false),
          color: '#8b5cf6',
          borderColor: '#8b5cf633',
        }}
        aria-label="导出Graph图片"
      >
        📊 导出 Graph
      </button>
    </div>
  );
});

export default TopBar;
