# JSON导出格式变更说明

## 变更日期
2026-03-09

## 最近更新
2026-03-09 15:00 - **重大改动**：节点结构增加parent_nodes和video_timestamps字段，图结构现在从parent关系构建
2026-03-09 14:00 - 修复节点导出逻辑：从edges和marks中收集节点，而不仅仅是marks
2026-03-09 - 修复timestamp问题，只导出当前视频中使用的节点

## 变更原因
1. 简化JSON导出格式，减少重复信息，参考标准格式优化数据结构
2. 支持同一节点在不同视频中有不同的parent关系和timestamp
3. 图结构改为由parent_node关系构建，而不是由edges（动作）构建

## 内部数据结构改动（重要！）

### Nodes 新增字段

节点现在包含按视频分组的parent和timestamp信息：

```javascript
{
  node_id: '001',
  state_description: '抽屉关闭',
  node_meta: { drawer_state: 'closed' },
  parent_nodes: {  // 新增：每个视频中的父节点
    'video_1': null,    // 在video_1中是根节点
    'video_2': '003'     // 在video_2中父节点是003
  },
  video_timestamps: {  // 新增：每个视频中的首次标注时间
    'video_1': 0,
    'video_2': 2.5
  }
}
```

**好处**：
1. 同一个节点可以在不同视频中复用（共享state_description和node_meta）
2. 但每个视频中的parent关系和timestamp是独立的
3. 图结构完全由parent_nodes决定，不依赖edges

### Edges 的新角色

**之前**：edges既用于记录动作，也用于构建图结构

**现在**：edges仅用于记录动作描述（process_description），**不再用于构建图结构**

- 图的连接关系完全由节点的 `parent_nodes` 字段决定
- edges 是可选的补充信息，记录状态转换的过程

## 导出格式变更

### 1. Nodes 结构优化

**之前：**
```json
{
  "nodes": [
    {
      "node_id": "001",
      "state_description": "抽屉关闭",
      "node_meta": { ... }
    }
  ]
}
```

**现在：**
```json
{
  "nodes": [
    {
      "node_id": "001",
      "task_type": "drawer",
      "timestamp": 0,
      "state_description": "抽屉关闭",
      "parent_node": null,
      "node_meta": { ... }
    }
  ]
}
```

**新增字段说明：**
- `task_type`: 任务类型（从session复制，方便节点独立使用）
- `timestamp`: 节点在**当前视频**中**首次被标注**的时间戳（秒）
- `parent_node`: 父节点ID（从edges推导），根节点为null

**重要说明：**
- 导出时**包含在当前视频中使用的节点**：
  1. 在edges中出现的节点（from_node_id 或 to_node_id）
  2. 在marks中出现的节点（node_id）
- 如果一个节点在多个视频中被使用，每个视频导出时只包含该视频的相关节点
- timestamp是该节点在当前视频中第一个mark的时间戳（如果没有mark则为0）
- 全局共享的节点在不同视频的导出中可能有不同的timestamp

### 2. Edges 字段重命名

**之前：**
```json
{
  "edges": [
    {
      "edge_id": "xxx",
      "from_node_id": "001",
      "to_node_id": "002",
      "action_description": "opening"
    }
  ]
}
```

**现在：**
```json
{
  "edges": [
    {
      "edge_id": "xxx",
      "from_node_id": "001",
      "to_node_id": "002",
      "process_description": "opening"
    }
  ]
}
```

**变更：** `action_description` → `process_description`（更准确的语义）

### 3. 动作库重命名

**之前：**
```json
{
  "action_library": [...]
}
```

**现在：**
```json
{
  "process_library": [...]
}
```

**变更：** `action_library` → `process_library`（与edges字段统一命名）

### 4. 删除重复数据

**删除的字段：**
- `frame_refs` / `marks` 数组

**原因：**
- 节点的timestamp已经包含了时间信息
- marks 中的其他信息（如thumb）主要用于UI显示，不是核心标注数据
- 减少JSON文件大小和冗余

## 完整示例对比

### 修改前的格式
```json
{
  "version": "1.0",
  "exported_at": "2026-03-09T10:36:39.710Z",
  "session": {
    "annotator_id": "annotator_01",
    "task_type": "drawer",
    "scene_id": "lab_001",
    "video": "task.mp4"
  },
  "statistics": {
    "node_count": 2,
    "edge_count": 1,
    "mark_count": 2
  },
  "nodes": [
    {
      "node_id": "001",
      "state_description": "抽屉关闭",
      "node_meta": {
        "drawer_state": "closed"
      }
    }
  ],
  "edges": [
    {
      "edge_id": "xxx",
      "from_node_id": "001",
      "to_node_id": "002",
      "action_description": "opening"
    }
  ],
  "frame_refs": [
    {
      "node_id": "001",
      "frame_index": 0,
      "timestamp": 0
    }
  ],
  "action_library": [
    {
      "id": "yyy",
      "text": "opening",
      "use_count": 1
    }
  ]
}
```

### 修改后的格式
```json
{
  "version": "1.0",
  "exported_at": "2026-03-09T10:36:39.710Z",
  "session": {
    "annotator_id": "annotator_01",
    "task_type": "drawer",
    "scene_id": "lab_001",
    "video": "task.mp4"
  },
  "statistics": {
    "node_count": 2,
    "edge_count": 1,
    "mark_count": 2
  },
  "nodes": [
    {
      "node_id": "001",
      "task_type": "drawer",
      "timestamp": 0,
      "state_description": "抽屉关闭",
      "parent_node": null,
      "node_meta": {
        "drawer_state": "closed"
      }
    },
    {
      "node_id": "002",
      "task_type": "drawer",
      "timestamp": 2.8,
      "state_description": "抽屉打开",
      "parent_node": "001",
      "node_meta": {
        "drawer_state": "open"
      }
    }
  ],
  "edges": [
    {
      "edge_id": "xxx",
      "from_node_id": "001",
      "to_node_id": "002",
      "process_description": "opening"
    }
  ],
  "process_library": [
    {
      "id": "yyy",
      "text": "opening",
      "use_count": 1,
      "created_by": "annotator_01"
    }
  ]
}
```

## 数据恢复

如果需要从旧格式恢复到新格式，可以使用以下转换规则：

1. **parent_node**: 遍历edges，构建映射 `to_node_id → from_node_id`
2. **timestamp**: 从frame_refs中查找对应node_id的第一个记录
3. **task_type**: 从session.task_type复制
4. **字段重命名**: 简单替换 `action_description` → `process_description`, `action_library` → `process_library`

## 修改文件

- `/home/aifei/LABEL/annotation-tool/src/utils/exportUtils.js`
  - 修改了 `exportJson()` 函数
  - 修改了 `exportJsonToPath()` 函数

## 兼容性

- ✅ 与参考文件格式完全兼容
- ✅ 所有核心标注数据保留
- ✅ 文件体积减小（移除了base64缩略图）
- ✅ 更清晰的层级关系（parent_node字段）

## 使用建议

导出的JSON可以用于：
1. 训练数据集构建
2. 标注质量审核
3. 任务图可视化
4. 数据分析和统计
