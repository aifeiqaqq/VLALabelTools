import React, { useRef, useCallback, useState } from 'react';
import { S, CSS } from '../constants/styles';
import { TASK_LABELS } from '../constants/taskSchemas';
import { useSessionStore } from '../stores/sessionStore';
import { useVideoStore } from '../stores/videoStore';
import { useAnnotationStore } from '../stores/annotationStore';
import { saveProject, saveAnnotations } from '../utils/db';
import {
  validateVideoFile,
  filterVideoFiles,
  processSingleVideo
} from '../utils/batchImport';

/**
 * 设置页面组件
 * 用于创建新的标注项目并保存到本地存储
 * 支持多视频项目
 */
const SetupPage = React.memo(function SetupPage({ 
  onProjectCreated,
  onCancel 
}) {
  const fileRef = useRef(null);
  const dirRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [importMode, setImportMode] = useState('single'); // 'single' | 'directory'
  const [validationErrors, setValidationErrors] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null | number (single) | object (batch)
  const [error, setError] = useState(null);

  // Session store
  const annotatorId = useSessionStore((s) => s.annotatorId);
  const taskType = useSessionStore((s) => s.taskType);
  const sceneId = useSessionStore((s) => s.sceneId);
  const setAnnotatorId = useSessionStore((s) => s.setAnnotatorId);
  const setTaskType = useSessionStore((s) => s.setTaskType);
  const setSceneId = useSessionStore((s) => s.setSceneId);
  const startSession = useSessionStore((s) => s.startSession);

  // Video store（新的多视频结构）
  const addVideo = useVideoStore((s) => s.addVideo);
  const switchVideo = useVideoStore((s) => s.switchVideo);
  const setVideoMetadata = useVideoStore((s) => s.setVideoMetadata);

  // Annotation store
  const resetAnnotations = useAnnotationStore((s) => s.resetAnnotations);

  // 处理文件选择
  const handleFileSelect = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      validateVideoFile(file);
      setSelectedFile(file);
      setSelectedFiles([file]); // Also set for consistency
      setImportMode('single');
      setError(null);
      setValidationErrors([]);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // 处理目录选择
  const handleDirectorySelect = useCallback(() => {
    dirRef.current?.click();
  }, []);

  const handleDirectoryChange = useCallback((e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setValidationErrors([]);

    // 过滤和验证视频文件
    const { videoFiles, errors } = filterVideoFiles(files);

    if (videoFiles.length === 0) {
      setError('目录中没有找到视频文件');
      return;
    }

    // 按文件名排序保证一致性
    videoFiles.sort((a, b) => a.name.localeCompare(b.name));

    setSelectedFile(null); // Clear single file selection
    setSelectedFiles(videoFiles);
    setImportMode('directory');

    if (errors.length > 0) {
      setValidationErrors(errors);
    }
  }, []);

  // 创建项目（单文件）
  const handleSingleStart = useCallback(async () => {
    if (!selectedFile || !annotatorId.trim() || !sceneId.trim()) {
      setError('请填写所有必填项');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 生成项目ID
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 1. 创建项目和初始化标注
      setUploadProgress(10);
      await Promise.all([
        saveProject({
          id: projectId,
          annotatorId: annotatorId.trim(),
          taskType,
          sceneId: sceneId.trim(),
          videoName: selectedFile.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        saveAnnotations(projectId, {
          nodes: [],
          edges: {},
          marks: {},
          actionLib: { drawer: [], coffee_machine: [], water: [] },
          lastNodeId: null,
          selectedParentId: null,
        }),
      ]);

      // 2. 处理视频文件
      const result = await processSingleVideo(
        selectedFile,
        projectId,
        1, // 第一个视频
        (loaded, total) => {
          // 进度：10% - 90%
          const percent = 10 + Math.round((loaded / total) * 80);
          setUploadProgress(percent);
        }
      );

      // 3. 设置前端状态
      setUploadProgress(95);
      addVideo({
        id: result.videoId,
        projectId,
        name: selectedFile.name,
        url: result.videoUrl,
        fps: result.metadata.fps,
        totalFrames: result.metadata.totalFrames,
        duration: result.metadata.duration,
      });

      switchVideo(result.videoId);
      setVideoMetadata(result.metadata.fps, result.metadata.totalFrames);
      resetAnnotations();
      startSession();

      setUploadProgress(100);
      onProjectCreated?.(projectId);
    } catch (err) {
      console.error('创建项目失败:', err);
      setError('创建项目失败: ' + (err.message || '未知错误'));
    } finally {
      setIsCreating(false);
    }
  }, [
    selectedFile,
    annotatorId,
    sceneId,
    taskType,
    addVideo,
    switchVideo,
    setVideoMetadata,
    resetAnnotations,
    startSession,
    onProjectCreated,
  ]);

  // 批量导入（目录）
  const handleBatchStart = useCallback(async () => {
    if (selectedFiles.length === 0 || !annotatorId.trim() || !sceneId.trim()) {
      setError('请填写所有必填项');
      return;
    }

    setIsCreating(true);
    setError(null);

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processedVideos = [];
    const failedVideos = [];

    try {
      // 1. 创建项目和初始化标注
      await Promise.all([
        saveProject({
          id: projectId,
          annotatorId: annotatorId.trim(),
          taskType,
          sceneId: sceneId.trim(),
          videoName: `${selectedFiles.length} videos`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        saveAnnotations(projectId, {
          nodes: [],
          edges: {},
          marks: {},
          actionLib: { drawer: [], coffee_machine: [], water: [] },
          lastNodeId: null,
          selectedParentId: null,
        }),
      ]);

      // 2. 顺序处理每个视频
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const videoIndex = i + 1;

        try {
          // 更新进度显示
          setUploadProgress({
            current: videoIndex,
            total: selectedFiles.length,
            fileName: file.name,
            percent: 0,
          });

          // 处理视频
          const result = await processSingleVideo(
            file,
            projectId,
            videoIndex,
            (loaded, total) => {
              // 更新当前文件进度
              const fileProgress = Math.round((loaded / total) * 100);
              setUploadProgress({
                current: videoIndex,
                total: selectedFiles.length,
                fileName: file.name,
                percent: fileProgress,
              });
            }
          );

          // 添加到VideoStore
          addVideo({
            id: result.videoId,
            projectId,
            name: file.name,
            url: result.videoUrl,
            fps: result.metadata.fps,
            totalFrames: result.metadata.totalFrames,
            duration: result.metadata.duration,
          });

          processedVideos.push(result);
        } catch (err) {
          console.error(`Failed to process ${file.name}:`, err);
          failedVideos.push({ file: file.name, error: err.message });
          // 继续处理其他视频
        }
      }

      // 3. 检查是否至少有一个成功
      if (processedVideos.length === 0) {
        throw new Error('所有视频处理失败');
      }

      // 4. 切换到第一个成功导入的视频
      const firstVideo = processedVideos[0];
      switchVideo(firstVideo.videoId);
      setVideoMetadata(firstVideo.metadata.fps, firstVideo.metadata.totalFrames);
      resetAnnotations();
      startSession();

      // 5. 显示导入汇总
      if (failedVideos.length > 0) {
        const summary = `成功导入 ${processedVideos.length} 个视频，${failedVideos.length} 个失败：\n` +
          failedVideos.map(f => `- ${f.file}: ${f.error}`).join('\n');
        alert(summary);
      }

      onProjectCreated?.(projectId);
    } catch (err) {
      console.error('批量导入失败:', err);
      setError('批量导入失败: ' + (err.message || '未知错误'));
    } finally {
      setIsCreating(false);
      setUploadProgress(null);
    }
  }, [
    selectedFiles,
    annotatorId,
    sceneId,
    taskType,
    addVideo,
    switchVideo,
    setVideoMetadata,
    resetAnnotations,
    startSession,
    onProjectCreated,
  ]);

  // 统一的开始处理函数
  const handleStart = useCallback(() => {
    if (importMode === 'directory') {
      return handleBatchStart();
    } else {
      return handleSingleStart();
    }
  }, [importMode, handleBatchStart, handleSingleStart]);

  const canStart = (selectedFile || selectedFiles.length > 0) && annotatorId.trim() && sceneId.trim();

  return (
    <div style={{ ...S.root, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{CSS}</style>
      
      {onCancel && (
        <button onClick={onCancel} style={{ position: 'absolute', top: 24, left: 24, padding: '8px 16px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
          ← 返回项目列表
        </button>
      )}

      <div style={{ ...S.card, padding: 40, width: 460 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '3px', marginBottom: 10 }}>VLA ANNOTATION SYSTEM v2.0</div>
          <div style={{ fontSize: 20, color: '#e0e0e0', fontWeight: 500 }}>新建标注项目</div>
        </div>

        {/* Video File Selection */}
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>视频文件（可后续添加更多）</label>

          {/* Dual Button Layout */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={handleFileSelect}
              disabled={isCreating}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: `1px solid ${importMode === 'single' && selectedFile ? '#f59e0b' : '#2a2a2a'}`,
                borderRadius: 4,
                background: importMode === 'single' && selectedFile ? '#f59e0b08' : '#1a1a1a',
                color: importMode === 'single' && selectedFile ? '#f59e0b' : '#888',
                fontSize: 12,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.5 : 1,
              }}
            >
              📄 选择单个视频
            </button>
            <button
              onClick={handleDirectorySelect}
              disabled={isCreating}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: `1px solid ${importMode === 'directory' ? '#f59e0b' : '#2a2a2a'}`,
                borderRadius: 4,
                background: importMode === 'directory' ? '#f59e0b08' : '#1a1a1a',
                color: importMode === 'directory' ? '#f59e0b' : '#888',
                fontSize: 12,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.5 : 1,
              }}
            >
              📁 选择目录
            </button>
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <input
            ref={dirRef}
            type="file"
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={handleDirectoryChange}
            style={{ display: 'none' }}
          />

          {/* Video Preview List */}
          {selectedFiles.length > 0 && (
            <div style={{
              padding: 12,
              background: '#f9f7f4',
              border: '1px solid #e5e5e5',
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                已选择 {selectedFiles.length} 个视频
              </div>
              <div style={{
                maxHeight: 150,
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 3,
                padding: 8,
              }}>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 11,
                      color: '#333',
                      padding: '4px 0',
                      borderBottom: idx < selectedFiles.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <span style={{ color: '#10b981', marginRight: 6 }}>✓</span>
                    {file.name}
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div style={{
              marginTop: 12,
              padding: 12,
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 500, marginBottom: 6 }}>
                以下文件将被跳过：
              </div>
              <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                {validationErrors.map((err, idx) => (
                  <div key={idx} style={{ fontSize: 11, color: '#92400e', padding: '2px 0' }}>
                    • {err.file}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Annotator & Scene */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={S.label}>标注员 ID *</label>
            <input style={S.input} value={annotatorId} onChange={(e) => setAnnotatorId(e.target.value)} placeholder="annotator_01" disabled={isCreating} />
          </div>
          <div>
            <label style={S.label}>场景 ID *</label>
            <input style={S.input} value={sceneId} onChange={(e) => setSceneId(e.target.value)} placeholder="lab_001" disabled={isCreating} />
          </div>
        </div>

        {/* Task Type */}
        <div style={{ marginBottom: 28 }}>
          <label style={S.label}>任务类型</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TASK_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => !isCreating && setTaskType(key)} style={{ ...S.btn(taskType === key), flex: 1, padding: '9px', opacity: isCreating ? 0.5 : 1 }} disabled={isCreating}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div style={{ padding: '10px 14px', background: '#ef44440d', border: '1px solid #ef444433', borderRadius: 4, marginBottom: 16, fontSize: 12, color: '#ef4444' }}>{error}</div>}

        {/* Progress Display */}
        {isCreating && uploadProgress !== null && (
          <div style={{ marginBottom: 20 }}>
            {typeof uploadProgress === 'object' ? (
              // Batch import progress
              <>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  正在处理视频 {uploadProgress.current} / {uploadProgress.total}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#888',
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {uploadProgress.fileName}
                </div>
                <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress.percent}%`,
                    background: '#f59e0b',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 6, textAlign: 'center' }}>
                  总进度: {Math.round(
                    ((uploadProgress.current - 1) / uploadProgress.total +
                      uploadProgress.percent / 100 / uploadProgress.total) * 100
                  )}%
                </div>
              </>
            ) : (
              // Single file import progress
              <>
                <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${uploadProgress}%`,
                    background: '#f59e0b',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 6, textAlign: 'center' }}>
                  正在保存... {uploadProgress}%
                </div>
              </>
            )}
          </div>
        )}

        {/* Start Button */}
        <button onClick={handleStart} disabled={!canStart || isCreating} style={{ width: '100%', padding: 12, fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 4, cursor: canStart && !isCreating ? 'pointer' : 'not-allowed', background: canStart && !isCreating ? '#f59e0b' : '#161616', color: canStart && !isCreating ? '#000' : '#333' }}>
          {isCreating
            ? (importMode === 'directory' ? '批量导入中...' : '创建中...')
            : '开始标注'
          }
        </button>

        <div style={{ marginTop: 16, fontSize: 11, color: '#555', lineHeight: 1.5 }}>
          支持多视频项目，后续可在项目中添加更多视频。
          <br />
          视频文件将保存在浏览器本地，请定期导出备份。
        </div>
      </div>
    </div>
  );
});

export default SetupPage;
