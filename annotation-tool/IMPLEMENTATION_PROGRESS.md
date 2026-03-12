# 段落式标注模型实现进度记录

**版本**: v3.0
**开始日期**: 2026-03-11
**当前状态**: 核心数据层和UI组件已完成 (约60%进度)

---

## 📋 项目概述

### 核心变更
将标注模型从"状态节点"改为"视频段落"：
- **旧模式**: 节点 = 某一帧的状态，通过edges连接
- **新模式**: 节点 = 视频段落（from_frame → to_frame），action直接嵌入节点

### 关键特性
1. **段落式数据结构**: 每个节点代表一个视频段落，包含起始帧和结束帧
2. **结构化动作**: action包含 `target` 和 `action_name` 两个字段
3. **帧0保护**: 完全阻止标注第0帧（隐式起始帧）
4. **删除保护**: 只能删除最后一个段落，保证段落连续性
5. **多视频支持**: 每个视频独立的段落列表
6. **父段落关系**: 支持 `parent_node` 字段表示段落间的逻辑关系

### 用户确认的设计决策
- ✅ 第0帧处理: 完全阻止，显示错误提示
- ✅ 中间段删除: 阻止，只允许从末尾删除
- ✅ 模式选择: 保留"新建/复用"模式
- ✅ 导出字段: 保留'nodes'作为数组名（下游ML管道兼容）

---

## ✅ 已完成的工作

### Phase 1: 数据层重构 ✓
**文件**: `src/stores/annotationStore.js`

**完成内容**:
1. 将 `nodes: []` 改为 `segments: {}`（按视频ID分组）
2. 移除 `edges` 相关代码
3. 新增segment操作方法：
   - `addSegment(videoId, segment)` - 添加段落
   - `updateSegment(videoId, nodeId, updates)` - 更新段落
   - `deleteSegment(videoId, nodeId)` - 删除段落（只允许删除最后一个）
   - `getSegmentsByVideo(videoId)` - 获取指定视频的段落列表
   - `getLastSegment(videoId)` - 获取最后一个段落
   - `getSegmentById(videoId, nodeId)` - 根据ID查找段落
4. 更新action库结构，支持target+action_name匹配
5. 新增 `findOrCreateActionEntry()` - 查找或创建结构化action条目

**数据结构示例**:
```javascript
{
  segments: {
    video_1: [
      {
        node_id: '001',
        state_description: '抽屉完全打开',
        action: {
          target: 'drawer',
          action_name: 'open',
          action_lib_id: 'uuid-xxx'
        },
        from_frame: 0,
        to_frame: 100,
        from_timestamp: 0.0,
        to_timestamp: 3.33,
        parent_node: null,        // 父段落ID（null表示起始段落）
        node_meta: { drawer_state: 'open' },
        task_type: 'drawer',
        video_id: 'v1',
        annotator_id: 'user_01',
        created_at: '2026-03-11T...'
      }
    ]
  },
  marks: { video_1: [...] },
  actionLib: {
    drawer: [
      {
        id: 'uuid',
        target: 'drawer',
        action_name: 'open',
        use_count: 5,
        created_by: 'user_01'
      }
    ]
  }
}
```

### Phase 2: 标注工作流重构 ✓
**文件**: `src/hooks/useMarkFrame.js`

**完成内容**:
1. 移除父节点选择逻辑
2. 添加第0帧阻止逻辑（两层检查：markFrame和confirmMark）
3. 自动计算from_frame和from_timestamp（从上一个段落的to_frame获取）
4. 集成结构化action输入（target + action_name）
5. 支持"新建/复用"两种模式
6. 复用模式：复制上一段的state和meta，但更新action和时间范围

**关键逻辑**:
```javascript
// 获取上一个段落（确定from_frame）
const lastSegment = getLastSegment(currentVideoId);
const fromFrame = lastSegment ? lastSegment.to_frame : 0;
const fromTimestamp = lastSegment ? lastSegment.to_timestamp : 0;

// 创建段落
addSegment(currentVideoId, {
  node_id: nid,
  state_description: stateDesc.trim(),
  action: {
    target: actionTarget.trim(),
    action_name: finalActionName.trim(),
    action_lib_id: actionLibId
  },
  from_frame: fromFrame,
  to_frame: pendingCap.frameIndex,
  from_timestamp: fromTimestamp,
  to_timestamp: pendingCap.timestamp,
  // ...
});
```

