import { grabFrame } from "../utils/videoUtils";
import { nextNodeId } from "../utils/nodeIdGenerator";
import { useSessionStore } from "../stores/sessionStore";
import { useVideoStore } from "../stores/videoStore";
import { useAnnotationStore } from "../stores/annotationStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Mark Frame Hook - Unified Node Model (v4.0)
 * 统一节点模型：一个 node_id 对应多个视频的时间范围
 */
export function useMarkFrame(videoRef, canvasRef) {
  const { annotatorId, taskType } = useSessionStore();
  const { currentFrame, videoReady, currentVideoId, getInitialFrame, fps } = useVideoStore();
  const { getLastSegment, addOrUpdateNode, findOrCreateActionEntry, incrementActionUseCount } = useAnnotationStore();
  const { openMarkModal, closeMarkModal, mMode, selNode, stateDesc, metaVals } = useUIStore();

  const markFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !videoReady || !currentVideoId) return;

    // 阻止标注第0帧
    if (currentFrame === 0) {
      alert('第0帧是隐式起始帧，请从第二个关键帧开始标注');
      return;
    }

    v.pause();
    const thumb = grabFrame(v, c);

    openMarkModal({
      frameIndex: currentFrame,
      timestamp: v.currentTime,
      thumb,
    });
  };

  const confirmMark = (parentNodeId = null, actions = []) => {
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
    if (mMode === "new") {
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
        parent_node: parentNodeId,
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
        parent_node: parentNodeId,
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

    closeMarkModal();
  };

  return { markFrame, confirmMark };
}
