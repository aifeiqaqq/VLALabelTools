import { grabFrame } from "../utils/videoUtils";
import { nextNodeId } from "../utils/nodeIdGenerator";
import { useSessionStore } from "../stores/sessionStore";
import { useVideoStore } from "../stores/videoStore";
import { useAnnotationStore } from "../stores/annotationStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Mark Frame Hook - Unified Node Model (v4.0) with Quick Mode (v2.2)
 * 统一节点模型：一个 node_id 对应多个视频的时间范围
 * 支持快速标注模式：预选择路由后一键确认（无弹窗，直接标注）
 */
export function useMarkFrame(videoRef, canvasRef) {
  const { annotatorId, taskType } = useSessionStore();
  const { currentFrame, videoReady, currentVideoId, getInitialFrame, fps } = useVideoStore();
  const { getLastSegment, addOrUpdateNode, findOrCreateActionEntry, incrementActionUseCount, getNodeById, activeRoute, routeProgress, advanceRouteProgress, resetRouteProgress } = useAnnotationStore();
  const { openMarkModal, closeMarkModal, mMode, selNode, stateDesc, metaVals, preselectedRouteId } = useUIStore();

  // 检查是否在快速模式（用于主界面显示橙色边框提示）
  const isInQuickMode = preselectedRouteId && activeRoute && routeProgress;

  const markFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    
    // 调试日志
    console.log('[markFrame] 被调用:', { v: !!v, c: !!c, videoReady, currentVideoId, currentFrame });
    
    if (!v || !c || !videoReady || !currentVideoId) {
      console.warn('[markFrame] 条件不满足，直接返回:', { v: !!v, c: !!c, videoReady, currentVideoId });
      return;
    }

    // 阻止标注第0帧
    if (currentFrame === 0) {
      alert('第0帧是隐式起始帧，请从第二个关键帧开始标注');
      return;
    }

    v.pause();
    const thumb = grabFrame(v, c);

    const capture = {
      frameIndex: currentFrame,
      timestamp: v.currentTime,
      thumb,
    };

    console.log('[markFrame] 打开标注模态框:', capture);
    
    // 普通模式：打开标注模态框
    // v2.2: 快速模式由 AnnotateTab 直接处理
    openMarkModal(capture);
  };

  // 快速确认标注（用于快速模式，无弹窗）
  const quickConfirmMark = (capture) => {
    if (!currentVideoId || !capture) return;

    // 二次验证：阻止标注第0帧
    if (capture.frameIndex === 0) {
      alert('第0帧是隐式起始帧，请从第二个关键帧开始标注');
      return;
    }

    // 确定 from_frame 和 from_timestamp
    const lastSegment = getLastSegment(currentVideoId);
    const initialFrame = getInitialFrame(currentVideoId);
    
    let fromFrame, fromTimestamp;
    if (lastSegment) {
      fromFrame = lastSegment.to_frame;
      fromTimestamp = lastSegment.to_timestamp;
    } else if (initialFrame > 0) {
      fromFrame = initialFrame;
      fromTimestamp = initialFrame / fps;
    } else {
      fromFrame = 0;
      fromTimestamp = 0;
    }

    // 快速模式：使用路由的当前节点
    const currentNodeId = activeRoute.node_sequence[routeProgress.currentIndex];
    const sourceNode = getNodeById(currentNodeId);

    if (!sourceNode) {
      alert(`路由节点 ${currentNodeId} 不存在`);
      return;
    }

    // 自动确定父节点（数组格式）
    let autoParentNodes = [];
    if (routeProgress.currentIndex > 0) {
      autoParentNodes = [activeRoute.node_sequence[routeProgress.currentIndex - 1]];
    }

    // 添加节点段落
    addOrUpdateNode(currentNodeId, currentVideoId, {
      state_description: sourceNode.state_description,
      actions: sourceNode.actions || [],
      from_frame: fromFrame,
      to_frame: capture.frameIndex,
      from_timestamp: fromTimestamp,
      to_timestamp: capture.timestamp,
      parent_node: autoParentNodes,
      node_meta: sourceNode.node_meta || {},
      task_type: taskType,
      annotator_id: annotatorId,
      created_at: new Date().toISOString()
    });

    // 添加帧引用（mark）
    const { addMark } = useAnnotationStore.getState();
    addMark(currentVideoId, {
      ref_id: crypto.randomUUID(),
      frame_index: capture.frameIndex,
      timestamp: capture.timestamp,
      node_id: currentNodeId,
      thumb: capture.thumb,
      video_id: currentVideoId
    });

    // 推进进度或完成路线
    if (routeProgress.currentIndex < activeRoute.node_sequence.length - 1) {
      advanceRouteProgress();
      
      // 显示提示并继续到下一个节点
      setTimeout(() => {
        const nextIndex = routeProgress.currentIndex + 1;
        const nextNodeId = activeRoute.node_sequence[nextIndex];
        const nextNode = getNodeById(nextNodeId);
        console.log(`[快速标注] 已标注 ${currentNodeId}，下一个节点: ${nextNodeId} - ${nextNode?.state_description || ''}`);
      }, 100);
    } else {
      // 路线完成
      alert(`路由 ${activeRoute.route_name} 标注完成！共 ${activeRoute.node_sequence.length} 个节点`);
      resetRouteProgress();
      useUIStore.getState().clearPreselectedRoute();
    }
  };

  const confirmMark = (parentNodeIds = [], actions = []) => {
    if (!currentVideoId) return;

    const pendingCap = useUIStore.getState().pendingCap;
    if (!pendingCap) return;

    // 二次验证：阻止标注第0帧
    if (pendingCap.frameIndex === 0) {
      alert('第0帧是隐式起始帧，请从第二个关键帧开始标注');
      return;
    }

    // 验证必填字段
    if (mMode === "new" && !stateDesc.trim()) {
      alert('请填写状态描述');
      return;
    }
    if (mMode === "existing" && !selNode) {
      alert('请选择要复用的节点');
      return;
    }
    if (mMode === "route" && (!activeRoute || !routeProgress)) {
      alert('路线状态错误,请重新选择路线');
      return;
    }

    // 标准化父节点数组（向后兼容）
    const normalizedParents = Array.isArray(parentNodeIds)
      ? parentNodeIds
      : (parentNodeIds ? [parentNodeIds] : []);

    // 确定 from_frame 和 from_timestamp
    const lastSegment = getLastSegment(currentVideoId);
    const initialFrame = getInitialFrame(currentVideoId);
    
    let fromFrame, fromTimestamp;
    if (lastSegment) {
      // 有上一段：从上一段结束处开始
      fromFrame = lastSegment.to_frame;
      fromTimestamp = lastSegment.to_timestamp;
    } else if (initialFrame > 0) {
      // 无上一段但有初始帧：从初始帧开始
      fromFrame = initialFrame;
      fromTimestamp = initialFrame / fps;
    } else {
      // 默认从第0帧开始
      fromFrame = 0;
      fromTimestamp = 0;
    }

    // 处理 actions 数组
    const processedActions = [];
    actions.forEach(action => {
      if (action.target && action.target.trim() && action.actionName && action.actionName.trim()) {
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

    // 创建或更新节点
    if (mMode === "route") {
      // 路线模式：自动填充所有字段
      const currentNodeId = activeRoute.node_sequence[routeProgress.currentIndex];
      const sourceNode = getNodeById(currentNodeId);

      if (!sourceNode) {
        alert(`路由节点 ${currentNodeId} 不存在`);
        return;
      }

      // 自动确定父节点：前一个节点（数组格式）
      let autoParentNodes = [];
      if (routeProgress.currentIndex > 0) {
        autoParentNodes = [activeRoute.node_sequence[routeProgress.currentIndex - 1]];
      }

      // 添加节点段落（自动填充所有字段）
      addOrUpdateNode(currentNodeId, currentVideoId, {
        state_description: sourceNode.state_description,  // 自动填充
        actions: sourceNode.actions || [],                // 自动填充
        from_frame: fromFrame,
        to_frame: pendingCap.frameIndex,
        from_timestamp: fromTimestamp,
        to_timestamp: pendingCap.timestamp,
        parent_node: autoParentNodes,                     // 自动填充（数组格式）
        node_meta: sourceNode.node_meta || {},            // 自动填充
        task_type: taskType,
        annotator_id: annotatorId,
        created_at: new Date().toISOString()
      });

      // 添加帧引用（mark）
      const { addMark } = useAnnotationStore.getState();
      addMark(currentVideoId, {
        ref_id: crypto.randomUUID(),
        frame_index: pendingCap.frameIndex,
        timestamp: pendingCap.timestamp,
        node_id: currentNodeId,
        thumb: pendingCap.thumb,
        video_id: currentVideoId
      });

      // 推进进度或完成路线
      if (routeProgress.currentIndex < activeRoute.node_sequence.length - 1) {
        advanceRouteProgress();
        // v2.2: 快速模式关闭快速标注模态框，普通模式关闭普通模态框
        if (preselectedRouteId) {
          closeQuickMarkModal();
        } else {
          closeMarkModal();
        }

        // 继续标注下一个节点
        setTimeout(() => {
          markFrame();
        }, 300);
      } else {
        // 路线完成
        alert(`路由 ${activeRoute.route_name} 标注完成！共 ${activeRoute.node_sequence.length} 个节点`);
        resetRouteProgress();
        // v2.2: 快速模式清除预选择状态
        if (preselectedRouteId) {
          useUIStore.getState().clearPreselectedRoute();
          closeQuickMarkModal();
        } else {
          closeMarkModal();
        }
      }

      return; // 路线模式处理完成，直接返回
    } else if (mMode === "new") {
      // 新建模式：生成新的node_id
      const { getAllNodes } = useAnnotationStore.getState();
      const allNodes = getAllNodes();
      const nid = nextNodeId(allNodes);

      addOrUpdateNode(nid, currentVideoId, {
        state_description: stateDesc.trim(),
        actions: processedActions,
        from_frame: fromFrame,
        to_frame: pendingCap.frameIndex,
        from_timestamp: fromTimestamp,
        to_timestamp: pendingCap.timestamp,
        parent_node: normalizedParents,
        node_meta: metaVals,
        task_type: taskType,
        annotator_id: annotatorId,
        created_at: new Date().toISOString()
      });
    } else {
      // 复用模式：使用已有的node_id
      const nid = selNode;

      // 获取源节点的信息
      const { getNodeById } = useAnnotationStore.getState();
      const sourceNode = getNodeById(nid);

      if (!sourceNode) {
        alert('选择的节点不存在');
        return;
      }

      // 复用模式：如果用户没有输入新动作，则复用源节点的动作
      const finalActions = processedActions.length > 0
        ? processedActions
        : (sourceNode.actions || []);

      addOrUpdateNode(nid, currentVideoId, {
        state_description: sourceNode.state_description,
        actions: finalActions,
        from_frame: fromFrame,
        to_frame: pendingCap.frameIndex,
        from_timestamp: fromTimestamp,
        to_timestamp: pendingCap.timestamp,
        parent_node: normalizedParents,
        node_meta: sourceNode.node_meta,
        task_type: taskType,
        annotator_id: annotatorId,
        created_at: new Date().toISOString()
      });
    }

    // 添加帧引用（mark）
    const { addMark } = useAnnotationStore.getState();
    addMark(currentVideoId, {
      ref_id: crypto.randomUUID(),
      frame_index: pendingCap.frameIndex,
      timestamp: pendingCap.timestamp,
      node_id: mMode === "new" ? nextNodeId(useAnnotationStore.getState().getAllNodes()) : selNode,
      thumb: pendingCap.thumb,
      video_id: currentVideoId
    });

    // v2.2: 根据模式关闭对应的模态框
    if (preselectedRouteId && activeRoute) {
      // 快速模式下已经直接处理了，这里不需要关闭模态框
    } else {
      closeMarkModal();
    }
  };

  return { markFrame, confirmMark, isInQuickMode, quickConfirmMark };
}