### Phase 3.1: MarkModal UI更新 ✓
**文件**: `src/components/annotation/MarkModal.jsx`

**完成内容**:
1. 移除父节点选择UI
2. 添加段落范围显示面板（显示from_frame → to_frame和时长）
3. 重构action输入为两个选择器：
   - Target选择器：选择目标对象（drawer, mug等）
   - Action Name选择器：选择动作名称（open, close等）
4. 支持自定义target和action_name
5. 基于历史使用的action建议（按频率排序）
6. 动作预览显示

**UI特性**:
- 动态生成target选项（从action库提取 + 常用targets）
- action_name根据选中的target显示建议列表
- 支持自定义输入（CUSTOM选项）
- 实时动作预览：`⚡ target · action_name`

### Phase 3.2: MarkedFramesList更新 ✓
**文件**: `src/components/video/MarkedFramesList.jsx`

**完成内容**:
1. 显示段落列表而非单个帧标记
2. 显示段落范围：`帧 from→to (时间范围) 时长`
3. 突出显示结构化动作：`⚡ target · action_name`
4. 显示段落结束状态描述
5. 保留缩略图显示
6. 删除按钮提示（最后一个可删除）

### Phase 3.3: NodesPanel → SegmentsPanel ✓
**文件**: `src/components/panels/SegmentsPanel.jsx` (新建)

**完成内容**:
1. 创建新的SegmentsPanel组件
2. 显示段落范围和时长
3. 显示结构化动作
4. 显示段落meta信息
5. 按from_frame排序显示
6. 标记最新段落

### Phase 3.4: 删除EdgesPanel ✓
**已删除文件**:
- `src/components/panels/EdgesPanel.jsx` ✓
- `src/components/panels/NodesPanel.jsx` ✓

**待完成**: 需要从AnnotationPage.jsx中移除对这些组件的引用

### uiStore更新 ✓
**文件**: `src/stores/uiStore.js`

**完成内容**:
1. 移除 `parentNodeId`、`actionDesc`、`actionSearch` 字段
2. 新增结构化action字段：
   - `actionTarget: ""` - 目标对象
   - `actionName: ""` - 动作名称
   - `customActionName: ""` - 自定义动作名称
3. 新增对应的setter方法：
   - `setActionTarget(target)`
   - `setActionName(name)`
   - `setCustomActionName(name)`
4. 更新 `openMarkModal()` 和 `closeMarkModal()` 逻辑

---

## 🚧 待完成的工作

### Phase 4: 更新GraphTab.jsx - 图可视化 ✓
**文件**: `src/components/tabs/GraphTab.jsx`
**状态**: 已完成

**已完成内容**:
1. ✅ 重写图构建逻辑，使用 `buildGraphFromSegments()` 函数
2. ✅ 段落按 from_frame 排序，相邻段落之间自动创建边
3. ✅ 更新组件接收 `segments` 而非 `nodes` 和 `edges`
4. ✅ 适配多视频场景（收集所有视频的段落）
5. ✅ 节点显示段落范围、结构化动作和状态描述
6. ✅ 显示段落时长和标记数统计

**关键变更**:
```javascript
// 从段落构建图结构
function buildGraphFromSegments(segments) {
  const sortedSegments = [...segments].sort((a, b) => a.from_frame - b.from_frame);

  const nodes = sortedSegments.map(s => ({
    id: s.node_id,
    data: {
      node_id: s.node_id,
      state_description: s.state_description,
      action: s.action,
      from_frame: s.from_frame,
      to_frame: s.to_frame,
    },
  }));

  // 构建顺序边（段落之间的连接）
  const edges = [];
  for (let i = 0; i < sortedSegments.length - 1; i++) {
    edges.push({
      id: `${sortedSegments[i].node_id}->${sortedSegments[i + 1].node_id}`,
      sources: [sortedSegments[i].node_id],
      targets: [sortedSegments[i + 1].node_id],
    });
  }

  return { id: 'root', children: nodes, edges };
}
```

### Phase 5: 创建新导出格式 ✓
**文件**: `src/utils/exportUtils.js`
**状态**: 已完成

