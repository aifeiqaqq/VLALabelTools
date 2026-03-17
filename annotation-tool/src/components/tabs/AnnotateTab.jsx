import React, { useState, useMemo, useCallback, useEffect } from 'react';
import VideoPlayer from '../video/VideoPlayer';
import VideoControls from '../video/VideoControls';
import MarkedFramesList from '../video/MarkedFramesList';
import StatsPanel from '../panels/StatsPanel';
import SegmentsPanel from '../panels/SegmentsPanel';
import MarkModal from '../annotation/MarkModal';
import EditModal from '../annotation/EditModal';
import RoutePreselector from '../annotation/RoutePreselector';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useMarkFrame } from '../../hooks/useMarkFrame';
import { grabFrame } from '../../utils/videoUtils';
import { useUIStore } from '../../stores/uiStore';
import { useVideoStore } from '../../stores/videoStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAnnotationStore, normalizeParentNode } from '../../stores/annotationStore';
import { TASK_SCHEMAS } from '../../constants/taskSchemas';
import { S } from '../../constants/styles';

/**
 * AnnotateTab - Video Annotation Interface
 * Optimized: All callbacks are stable, minimal re-renders
 */
const AnnotateTab = React.memo(function AnnotateTab({
  // Video refs
  videoRef,
  canvasRef,
  // Video state
  videoUrl,
  videoReady,
  isPlaying,
  currentFrame,
  totalFrames,
  fps,
  // Video handlers
  onLoadedMetadata,
  onTimeUpdate,
  onSeeked,
  onPlay,
  onPause,
  // Controls (optimized API)
  seekFrame,
  seekFrameFast,
  endSeek,
  // Data - unified node model
  nodes,
  allNodes,
  marks,
  // Actions
  deleteNodeVideoSegment,
  currentVideoId,
  actionLibrary,
  addActionToLibrary,
  deleteActionFromLibrary,
  incrementActionUseCount,
}) {
  // Mark frame hook - v2.2: 支持快速模式（无弹窗）
  const { markFrame, confirmMark, isInQuickMode, quickConfirmMark } = useMarkFrame(videoRef, canvasRef);
  
  // 快速模式下的待标注帧数据
  const [quickCapture, setQuickCapture] = useState(null);
  
  // 从 store 获取快速模式相关信息
  const activeRoute = useAnnotationStore((s) => s.activeRoute);
  const routeProgress = useAnnotationStore((s) => s.routeProgress);
  
  // 获取当前快速模式节点信息
  const quickNodeInfo = useMemo(() => {
    if (!isInQuickMode || !activeRoute || !routeProgress) return null;
    const { getNodeById } = useAnnotationStore.getState();
    const currentNodeId = activeRoute.node_sequence[routeProgress.currentIndex];
    const node = getNodeById(currentNodeId);
    return {
      nodeId: currentNodeId,
      node,
      progress: ((routeProgress.currentIndex + 1) / routeProgress.totalNodes) * 100,
      current: routeProgress.currentIndex + 1,
      total: routeProgress.totalNodes
    };
  }, [isInQuickMode, activeRoute, routeProgress]);
  
  // Video store - initial frame (使用 useShallow 避免无限循环)
  const setInitialFrame = useVideoStore((s) => s.setInitialFrame);
  const currentInitialFrame = useVideoStore(
    (s) => s.initialFrames[currentVideoId] ?? 0
  );
  const hasInitialFrame = currentInitialFrame > 0;
  
  // 设置初始帧的简单确认
  const handleSetInitialFrame = () => {
    if (!videoReady) return;
    const confirmed = window.confirm(
      `将第 ${currentFrame} 帧设为初始帧？\n\n后续标注的第一个节点将从这一帧开始。`
    );
    if (confirmed) {
      setInitialFrame(currentVideoId, currentFrame);
    }
  };
  
  // UI Store for modal state
  const {
    showMark,
    closeMarkModal,
    mMode,
    setMarkMode,
    selNode,
    setSelectedNode,
    selectedRouteId,
    setSelectedRouteId,
    stateDesc,
    setStateDesc,
    metaVals,
    setMetaVals,
    actionTarget,
    actionName,
    customActionName,
    setActionTarget,
    setActionName,
    setCustomActionName,
    pendingCap,
    // Edit modal state
    showEdit,
    editMark,
    editDesc,
    editMeta,
    editParentNodeId,
    openEditModal,
    closeEditModal,
    setEditDesc,
    setEditMeta,
    setEditParentNodeId,
    // Quick mark mode state (v2.2)
    preselectedRouteId,
    setPreselectedRouteId,
    clearPreselectedRoute,
  } = useUIStore();

  // Edit modal action editing state (local to AnnotateTab) - 支持多个动作
  const [editActions, setEditActions] = useState([]);

  // Mark modal parent node state (local to AnnotateTab) - 数组格式支持多父节点
  const [markParentNodeId, setMarkParentNodeId] = useState([]);

  const taskType = useSessionStore((s) => s.taskType);
  const taskSchema = TASK_SCHEMAS[taskType];
  const annotatorId = useSessionStore((s) => s.annotatorId);

  // 打开编辑模态框
  const handleOpenEdit = React.useCallback((mark) => {
    const node = nodes.find(n => n.node_id === mark.node_id);
    if (node) {
      // 标准化父节点为数组格式
      const normalizedParents = normalizeParentNode(node.parent_node);
      openEditModal(mark, node.state_description, node.node_meta || {}, normalizedParents);
      // 初始化动作编辑状态（支持多个动作）
      if (node.actions && node.actions.length > 0) {
        setEditActions(node.actions.map(a => ({
          target: a.target,
          actionName: a.action_name,
          customActionName: '',
          customTarget: ''
        })));
      } else {
        setEditActions([]);
      }
    }
  }, [nodes, openEditModal]);

  // 选择路线处理 (v2.2: 支持预选择路由)
  const handleSelectRoute = React.useCallback((routeId) => {
    setSelectedRouteId(routeId);
    setPreselectedRouteId(routeId);
    if (routeId) {
      const { setActiveRoute } = useAnnotationStore.getState();
      setActiveRoute(routeId);
    }
  }, [setSelectedRouteId, setPreselectedRouteId]);

  // 清除预选择路由
  const handleClearRoute = React.useCallback(() => {
    clearPreselectedRoute();
    setSelectedRouteId(null);
    const { resetRouteProgress } = useAnnotationStore.getState();
    resetRouteProgress();
  }, [clearPreselectedRoute, setSelectedRouteId]);

  // 获取所有路由和路由状态 - 订阅 routes 对象本身，避免每次返回新数组
  const routesData = useAnnotationStore((s) => s.routes);
  const routes = useMemo(() => Object.values(routesData).sort((a, b) => a.route_id.localeCompare(b.route_id)), [routesData]);
  // activeRoute 和 routeProgress 已在前面定义用于 quickNodeInfo

  // 确认编辑
  const handleConfirmEdit = React.useCallback(() => {
    if (editMark && editDesc.trim()) {
      // 更新节点信息（通过 annotationStore）
      const { updateNode, setNodeParent, findOrCreateActionEntry, incrementActionUseCount } = useAnnotationStore.getState();
      
      // 处理 actions 数组
      const processedActions = [];
      editActions.forEach(action => {
        if (action.target && action.target.trim()) {
          const finalActionName = action.actionName === 'CUSTOM' ? action.customActionName : action.actionName;
          if (finalActionName && finalActionName.trim()) {
            const actionLibId = findOrCreateActionEntry(
              taskType,
              action.target.trim(),
              finalActionName.trim(),
              annotatorId
            );
            incrementActionUseCount(taskType, actionLibId);
            
            processedActions.push({
              target: action.target.trim(),
              action_name: finalActionName.trim(),
              action_lib_id: actionLibId
            });
          }
        }
      });

      // 构建更新数据
      const updates = {
        state_description: editDesc,
        node_meta: editMeta,
        actions: processedActions
      };

      updateNode(editMark.node_id, updates);

      // 更新父节点关系（按视频）- editParentNodeId 现在是数组格式
      if (editParentNodeId !== undefined && currentVideoId) {
        setNodeParent(editMark.node_id, currentVideoId, editParentNodeId);
      }

      // 清空编辑状态
      setEditActions([]);

      closeEditModal();
    }
  }, [editMark, editDesc, editMeta, editActions, editParentNodeId, currentVideoId, taskType, annotatorId, closeEditModal]);

  // 删除标记
  const handleDeleteMark = React.useCallback((mark) => {
    if (window.confirm('确定要删除这个标记吗？这将删除该帧的标注，但不会删除段落。')) {
      const { deleteMark } = useAnnotationStore.getState();
      deleteMark(currentVideoId, mark.ref_id);
    }
  }, [currentVideoId]);

  // 编辑段落（从段落列表）
  const handleEditSegment = React.useCallback((node) => {
    // 创建一个虚拟的mark对象用于EditModal
    const virtualMark = { node_id: node.node_id };
    // 标准化父节点为数组格式
    const normalizedParents = normalizeParentNode(node.parent_node);
    openEditModal(virtualMark, node.state_description, node.node_meta || {}, normalizedParents);
    // 初始化动作编辑状态（支持多个动作）
    if (node.actions && node.actions.length > 0) {
      setEditActions(node.actions.map(a => ({
        target: a.target,
        actionName: a.action_name,
        customActionName: '',
        customTarget: ''
      })));
    } else {
      setEditActions([]);
    }
  }, [openEditModal]);

  // 删除段落（带错误处理）
  const handleDeleteSegment = React.useCallback((node) => {
    try {
      deleteNodeVideoSegment(node.node_id, currentVideoId);
    } catch (error) {
      alert(error.message);
    }
  }, [deleteNodeVideoSegment, currentVideoId]);

  // 键盘快捷键
  useKeyboardShortcuts({
    enabled: videoReady,
    seekFrame,
    currentFrame,
    markFrame: () => {
      console.log('[键盘快捷键] M键被按下, isInQuickMode:', isInQuickMode);
      // v2.2: 快速模式下，markFrame 只捕获帧，不打开模态框
      if (isInQuickMode) {
        const v = videoRef.current;
        const c = canvasRef.current;
        console.log('[键盘快捷键] 快速模式, videoRef:', !!v, 'canvasRef:', !!c);
        if (!v || !c) {
          console.warn('[键盘快捷键] videoRef 或 canvasRef 为 null');
          return;
        }
        if (currentFrame === 0) {
          alert('第0帧是隐式起始帧，请从第二个关键帧开始标注');
          return;
        }
        v.pause();
        const thumb = grabFrame(v, c);
        setQuickCapture({
          frameIndex: currentFrame,
          timestamp: v.currentTime,
          thumb,
        });
        console.log('[键盘快捷键] 快速模式: 已捕获帧');
      } else {
        console.log('[键盘快捷键] 普通模式: 调用 markFrame()');
        markFrame();
      }
    },
    togglePlay: () => {
      if (isPlaying) {
        videoRef.current?.pause();
      } else {
        videoRef.current?.play();
      }
    },
  });
  
  // v2.2: 快速模式下监听 Enter 键确认标注
  useEffect(() => {
    if (!isInQuickMode) {
      setQuickCapture(null);
      return;
    }
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && quickCapture) {
        e.preventDefault();
        quickConfirmMark(quickCapture);
        setQuickCapture(null);
      } else if (e.key === 'Escape' && quickCapture) {
        e.preventDefault();
        setQuickCapture(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInQuickMode, quickCapture, quickConfirmMark]);

  // MarkModal 动作建议（基于target过滤）
  const actionSuggestions = React.useMemo(() => {
    const lib = actionLibrary?.[taskType] || [];
    if (!actionTarget) return [];
    return lib
      .filter((a) => a.target === actionTarget)
      .sort((a, b) => b.use_count - a.use_count)
      .slice(0, 5);
  }, [actionLibrary, taskType, actionTarget]);

  // 获取可用的targets（从action库中提取）
  const availableTargets = useMemo(() => {
    const lib = actionLibrary?.[taskType] || [];
    const targets = [...new Set(lib.map(a => a.target).filter(Boolean))];
    // 添加常用targets
    const commonTargets = ['drawer', 'red_mug', 'coffee_machine', 'water_tap', 'cabinet', 'plate'];
    return [...new Set([...targets, ...commonTargets])].sort();
  }, [actionLibrary, taskType]);

  // 计算快速模式的起始帧信息 - 使用节点数量作为依赖而非节点数组本身
  const lastSegment = useMemo(() => {
    if (!currentVideoId) return null;
    const { getLastSegment } = useAnnotationStore.getState();
    const { getInitialFrame } = useVideoStore.getState();
    const initialFrame = getInitialFrame(currentVideoId);
    const segment = getLastSegment(currentVideoId);
    if (segment) {
      return segment;
    }
    return initialFrame > 0 ? { to_frame: initialFrame, to_timestamp: initialFrame / (fps || 30) } : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId, nodes?.length, fps]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr minmax(300px, 400px)',
        height: '100%',
        overflow: 'hidden',
        // v2.2: 快速模式下显示橙色边框
        boxSizing: 'border-box',
        border: isInQuickMode ? (quickCapture ? '4px solid #f97316' : '2px solid #f97316') : 'none',
      }}
    >
      {/* v2.2: 快速模式状态提示条 */}
      {isInQuickMode && quickNodeInfo && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: '#f97316',
          color: '#fff',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>
            ⚡ 快速标注模式: {quickNodeInfo.node?.state_description || quickNodeInfo.nodeId}
            {quickNodeInfo.node?.actions?.length > 0 && (
              <span style={{ marginLeft: 8, opacity: 0.9 }}>
                ({quickNodeInfo.node.actions.map(a => `${a.target}·${a.action_name}`).join(', ')})
              </span>
            )}
          </span>
          <span style={{ fontSize: 12 }}>
            {quickCapture ? '按 Enter 确认 | Esc 取消' : `进度: ${quickNodeInfo.current}/${quickNodeInfo.total}`}
          </span>
        </div>
      )}
      
      {/* LEFT: Video + Controls + Marks */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflowY: 'auto',
          borderRight: '1px solid #e5e5e5',
          // v2.2: 快速模式下为顶部状态条留出空间
          paddingTop: isInQuickMode ? '40px' : 0,
        }}
      >
        <VideoPlayer
          videoRef={videoRef}
          canvasRef={canvasRef}
          videoUrl={videoUrl}
          videoReady={videoReady}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onSeeked={onSeeked}
          onPlay={onPlay}
          onPause={onPause}
        />

        {/* v2.2: 路由预选择器 */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
          <RoutePreselector
            routes={routes}
            selectedRouteId={preselectedRouteId}
            onSelectRoute={handleSelectRoute}
            onClearRoute={handleClearRoute}
            activeRoute={activeRoute}
            routeProgress={routeProgress}
            allNodes={allNodes}
          />
        </div>

        <VideoControls
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          fps={fps}
          isPlaying={isPlaying}
          videoReady={videoReady}
          seekFrame={seekFrame}
          seekFrameFast={seekFrameFast}
          endSeek={endSeek}
        />
        
        {/* 标注按钮 */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e5e5' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSetInitialFrame}
              disabled={!videoReady}
              style={{
                ...S.btn(hasInitialFrame),
                flex: 1,
                padding: '10px',
                fontSize: 13,
                opacity: videoReady ? 1 : 0.5,
                ...(hasInitialFrame ? {} : { color: '#666', borderColor: '#d5d5d5' }),
              }}
              title={hasInitialFrame ? `当前初始帧: 第 ${currentInitialFrame} 帧` : '设置第一个节点的起始帧位置'}
            >
              🚩 {hasInitialFrame ? `初始帧: ${currentInitialFrame}` : '设置初始帧'}
            </button>
            <button
              onClick={markFrame}
              disabled={!videoReady}
              style={{
                ...S.btn(true),
                flex: 2,
                padding: '10px',
                fontSize: 13,
                opacity: videoReady ? 1 : 0.5,
              }}
            >
              🎯 标注关键帧 (A)
            </button>
          </div>
          {hasInitialFrame && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#888', textAlign: 'center' }}>
              第一个节点将从第 {currentInitialFrame} 帧开始
            </div>
          )}
        </div>
        
        <MarkedFramesList
          marks={marks}
          nodes={nodes}
          currentFrame={currentFrame}
          seekFrame={seekFrame}
          openEdit={handleOpenEdit}
          onDelete={handleDeleteMark}
        />
      </div>

      {/* RIGHT: Info Panel */}
      <div
        style={{
          overflow: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          // v2.2: 快速模式下为顶部状态条留出空间
          paddingTop: isInQuickMode ? '54px' : 14,
        }}
      >
        <StatsPanel
          nodeCount={allNodes?.length || 0}
          edgeCount={0}
          markCount={marks?.length || 0}
        />
        <SegmentsPanel
          nodes={nodes}
          onEdit={handleEditSegment}
          onDelete={handleDeleteSegment}
        />
      </div>

      <MarkModal
        isOpen={showMark}
        onClose={() => {
          setMarkParentNodeId([]);
          closeMarkModal();
        }}
        pendingCapture={pendingCap}
        mode={mMode}
        onModeChange={setMarkMode}
        nodes={nodes}
        allNodes={allNodes}
        selectedNodeId={selNode}
        onSelectNode={setSelectedNode}
        selectedRouteId={selectedRouteId}
        onSelectRoute={handleSelectRoute}
        stateDescription={stateDesc}
        onStateDescriptionChange={setStateDesc}
        metaValues={metaVals}
        onMetaValuesChange={setMetaVals}
        taskSchema={taskSchema}
        actionLibrary={actionLibrary}
        taskType={taskType}
        parentNodeId={markParentNodeId}
        onParentNodeChange={setMarkParentNodeId}
        onConfirm={(parentNodeId, actions) => {
          confirmMark(parentNodeId, actions);
          setMarkParentNodeId([]);
        }}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={showEdit}
        onClose={closeEditModal}
        editMark={editMark}
        stateDescription={editDesc}
        onStateDescriptionChange={setEditDesc}
        metaValues={editMeta}
        onMetaValuesChange={setEditMeta}
        taskSchema={taskSchema}
        currentVideoId={currentVideoId}
        nodes={nodes}
        parentNodeId={editParentNodeId}
        onParentNodeChange={setEditParentNodeId}
        actions={editActions}
        onActionsChange={setEditActions}
        availableTargets={availableTargets}
        getActionSuggestions={(target) => {
          const lib = actionLibrary?.[taskType] || [];
          if (!target) return [];
          return lib
            .filter((a) => a.target === target)
            .sort((a, b) => b.use_count - a.use_count)
            .map(a => ({
              label: a.action_name,
              value: a.action_name,
              useCount: a.use_count
            }));
        }}
        onConfirm={handleConfirmEdit}
        allNodes={allNodes}
        onSwitchNode={(newNodeId) => {
          // 复用节点：将当前段落关联到已存在的节点
          if (!editMark || !currentVideoId) return;

          const { getNodeById, addOrUpdateNode, deleteNodeVideoSegment } = useAnnotationStore.getState();

          // 1. 获取原节点和目标复用节点
          const oldNode = getNodeById(editMark.node_id);
          const targetNode = getNodeById(newNodeId);

          if (!oldNode || !targetNode) {
            alert('找不到节点信息，无法复用');
            return;
          }

          // 2. 获取当前视频的段落信息
          const oldSegment = oldNode.video_segments?.[currentVideoId];
          if (!oldSegment) {
            alert('找不到当前视频的段落信息');
            return;
          }

          // 3. 确认操作
          const confirmed = window.confirm(
            `确定要将此段落复用为节点 "${newNodeId}"？\n\n` +
            `原节点: ${editMark.node_id}\n` +
            `新节点: ${newNodeId}\n` +
            `状态: ${targetNode.state_description}\n` +
            `动作: ${targetNode.actions?.map(a => `${a.target}·${a.action_name}`).join(', ') || '无'}`
          );

          if (!confirmed) return;

          // 4. 在目标节点中添加当前视频的段落（复用段落信息）
          addOrUpdateNode(newNodeId, currentVideoId, {
            from_frame: oldSegment.from_frame,
            to_frame: oldSegment.to_frame,
            from_timestamp: oldSegment.from_timestamp,
            to_timestamp: oldSegment.to_timestamp,
            parent_node: oldSegment.parent_node,
            actions: targetNode.actions || [],  // 使用目标节点的动作
            state_description: targetNode.state_description,
            node_meta: targetNode.node_meta,
            task_type: targetNode.task_type,
            annotator_id: oldSegment.annotator_id || annotatorId,
            created_at: oldSegment.created_at || new Date().toISOString()
          });

          // 5. 从原节点中删除当前视频的段落
          deleteNodeVideoSegment(editMark.node_id, currentVideoId);

          // 6. 更新所有相关的marks，将node_id改为新的node_id
          const marksInRange = marks.filter(m =>
            m.frame_index >= oldSegment.from_frame &&
            m.frame_index <= oldSegment.to_frame &&
            m.node_id === editMark.node_id
          );

          marksInRange.forEach(mark => {
            const { deleteMark, addMark } = useAnnotationStore.getState();
            deleteMark(currentVideoId, mark.ref_id);
            addMark(currentVideoId, {
              ...mark,
              node_id: newNodeId
            });
          });

          // 7. 关闭模态框
          closeEditModal();
        }}
      />

      {/* v2.2: 快速标注模式已改为无弹窗设计，直接在主界面显示橙色边框提示 */}
    </div>
  );
});

export default AnnotateTab;
