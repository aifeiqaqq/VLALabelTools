import React from 'react';
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
  onAddVideo
}) {
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
      {videos.length > 1 ? (
        <select
          value={currentVideoId || ''}
          onChange={(e) => onVideoChange && onVideoChange(e.target.value)}
          style={{
            fontSize: 12,
            color: '#333',
            background: '#ffffff',
            border: '1px solid #d5d5d5',
            borderRadius: 4,
            padding: '4px 8px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            maxWidth: 220,
          }}
        >
          {videos.map((v, i) => (
            <option key={v.id} value={v.id}>
              视频 {i + 1}: {v.name}
            </option>
          ))}
        </select>
      ) : (
        <span
          style={{
            fontSize: 12,
            color: '#888888',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={videoName}
        >
          {videoName}
        </span>
      )}

      {/* Add Video Button */}
      {onAddVideo && (
        <button
          onClick={onAddVideo}
          style={{
            ...S.btn(false),
            padding: '6px 12px',
            fontSize: 12,
            color: '#8b5cf6',
            borderColor: '#8b5cf633',
          }}
          aria-label="添加视频"
        >
          ➕ 添加视频
        </button>
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