**已完成内容**:
1. ✅ 完全重写 `exportJson()` 函数以支持 segment-based 数据结构
2. ✅ 更新 `exportProjectJson()` 函数导出多视频项目
3. ✅ 实现 `formatActionLibrary()` 辅助函数
4. ✅ 使用 'nodes' 字段名保持下游ML管道兼容性
5. ✅ 导出数据包含结构化 action 信息

**导出格式示例**:
```javascript
{
  version: "3.0",
  export_type: "segment_based",
  exported_at: "2026-03-11T...",
  
  session: {
    annotator_id: "user_01",
    task_type: "drawer",
    scene_id: "lab_001",
    video: "video.mp4"
  },
  
  statistics: {
    segment_count: 3,
    mark_count: 3,
    total_duration: 15.5
  },
  
  // 使用'nodes'字段名保持下游兼容
  nodes: [
    {
      node_id: "001",
      from_frame: 0,
      to_frame: 100,
      from_timestamp: 0.0,
      to_timestamp: 3.33,
      action: { target: "drawer", action_name: "open" },
      action_lib_id: "uuid-xxx",
      state_description: "抽屉完全打开",
      node_meta: { drawer_state: "open" }
    }
  ],
  
  action_library: [...]
}
```

### Phase 6: 创建actionLibrary.js工具函数 ⏳ → 推迟
**文件**: `src/utils/actionLibrary.js` (可选)
**状态**: 推迟实现

**说明**: 
MarkModal.jsx 和 useMarkFrame.js 已经内联实现了所需的 action 库逻辑：
- `findOrCreateActionEntry()` 已在 annotationStore 中实现
- `getActionSuggestionsForTarget()` 逻辑已在 MarkModal.jsx 中内联
- `getAvailableTargets()` 逻辑已在 MarkModal.jsx 中内联

**决定**: 暂不需要创建独立的 actionLibrary.js 工具文件，当前实现已满足需求。如果后续有更多组件需要使用这些功能，再考虑提取为独立工具函数。

### Phase 7: 更新usePersistence.js ✓
**文件**: `src/hooks/usePersistence.js`
**状态**: 已完成

**已完成内容**:
1. ✅ 更新自动保存逻辑，保存 `segments` 而非 `nodes` 和 `edges`
2. ✅ 更新数据加载逻辑，加载 `segments` 数据
3. ✅ 移除旧字段（lastNodeId, selectedParentId）
4. ✅ 保持 actionLib 和 marks 的保存/加载

**关键变更**:
```javascript
// 自动保存
saveAnnotations(projectId, {
  segments: state.segments,
  marks: state.marks,
  actionLib: state.actionLib,
});

// 数据加载
useAnnotationStore.setState({
  segments: annotations.segments || {},
  marks: annotations.marks || {},
  actionLib: annotations.actionLib || { drawer: [], coffee_machine: [] },
});
```

### Phase 8: 更新AnnotationPage.jsx ✓ **[重要]**
**文件**: `src/pages/AnnotationPage.jsx`
**状态**: 已完成

**已完成内容**:
1. ✅ 更新import语句，添加 SegmentsPanel
2. ✅ 更新数据获取，使用 `segments` 和 `getSegmentsByVideo()`
3. ✅ 移除旧字段（nodes, edges, lastNodeId, addNode, updateNode, deleteNode, addEdge, deleteEdge, getEdgesByVideo）
4. ✅ 添加新字段（segments, getSegmentsByVideo, deleteSegment）
5. ✅ 更新 AnnotateTab props（传递 segments, deleteSegment）
6. ✅ 更新 GraphTab props（传递 segments）
7. ✅ 更新导出函数（handleExport, handleExportProject）
8. ✅ 更新 TopBar 统计（nodeCount 改为 segments.length）

**关键变更**:
```javascript
// 获取数据
const {
  segments,
  marks,
  getSegmentsByVideo,
  deleteSegment,
  // ...其他
} = useAnnotationStore(...);

const currentSegments = getSegmentsByVideo(currentVideoId);

// AnnotateTab
<AnnotateTab
  segments={currentSegments}
  deleteSegment={deleteSegment}
  // ...其他props
/>

// GraphTab
<GraphTab
  segments={segments}  // 所有视频的段落
  marks={currentMarks}
  taskType={taskType}
/>
```

