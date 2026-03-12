# 项目导出格式说明

## 概述

项目级别的JSON导出包含整个项目的所有视频数据，与单视频导出的主要区别：

1. **版本**: `2.0` (单视频为 `1.0`)
2. **导出类型**: `project`
3. **节点的 timestamp 和 parent_node**: 按视频组织成对象形式

## 完整格式示例

```json
{
  "version": "2.0",
  "export_type": "project",
  "exported_at": "2026-03-09T12:00:00.000Z",

  "project": {
    "project_id": "proj_abc123",
    "annotator_id": "annotator_001",
    "task_type": "drawer",
    "scene_id": "001"
  },

  "videos": [
    {
      "video_id": "v1",
      "video_name": "task_001.mp4",
      "fps": 30,
      "total_frames": 900,
      "duration": 30
    },
    {
      "video_id": "v2",
      "video_name": "task_002.mp4",
      "fps": 30,
      "total_frames": 1200,
      "duration": 40
    }
  ],

  "statistics": {
    "video_count": 2,
    "node_count": 3,
    "edge_count": 2,
    "mark_count": 6
  },

  "nodes": [
    {
      "node_id": "001",
      "state_description": "抽屉关闭",
      "node_meta": {
        "drawer_state": "closed"
      },
      "timestamps": {
        "v1": 0,
        "v2": 0
      },
      "parent_nodes": {
        "v1": null,
        "v2": null
      }
    },
    {
      "node_id": "002",
      "state_description": "抽屉半开",
      "node_meta": {
        "drawer_state": "half_open"
      },
      "timestamps": {
        "v1": 2.5,
        "v2": 3.0
      },
      "parent_nodes": {
        "v1": "001",
        "v2": "001"
      }
    },
    {
      "node_id": "003",
      "state_description": "抽屉全开",
      "node_meta": {
        "drawer_state": "fully_open"
      },
      "timestamps": {
        "v1": 5.0,
        "v2": 6.5
      },
      "parent_nodes": {
        "v1": "002",
        "v2": "002"
      }
    }
  ],

  "edges": {
    "v1": [
      {
        "edge_id": "edge_v1_1",
        "from_node_id": "001",
        "to_node_id": "002",
        "process_description": "opening"
      }
    ],
    "v2": [
      {
        "edge_id": "edge_v2_1",
        "from_node_id": "001",
        "to_node_id": "002",
        "process_description": "slowly opening"
      }
    ]
  },

  "marks": {
    "v1": [
      {
        "ref_id": "mark_v1_1",
        "node_id": "001",
        "frame_index": 0,
        "timestamp": 0
      },
      {
        "ref_id": "mark_v1_2",
        "node_id": "002",
        "frame_index": 75,
        "timestamp": 2.5
      },
      {
        "ref_id": "mark_v1_3",
        "node_id": "003",
        "frame_index": 150,
        "timestamp": 5.0
      }
    ],
    "v2": [
      {
        "ref_id": "mark_v2_1",
        "node_id": "001",
        "frame_index": 0,
        "timestamp": 0
      },
      {
        "ref_id": "mark_v2_2",
        "node_id": "002",
        "frame_index": 90,
        "timestamp": 3.0
      },
      {
        "ref_id": "mark_v2_3",
        "node_id": "003",
        "frame_index": 195,
        "timestamp": 6.5
      }
    ]
  },

  "process_library": [
    {
      "text": "opening",
      "useCount": 5
    },
    {
      "text": "closing",
      "useCount": 3
    }
  ]
}
```

## 关键特性

### 1. 多视频支持
- `videos` 数组包含所有视频的元信息
- 每个视频有唯一的 `video_id`

### 2. 节点的跨视频信息

#### timestamps 字段
同一个节点在不同视频中可能有不同的时间戳：
```json
"timestamps": {
  "v1": 0,      // 在第一个视频中 0 秒出现
  "v2": 0       // 在第二个视频中也是 0 秒出现
}
```

#### parent_nodes 字段
同一个节点在不同视频中可能有不同的父节点：
```json
"parent_nodes": {
  "v1": null,   // 在第一个视频中是根节点
  "v2": "003"   // 在第二个视频中父节点是 003
}
```

### 3. 按视频分组的 edges 和 marks

edges 和 marks 都按 `video_id` 分组：
```json
"edges": {
  "v1": [...],
  "v2": [...]
},
"marks": {
  "v1": [...],
  "v2": [...]
}
```

## 使用场景

### 场景 1: 相同任务的多次执行
例如"打开抽屉"任务，在不同视频中：
- 节点（状态）相同：关闭、半开、全开
- 时间戳不同：video_1 可能 2.5 秒到达半开，video_2 可能 3.0 秒
- 父节点关系相同：都是 关闭 → 半开 → 全开

### 场景 2: 同一场景的不同路径
例如同一个房间场景，不同的任务流程：
- 节点（状态）相同：桌上、地上、柜中
- 父节点关系不同：video_1 是 桌上→地上，video_2 是 柜中→地上

### 场景 3: 混合场景
- 部分节点在所有视频中都出现（如初始状态）
- 部分节点只在某些视频中出现
- timestamps 和 parent_nodes 只包含该节点实际出现的视频

## 与单视频导出的对比

| 特性 | 单视频导出 (v1.0) | 项目导出 (v2.0) |
|------|------------------|----------------|
| 版本号 | 1.0 | 2.0 |
| 导出类型 | 单视频 | project |
| 视频信息 | session.video (字符串) | videos (数组) |
| 节点 timestamp | 单个数值 | 按视频的对象 |
| 节点 parent_node | 单个值 | 按视频的对象 |
| edges | 数组 | 按视频分组的对象 |
| marks | 不包含 | 按视频分组的对象 |

## 文件命名

项目导出的文件名格式：
```
project_{scene_id}_{timestamp}.json
```

示例：
```
project_001_2026-03-09_14-30-45.json
```

## 如何使用

在标注页面顶部点击 **📦 导出项目** 按钮即可导出整个项目的JSON文件。

- **↓ 导出视频**: 导出当前视频的数据（单视频格式）
- **📦 导出项目**: 导出整个项目的所有视频数据（项目格式）
- **📊 导出 Graph**: 导出图结构的 SVG 图片
