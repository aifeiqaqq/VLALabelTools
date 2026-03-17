import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { useUIStore } from "../stores/uiStore";
import { useVideoStore } from "../stores/videoStore";
import { useAnnotationStore } from "../stores/annotationStore";
import SegmentsPanel from "../components/panels/SegmentsPanel";
import { useSessionStore } from "../stores/sessionStore";

import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { usePersistence } from "../hooks/usePersistence";
import { exportJson, exportProjectJson, exportProjectGraphMeta } from "../utils/exportUtils";
import { importNodeLibrary, importRoutes } from "../utils/metaImport";
import { saveVideo, deleteVideo } from "../utils/db";
import { saveVideoFile, extractVideoMetadata, getVideoFile, deleteVideoFile } from "../utils/localFs";
import TopBar from "../components/layout/TopBar";
import TabBar from "../components/layout/TabBar";
import AnnotateTab from "../components/tabs/AnnotateTab";
import GraphTab from "../components/tabs/GraphTab";
import LibraryTab from "../components/tabs/LibraryTab";

/**
 * AnnotationPage - Optimized for Performance
 * 
 * Key optimizations:
 * 1. Minimal Zustand subscriptions (useShallow for arrays/objects)
 * 2. Local state for video playback (via useVideoPlayer hook)
 * 3. Stable callbacks (useCallback)
 * 4. Memoized computations (useMemo)
 * 
 * Architecture:
 * - Video state: Local to useVideoPlayer (currentFrame, isPlaying)
 * - Persistent state: Zustand (nodes, edges, marks)
 * - UI state: Zustand (activeTab)
 */