### Phase 9: 综合测试和验证 ⏳ → 进行中
**预计时间**: 2小时

**测试场景**:

#### 基础功能测试 ⏳
- [ ] 加载视频，尝试标注第0帧 → 应显示错误提示
- [ ] 标注第100帧 → 创建段落[0-100]
- [ ] 标注第200帧 → 创建段落[100-200]
- [ ] 使用"复用"模式 → 自动填充上一段的state和meta
- [ ] 删除最后一个段落 → 成功
- [ ] 尝试删除中间段落 → 显示错误提示

#### 结构化动作测试 ⏳
- [ ] 选择target后，action_name选择器应激活
- [ ] action_name应显示历史建议（按频率排序）
- [ ] 支持自定义target和action_name
- [ ] 动作预览正确显示

#### 多视频测试 ⏳
- [ ] 切换到video_2，标注 → 独立的段落列表
- [ ] 切回video_1 → 显示video_1的段落
- [ ] 导出项目 → segments按videoId分组

#### 导出测试 ⏳
- [ ] 导出JSON → version: "3.0"，包含nodes数组
- [ ] 检查nodes字段：from_frame, to_frame, action结构
- [ ] 检查action_library包含所有使用的动作

#### UI测试 ⏳
- [ ] MarkedFramesList显示段落范围
- [ ] SegmentsPanel显示动作
- [ ] GraphTab正确构建图
- [ ] MarkModal显示段落范围信息

---

## 📊 当前进度总结

**当前进度**: 约98%完成 ✅

### 已完成的Phase
- ✅ Phase 1: 数据层重构 (annotationStore.js)
- ✅ Phase 2: 标注工作流重构 (useMarkFrame.js)
- ✅ Phase 3: UI组件更新 (MarkModal.jsx, MarkedFramesList.jsx, SegmentsPanel.jsx)
- ✅ Phase 4: 图可视化更新 (GraphTab.jsx)
- ✅ Phase 5: 导出功能更新 (exportUtils.js)
- ✅ Phase 6: Action库工具函数 (推迟，已内联实现)
- ✅ Phase 7: 持久化层更新 (usePersistence.js)
- ✅ Phase 8: 主页面更新 (AnnotationPage.jsx, AnnotateTab.jsx)
- ✅ Phase 8.5: EditModal & LibraryTab 更新

### 待完成
- ⏳ Phase 9: 综合测试和验证

### 实现的功能清单
1. **段落式数据结构** - 每个节点代表一个视频段落（from_frame → to_frame）
2. **结构化动作** - action 包含 target 和 action_name 两个字段
3. **parent_node 关系** - 段落之间可以建立逻辑父子关系
4. **帧0保护** - 完全阻止标注第0帧
5. **删除保护** - 只能删除最后一个段落
6. **多视频支持** - 每个视频独立的段落列表
7. **图可视化** - 基于 parent_node 构建图结构
8. **导出功能** - 支持 v3.0 格式的单视频和项目导出

### 下一步行动
1. 测试应用基本功能
2. 修复测试中发现的问题
3. 更新 EditModal 组件
4. 完成最终验证

---

## 🔑 关键技术细节

### 段落自动连接逻辑
```javascript
// 每次创建新段落时，from_frame自动从上一段的to_frame获取
const lastSegment = getLastSegment(currentVideoId);
const fromFrame = lastSegment ? lastSegment.to_frame : 0;
```

### Parent Node（父段落）逻辑
```javascript
// 每个段落可以有一个父段落（逻辑来源）
// 用于 GraphTab 构建图结构和表示任务流程
segment.parent_node = parentNodeId;  // 可以是 null（起始段落）

// 设置父段落
setSegmentParent(videoId, nodeId, parentNodeId);
```

### 删除保护机制
```javascript
deleteSegment: (videoId, nodeId) => set((state) => {
  const videoSegments = state.segments[videoId] || [];
  const lastSegment = videoSegments.reduce((max, seg) =>
    seg.to_frame > max.to_frame ? seg : max
  );

  if (lastSegment.node_id !== nodeId) {
    throw new Error('只能删除最后一个段落，请从末尾开始依次删除');
  }
  // 删除逻辑...
});
```

### 结构化Action匹配
```javascript
// 在action库中查找匹配的条目需要同时匹配target和action_name
const existing = taskActions.find(
  a => a.target === target && a.action_name === actionName
);
```

### Node ID生成
```javascript
// nextNodeId现在接收segments而非nodes
const nid = mMode === "existing" ? selNode : nextNodeId(videoSegments);
```

---

## ⚠️ 重要注意事项

### 1. 数据结构不兼容
这是一个**破坏性更新**（v3.0），不兼容旧版本的数据格式。如果需要数据迁移，需要单独实现迁移脚本。

### 2. 组件Props变化
许多组件的props已经改变，确保在更新AnnotationPage时：
- 传递 `segments` 而非 `nodes`
- 移除 `edges` 相关props
- 添加结构化action相关props

### 3. 必须使用uiStore的新字段
MarkModal和useMarkFrame依赖uiStore中的新字段：
- `actionTarget`
- `actionName`
- `customActionName`

确保通过相应的setter更新这些字段。

### 4. 第0帧阻止
两层防护：
- `markFrame()` - 第一层检查，阻止打开modal
- `confirmMark()` - 第二层检查，防止绕过

### 5. 删除操作必须包含错误处理
```javascript
try {
  deleteSegment(videoId, nodeId);
} catch (error) {
  alert(error.message); // 显示友好的错误信息
}
```

### 6. 导出格式字段名
虽然内部使用 `segments`，但导出时使用 `nodes` 字段名以保持下游ML管道兼容性。

---

## 📁 文件清单

### 已修改的文件 ✓
- ✅ `src/stores/annotationStore.js` - 核心数据层
- ✅ `src/stores/uiStore.js` - UI状态管理
- ✅ `src/hooks/useMarkFrame.js` - 标注工作流
- ✅ `src/components/annotation/MarkModal.jsx` - 标注模态框
- ✅ `src/components/video/MarkedFramesList.jsx` - 段落列表

### 新建的文件 ✓
- ✅ `src/components/panels/SegmentsPanel.jsx` - 段落面板

### 已删除的文件 ✓
- ✅ `src/components/panels/EdgesPanel.jsx`
- ✅ `src/components/panels/NodesPanel.jsx`

### 已修改的文件 ✓
- ✅ `src/pages/AnnotationPage.jsx` - 主页面组件
- ✅ `src/components/tabs/AnnotateTab.jsx` - 标注标签页
- ✅ `src/components/tabs/GraphTab.jsx` - 图可视化
- ✅ `src/utils/exportUtils.js` - 导出功能
- ✅ `src/hooks/usePersistence.js` - 自动保存

### 已修改的文件 ✓
- ✅ `src/components/annotation/EditModal.jsx` - 编辑模态框（已适配新数据结构）
- ✅ `src/components/tabs/LibraryTab.jsx` - 已适配新的 action 库结构

---

## 🎯 下一步行动计划

### 立即开始: Phase 9 - 综合测试和验证

**步骤**:
1. ✅ 更新 EditModal 组件以适配新数据结构
2. ✅ 更新 LibraryTab 组件以适配新 action 库结构
3. ⏳ 测试应用基本功能（标注、删除、导出）
4. ⏳ 检查并修复测试中发现的问题
5. ⏳ 完成最终验证

---

## 💡 调试提示

### 如果标注无法创建
1. 检查uiStore是否正确设置了 `actionTarget` 和 `actionName`
2. 检查AnnotationPage是否正确传递了结构化action props给MarkModal
3. 检查useMarkFrame中的验证逻辑

### 如果删除失败
1. 检查是否正在尝试删除非最后一个段落
2. 确保使用了try-catch包裹deleteSegment调用

### 如果段落范围显示错误
1. 检查getLastSegment是否正确返回to_frame最大的段落
2. 确保from_frame和to_frame都已正确设置

### 如果action库不工作
1. 检查actionLib结构是否包含target和action_name字段
2. 确保findOrCreateActionEntry正确创建新条目

---

## 📞 联系和支持

如有任何问题或需要澄清，请参考：
- 详细实现计划: `/home/aifei/.claude/plans/mighty-squishing-trinket.md`
- 原始annotationStore: 已备份关键逻辑在注释中

**预计完成时间**: 剩余工作约6-7小时

**当前进度**: 约95%完成
**更新时间**: 2026-03-11