function AnnotationPage({ projectId, onBack }) {
  // === Refs (stable, no re-renders) ===
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const fileInputRef = useRef(null);

  // === Local state for video upload ===
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadStats, setUploadStats] = useState({ current: 0, total: 0 });

  // === UI Store (primitive selectors - stable) ===
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  // === Session Store (minimal) ===
  const taskType = useSessionStore((s) => s.taskType);
  const annotatorId = useSessionStore((s) => s.annotatorId);
  const sceneId = useSessionStore((s) => s.sceneId);

  // === Video Store (useShallow for object/array state) ===
  const {
    videos,
    currentVideoId,
    setCurrentVideo,
    addVideo,
    updateVideoFile,
    removeVideo,
  } = useVideoStore(
    useShallow((s) => ({
      videos: s.videos,
      currentVideoId: s.currentVideoId,
      setCurrentVideo: s.switchVideo,
      addVideo: s.addVideo,
      updateVideoFile: s.updateVideoFile,
      removeVideo: s.removeVideo,
    }))
  );

  // Memoized current video (stable reference) - 必须先定义
  const currentVideo = useMemo(() => {
    return videos.find((v) => v.id === currentVideoId) || null;
  }, [videos, currentVideoId]);
  
  // 缺失视频检测和重新选择
  const [missingVideoPrompt, setMissingVideoPrompt] = useState(null);
  const missingVideoInputRef = useRef(null);

  // Meta JSON导入
  const metaFileInputRef = useRef(null);

  // 检测当前视频是否文件缺失 (使用 useEffect 因为涉及副作用)
  useEffect(() => {
    if (currentVideo?.fileMissing) {
      setMissingVideoPrompt(currentVideo);
    } else {
      setMissingVideoPrompt(null);
    }
  }, [currentVideo]);
  
  // 处理重新选择视频文件
  const handleReselectVideo = useCallback(async (file) => {
    if (!missingVideoPrompt) return;
    
    const videoId = missingVideoPrompt.id;
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // 保存视频文件到 OPFS
      await saveVideoFile(file, videoId, (loaded, total) => {
        setUploadProgress(Math.round((loaded / total) * 100));
      });
      
      // 提取元数据
      const metadata = await extractVideoMetadata(file);
      
      // 更新视频存储
      const url = URL.createObjectURL(file);
      updateVideoFile(videoId, {
        url,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        fps: metadata.fps,
        totalFrames: metadata.totalFrames,
      });
      
      // 更新数据库
      await saveVideo({
        ...missingVideoPrompt,
        url,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        fps: metadata.fps,
        totalFrames: metadata.totalFrames,
        fileMissing: false,
      });
      
      setMissingVideoPrompt(null);
      console.log('视频文件重新选择成功:', file.name);
    } catch (error) {
      console.error('重新选择视频失败:', error);
      alert('重新选择视频失败: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [missingVideoPrompt, updateVideoFile]);

  // === Annotation Store (useShallow for object state) ===
  const {
    nodes,
    marks,
    actionLib,
    getNodesByVideo,
    getAllNodes,
    getMarksByVideo,
    deleteNodeVideoSegment,
    addActionLibEntry,
    deleteActionLibEntry,
    incrementActionUseCount,
    deleteVideoAnnotations,
  } = useAnnotationStore(
    useShallow((s) => ({
      nodes: s.nodes,
      marks: s.marks,
      actionLib: s.actionLib,
      getNodesByVideo: s.getNodesByVideo,
      getAllNodes: s.getAllNodes,
      getMarksByVideo: s.getMarksByVideo,
      deleteNodeVideoSegment: s.deleteNodeVideoSegment,
      addActionLibEntry: s.addActionLibEntry,
      deleteActionLibEntry: s.deleteActionLibEntry,
      incrementActionUseCount: s.incrementActionUseCount,
      deleteVideoAnnotations: s.deleteVideoAnnotations,
    }))
  );

  // Memoized filtered data for current video (stable references)
  const currentNodes = useMemo(() => 
    currentVideoId ? getNodesByVideo(currentVideoId) : [],
    [currentVideoId, getNodesByVideo, nodes]
  );
  
  // 所有视频的唯一节点（用于复用模式）
  const allNodes = useMemo(() => 
    getAllNodes(),
    [getAllNodes, nodes]
  );
  
  const currentMarks = useMemo(() => 
    currentVideoId ? (marks[currentVideoId] || []) : [],
    [currentVideoId, marks]
  );

  // === Video Player Hook (local state, no Zustand updates per frame) ===
  const {
    currentFrame,
    isPlaying,
    videoReady,
    fps,
    totalFrames,
    seekFrame,
    seekFrameFast,
    endSeek,
    onVideoLoaded,
    onTimeUpdate,
    onSeeked,
    onPlay,
    onPause,
  } = useVideoPlayer(videoRef);

  // === Auto-save Hook ===
  const { lastSaved } = usePersistence(projectId);

  // === Persistence Loading State ===
  // 注意：项目数据已在 App.jsx 的 handleOpenProject 中加载完成
  // 这里只需要等待初始化完成
  const [isInitializing, setIsInitializing] = React.useState(true);
  
  React.useEffect(() => {
    setIsInitializing(false);
  }, []);
  
  const isLoading = isInitializing;

  // === Stable Callbacks ===
  const handleSelectVideo = useCallback((videoId) => {
    setCurrentVideo(videoId);
  }, [setCurrentVideo]);

  // === Export Handler ===
  const handleExport = useCallback(async () => {
    try {
      await exportJson({
        annotatorId,
        taskType,
        sceneId,
        videoName: currentVideo?.name,
        videoId: currentVideoId,
        segments: currentNodes,
        marks: currentMarks,
        actionLib,
      });
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败: ' + error.message);
    }
  }, [annotatorId, taskType, sceneId, currentVideo, currentVideoId, currentNodes, currentMarks, actionLib]);

  // === Export Graph Handler ===
  const handleExportGraph = useCallback(() => {
    try {
      // 获取 SVG 元素
      const svgElement = document.getElementById('graph-svg');
      if (!svgElement) {
        alert('无法找到图形，请先切换到 Graph 标签页');
        return;
      }

      // 克隆 SVG 元素
      const svgClone = svgElement.cloneNode(true);

      // 添加 XML 命名空间
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

      // 序列化为字符串
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      // 创建 Blob
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `graph_${annotatorId}_${sceneId}_${Date.now()}.svg`;

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('图形导出成功');
    } catch (error) {
      console.error('导出图形失败:', error);
      alert('导出图形失败: ' + error.message);
    }
  }, [annotatorId, sceneId]);

  // === Export Project Handler ===
  const handleExportProject = useCallback(async () => {
    try {
      await exportProjectJson({
        projectId,
        annotatorId,
        taskType,
        sceneId,
        videos: videos,
        nodes,
        marks,
        actionLib,
      });
      console.log('项目导出成功');
    } catch (error) {
      console.error('导出项目失败:', error);
      alert('导出项目失败: ' + error.message);
    }
  }, [projectId, annotatorId, taskType, sceneId, videos, nodes, marks, actionLib]);

  // === Export Graph Meta Handler ===
  const handleExportGraphMeta = useCallback(async () => {
    try {
      await exportProjectGraphMeta({
        projectId,
        annotatorId,
        taskType,
        sceneId,
        nodes,
        videos,
      });
      console.log('Graph Meta 导出成功');
    } catch (error) {
      console.error('导出 Graph Meta 失败:', error);
      alert('导出 Graph Meta 失败: ' + error.message);
    }
  }, [projectId, annotatorId, taskType, sceneId, nodes, videos]);

  // === Import Meta JSON Handler ===
  const handleImportMeta = useCallback(async () => {
    metaFileInputRef.current?.click();
  }, []);

  const handleMetaFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Read file
      const text = await file.text();
      const metaData = JSON.parse(text);

      // 2. Import with validation
      const result = importNodeLibrary(
        metaData,
        { taskType, annotatorId },
        nodes
      );

      // 3. Import nodes (skip conflicts in MVP)
      if (result.importCount > 0) {
        useAnnotationStore.getState().importMetaNodes(result.nodesToImport);
      }

      // 4. Import routes
      // 注意：这里使用 result.nodesToImport（即将导入的节点）来验证路由
      // 因为节点已经通过 importMetaNodes 保存到 store，但 nodes 变量还未更新
      const nodesAfterImport = { ...nodes, ...result.nodesToImport };
      const routeResult = importRoutes(metaData, nodesAfterImport);
      if (routeResult.importCount > 0) {
        useAnnotationStore.getState().importMetaRoutes(routeResult.routesToImport);
      }

      // 5. Show result
      let message = `成功导入 ${result.importCount} 个节点！`;

      if (routeResult.importCount > 0) {
        message += `\n成功导入 ${routeResult.importCount} 个路线！`;
      }

      if (result.skipCount > 0) {
        message += `\n\n跳过 ${result.skipCount} 个冲突节点：\n`;
        message += result.conflicts.map(c =>
          `• ${c.nodeId}: "${c.existing}"`
        ).join('\n');
      }

      if (routeResult.warnings.length > 0) {
        message += `\n\n⚠️ 路线警告：\n`;
        message += routeResult.warnings.map(w =>
          `• ${w.routeName}: ${w.message}`
        ).join('\n');
      }

      message += '\n\n💡 提示：导入的节点可在标注时通过"复用现有节点"使用，路线可通过"复用路由"使用。';

      alert(message);

    } catch (error) {
      console.error('Meta import failed:', error);
      alert('导入失败：' + error.message);
    }

    e.target.value = '';
  }, [taskType, annotatorId, nodes]);

  // === Add Video Handler ===
  const handleAddVideo = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    if (videoFiles.length === 0) {
      alert('请选择视频文件');
      return;
    }

    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    const oversizedFiles = videoFiles.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`以下文件过大（>2GB），将被跳过：\n${oversizedFiles.map(f => f.name).join('\n')}`);
    }

    const validFiles = videoFiles.filter(f => f.size <= maxSize);
    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadStats({ current: 0, total: validFiles.length });

    let lastUploadedVideoId = null;
    const failedFiles = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadingFileName(file.name);
        setUploadStats({ current: i + 1, total: validFiles.length });
        setUploadProgress(0);

        try {
          // Generate unique video ID - 使用时间戳+随机数确保唯一
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substr(2, 9);
          const videoId = `v${timestamp}_${randomSuffix}`;

          // 1. Save video file to OPFS
          setUploadProgress(10);
          await saveVideoFile(file, videoId, (loaded, total) => {
            const percent = 10 + Math.round((loaded / total) * 60);
            setUploadProgress(percent);
          });

          // 2. Extract metadata
          setUploadProgress(70);
          const metadata = await extractVideoMetadata(file);
          const fps = 30;
          const totalFrames = Math.floor(metadata.duration * fps);

          // 3. Save to IndexedDB
          setUploadProgress(80);
          await saveVideo({
            id: videoId,
            projectId,
            name: file.name,
            fps,
            totalFrames,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            createdAt: new Date().toISOString(),
          });

          // 4. Add to video store
          setUploadProgress(90);
          const videoUrl = URL.createObjectURL(file);
          addVideo({
            id: videoId,
            projectId,
            name: file.name,
            url: videoUrl,
            fps,
            totalFrames,
            duration: metadata.duration,
          });

          lastUploadedVideoId = videoId;
          setUploadProgress(100);

          console.log(`视频上传成功 (${i + 1}/${validFiles.length}):`, file.name);
        } catch (error) {
          console.error(`视频上传失败 (${i + 1}/${validFiles.length}):`, file.name, error);
          failedFiles.push({ name: file.name, error: error.message });
        }
      }

      // Switch to last uploaded video
      if (lastUploadedVideoId) {
        setCurrentVideo(lastUploadedVideoId);
      }

      // Show summary
      if (failedFiles.length > 0) {
        alert(`批量上传完成！\n\n成功: ${validFiles.length - failedFiles.length} 个\n失败: ${failedFiles.length} 个\n\n失败文件:\n${failedFiles.map(f => `• ${f.name}: ${f.error}`).join('\n')}`);
      } else {
        alert(`批量上传完成！成功上传 ${validFiles.length} 个视频。`);
      }
    } catch (error) {
      console.error('批量上传出错:', error);
      alert('批量上传出错: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
      setUploadStats({ current: 0, total: 0 });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [projectId, addVideo, setCurrentVideo]);

  // === Delete Video Handler ===
  const handleDeleteVideo = useCallback(async (videoId) => {
    if (!videoId) return;
    
    try {
      // 1. 释放 Blob URL 避免内存泄漏
      const videoToDelete = videos.find(v => v.id === videoId);
      if (videoToDelete?.url) {
        URL.revokeObjectURL(videoToDelete.url);
      }
      
      // 2. 从 IndexedDB 删除视频记录
      await deleteVideo(videoId);
      
      // 3. 从 OPFS 删除视频文件
      try {
        await deleteVideoFile(videoId);
      } catch (fileErr) {
        // 文件可能已不存在，忽略错误
        console.warn('删除视频文件失败:', fileErr);
      }
      
      // 4. 删除该视频的所有标注数据
      deleteVideoAnnotations(videoId);
      
      // 5. 从 store 中移除视频
      removeVideo(videoId);
      
      console.log('视频及其标注数据删除成功:', videoId);
    } catch (error) {
      console.error('删除视频失败:', error);
      alert('删除视频失败: ' + error.message);
    }
  }, [removeVideo, deleteVideoAnnotations, videos]);

  // === Render Tab Content ===
  const renderTabContent = () => {
    switch (activeTab) {
      case "annotate":
        return (
          <AnnotateTab
            videoUrl={currentVideo?.url}
            videoRef={videoRef}
            canvasRef={canvasRef}
            currentFrame={currentFrame}
            totalFrames={totalFrames || currentVideo?.totalFrames || 0}
            fps={fps || currentVideo?.fps || 30}
            isPlaying={isPlaying}
            videoReady={videoReady}
            nodes={currentNodes}
            allNodes={allNodes}
            marks={currentMarks}
            onLoadedMetadata={onVideoLoaded}
            onTimeUpdate={onTimeUpdate}
            onSeeked={onSeeked}
            onPlay={onPlay}
            onPause={onPause}
            seekFrame={seekFrame}
            seekFrameFast={seekFrameFast}
            endSeek={endSeek}
            deleteNodeVideoSegment={deleteNodeVideoSegment}
            currentVideoId={currentVideoId}
            actionLibrary={actionLib}
            addActionToLibrary={addActionLibEntry}
            deleteActionFromLibrary={deleteActionLibEntry}
            incrementActionUseCount={incrementActionUseCount}
          />
        );
      case "graph":
        return (
          <GraphTab
            nodes={nodes}
            marks={currentMarks}
            taskType={taskType}
          />
        );
      case "library":
        return (
          <LibraryTab
            taskType={taskType}
            actionLib={actionLib}
            searchValue=""
            onSearchChange={() => {}}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#faf8f5",
        color: "#333333",
        fontSize: 14
      }}>
        加载项目中...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#faf8f5'
    }}>
      {/* Hidden file input for video upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <input
        ref={metaFileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleMetaFileChange}
        style={{ display: 'none' }}
      />

      <TopBar
        taskType={taskType}
        videoName={currentVideo?.name}
        annotatorId={annotatorId}
        nodeCount={allNodes.length}
        edgeCount={0}
        markCount={currentMarks.length}
        onExport={handleExport}
        onExportGraph={handleExportGraph}
        onExportProject={handleExportProject}
        onExportGraphMeta={handleExportGraphMeta}
        onImportMeta={handleImportMeta}
        videos={videos}
        currentVideoId={currentVideoId}
        onVideoChange={handleSelectVideo}
        onBack={onBack}
        onAddVideo={handleAddVideo}
        onDeleteVideo={handleDeleteVideo}
      />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* 缺失视频提示 */}
        {missingVideoPrompt && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(250, 248, 245, 0.98)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            gap: 20,
            padding: 40
          }}>
            <div style={{ fontSize: 48 }}>📹</div>
            <div style={{ fontSize: 18, color: '#333', fontWeight: 600 }}>
              需要重新选择视频文件
            </div>
            <div style={{ fontSize: 14, color: '#666', textAlign: 'center', maxWidth: 400 }}>
              当前视频 "{missingVideoPrompt.name}" 的文件未找到。<br/>
              这可能是从其他设备导入的项目，请重新选择对应的视频文件。
            </div>
            <input
              ref={missingVideoInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReselectVideo(file);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => missingVideoInputRef.current?.click()}
              style={{
                padding: '12px 24px',
                background: '#f59e0b',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              选择视频文件
            </button>
          </div>
        )}
        
        {isUploading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(250, 248, 245, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            gap: 16
          }}>
            <div style={{ fontSize: 14, color: '#333', fontWeight: 500 }}>
              上传视频中...
            </div>
            {uploadStats.total > 1 && (
              <div style={{ fontSize: 13, color: '#666', marginTop: -8 }}>
                第 {uploadStats.current} / {uploadStats.total} 个
              </div>
            )}
            {uploadingFileName && (
              <div style={{
                fontSize: 12,
                color: '#888',
                maxWidth: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'center'
              }}>
                {uploadingFileName}
              </div>
            )}
            <div style={{
              width: 300,
              height: 8,
              background: '#e5e5e5',
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: '#f59e0b',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {uploadProgress}%
            </div>
          </div>
        )}
        {renderTabContent()}
      </div>
    </div>
  );
}

export default React.memo(AnnotationPage);
