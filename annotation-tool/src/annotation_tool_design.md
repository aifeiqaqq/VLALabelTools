# VLA Task Graph 打标工具 — 完整设计文档

> 面向 Claude Code 的实现规格，版本 v1.0

---

## 1. 项目概述

### 1.1 背景

本工具用于对机器人 VLA（Vision-Language-Action）任务视频进行结构化标注。标注员通过观看视频，提取关键帧，将其定义为抽象状态节点，并在节点间标注动作，最终构建一张有向无环图（DAG），表达一类任务的完整执行结构。

### 1.2 核心概念

```
节点（StateNode）= 抽象状态定义，可跨视频复用
边（ActionEdge） = 两状态之间的动作，属于具体视频
关键帧（FrameRef）= 某个节点在某条视频中的帧实例

示例（拉抽屉放东西任务）：

001[抽屉关闭，手空] ──[右手握把手向外拉]──► 002[抽屉半开，手持把手]
                                              │
                                     [松手，拿起方块]
                                              ▼
                                    003[抽屉半开，手持方块]
                                              │
                                     [将方块放入抽屉]
                                              ▼
                                    004[抽屉半开，方块在内，手空]
```

### 1.3 技术栈

```
后端：Python 3.11+，FastAPI，SQLite（SQLAlchemy ORM）
前端：React + TypeScript，Tailwind CSS，ReactFlow（图可视化）
视频处理：OpenCV（帧提取），ffmpeg（元数据读取）
打包：桌面端用 Electron（可选），或纯 Web 部署
```

---

## 2. 数据模型

### 2.1 完整 Schema

```python
# models.py

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# ─────────────────────────────────────────
# 视频级元数据
# ─────────────────────────────────────────
@dataclass
class VideoRecord:
    video_id: str                   # UUID，自动生成
    file_path: str                  # 本地绝对路径
    task_type: str                  # "drawer" | "coffee_machine" | ...
    scene_id: str                   # "lab_001"，自由文本
    annotator_id: str               # 标注员 ID
    total_frames: int               # 由 OpenCV 读取
    fps: float                      # 由 OpenCV 读取
    duration_seconds: float         # 由 OpenCV 读取
    created_at: datetime
    status: str                     # "pending" | "in_progress" | "submitted"

# ─────────────────────────────────────────
# 抽象状态节点（跨视频复用）
# ─────────────────────────────────────────
@dataclass
class StateNode:
    node_id: str                    # "001", "002", "003"（三位数字，自增）
    task_type: str                  # 所属任务类型，不跨任务复用
    state_description: str          # 状态文字描述，自由文本
    node_meta: Dict[str, Any]       # node 级 task_meta（见 2.2）
    source_frames: List["FrameRef"] # 挂载的所有帧实例
    annotator_id: str               # 创建者
    created_at: datetime
    updated_at: datetime

@dataclass
class FrameRef:
    ref_id: str                     # UUID
    node_id: str                    # 所属节点
    video_id: str
    frame_index: int                # 帧号（从 0 开始）
    timestamp: float                # 秒数，由帧号/fps 计算

# ─────────────────────────────────────────
# 动作边
# ─────────────────────────────────────────
@dataclass
class ActionEdge:
    edge_id: str                    # UUID
    task_type: str
    from_node_id: str               # "001"
    to_node_id: str                 # "002"
    action_description: str         # 来自预设库或新建
    action_lib_id: Optional[str]    # 若来自预设库，记录对应 ID
    source_video_id: str            # 来源视频
    annotator_id: str
    created_at: datetime

# ─────────────────────────────────────────
# 动作预设库
# ─────────────────────────────────────────
@dataclass
class ActionLibEntry:
    action_lib_id: str              # UUID
    task_type: str
    text: str                       # 动作描述文本
    use_count: int                  # 使用次数
    created_by: str                 # 首次创建的标注员
    created_at: datetime
    updated_at: datetime

# ─────────────────────────────────────────
# 操作历史（支持回溯/Undo）
# ─────────────────────────────────────────
@dataclass
class OperationLog:
    log_id: str                     # UUID
    video_id: str
    annotator_id: str
    operation_type: str             # "create_node" | "update_node" | "create_edge"
                                    # "update_edge" | "attach_frame" | "detach_frame"
    target_id: str                  # 被操作对象的 ID
    payload_before: Dict            # 操作前快照（JSON）
    payload_after: Dict             # 操作后快照（JSON）
    timestamp: datetime
```

### 2.2 task_meta 分层设计

```python
# task_schemas.py

# ── Video 级：打开标注界面时填一次 ──────────────────
VIDEO_LEVEL_FIELDS = {
    "task_type": {
        "type": "enum",
        "options": ["drawer", "coffee_machine", "clothes_folding"],
        "required": True
    },
    "scene_id": {
        "type": "text",
        "required": True,
        "placeholder": "e.g. lab_001"
    }
}

# ── Node 级：每个节点单独填，按 task_type 加载不同 schema ──
NODE_META_SCHEMAS = {
    "drawer": {
        "drawer_state": {
            "type": "enum",
            "options": ["closed", "half_open", "fully_open"],
            "required": True
        },
        "gripper_state": {
            "type": "enum",
            "options": ["open", "closed", "holding"],
            "required": True
        },
        "object_in_hand": {
            "type": "text",
            "required": True,
            "placeholder": "red_block / None"
        }
    },
    "coffee_machine": {
        # 另一个任务类型的 schema，结构相同
        "machine_state": {
            "type": "enum",
            "options": ["off", "idle", "brewing"],
            "required": True
        },
        "cup_position": {
            "type": "enum",
            "options": ["absent", "under_spout", "held"],
            "required": True
        }
    }
}
```

### 2.3 SQLite 表结构

```sql
-- schema.sql

CREATE TABLE videos (
    video_id     TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    task_type    TEXT NOT NULL,
    scene_id     TEXT NOT NULL,
    annotator_id TEXT NOT NULL,
    total_frames INTEGER,
    fps          REAL,
    duration_sec REAL,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT NOT NULL
);

CREATE TABLE state_nodes (
    node_id          TEXT PRIMARY KEY,  -- "001"
    task_type        TEXT NOT NULL,
    state_description TEXT NOT NULL,
    node_meta        TEXT NOT NULL,     -- JSON string
    annotator_id     TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE TABLE frame_refs (
    ref_id       TEXT PRIMARY KEY,
    node_id      TEXT NOT NULL REFERENCES state_nodes(node_id),
    video_id     TEXT NOT NULL REFERENCES videos(video_id),
    frame_index  INTEGER NOT NULL,
    timestamp    REAL NOT NULL
);

CREATE TABLE action_edges (
    edge_id             TEXT PRIMARY KEY,
    task_type           TEXT NOT NULL,
    from_node_id        TEXT NOT NULL REFERENCES state_nodes(node_id),
    to_node_id          TEXT NOT NULL REFERENCES state_nodes(node_id),
    action_description  TEXT NOT NULL,
    action_lib_id       TEXT,
    source_video_id     TEXT NOT NULL REFERENCES videos(video_id),
    annotator_id        TEXT NOT NULL,
    created_at          TEXT NOT NULL
);

CREATE TABLE action_library (
    action_lib_id TEXT PRIMARY KEY,
    task_type     TEXT NOT NULL,
    text          TEXT NOT NULL,
    use_count     INTEGER DEFAULT 1,
    created_by    TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE operation_logs (
    log_id          TEXT PRIMARY KEY,
    video_id        TEXT NOT NULL,
    annotator_id    TEXT NOT NULL,
    operation_type  TEXT NOT NULL,
    target_id       TEXT NOT NULL,
    payload_before  TEXT,               -- JSON string
    payload_after   TEXT,               -- JSON string
    timestamp       TEXT NOT NULL
);

-- 索引
CREATE INDEX idx_state_nodes_task ON state_nodes(task_type);
CREATE INDEX idx_edges_from ON action_edges(from_node_id);
CREATE INDEX idx_edges_to ON action_edges(to_node_id);
CREATE INDEX idx_frame_refs_node ON frame_refs(node_id);
CREATE INDEX idx_action_lib_task ON action_library(task_type);
```

---

## 3. 后端 API

### 3.1 文件结构

```
backend/
├── main.py                 # FastAPI app 入口
├── database.py             # SQLAlchemy engine & session
├── models.py               # ORM 模型
├── schemas.py              # Pydantic 请求/响应模型
├── task_schemas.py         # task_meta schema 定义
├── routers/
│   ├── videos.py           # 视频管理
│   ├── nodes.py            # 节点 CRUD
│   ├── edges.py            # 边 CRUD
│   ├── action_library.py   # 预设库管理
│   └── graph.py            # 图结构查询
└── services/
    ├── video_service.py    # OpenCV 帧提取
    ├── node_id_service.py  # 节点 ID 自增管理
    └── graph_validator.py  # DAG 校验
```

### 3.2 API 端点一览

```
视频管理
  POST   /api/videos                    上传/注册视频，读取帧数/fps
  GET    /api/videos                    列出所有视频
  GET    /api/videos/{video_id}         视频详情
  PATCH  /api/videos/{video_id}/status  更新状态

帧提取
  GET    /api/videos/{video_id}/frame/{frame_index}   返回该帧 JPEG 图像
  GET    /api/videos/{video_id}/thumbnail             视频封面帧

节点管理
  GET    /api/nodes?task_type=drawer    查询某任务的所有节点（供标注时匹配）
  POST   /api/nodes                     新建节点
  PATCH  /api/nodes/{node_id}           更新节点（含回溯修改）
  POST   /api/nodes/{node_id}/frames    为节点挂载新帧实例

边管理
  POST   /api/edges                     新建边
  PATCH  /api/edges/{edge_id}           更新边
  DELETE /api/edges/{edge_id}           删除边

图查询
  GET    /api/graph?task_type=drawer    返回完整图（nodes + edges）用于可视化
  GET    /api/graph/validate?task_type=drawer   DAG 校验，返回错误列表

动作预设库
  GET    /api/action-library?task_type=drawer&q=拉   模糊搜索
  POST   /api/action-library            新增条目
  PATCH  /api/action-library/{id}       重命名
  DELETE /api/action-library/{id}       删除
  POST   /api/action-library/merge      合并两个条目

操作日志
  GET    /api/logs?video_id=xxx         查询某视频的操作历史
```

### 3.3 关键接口定义

```python
# schemas.py（Pydantic）

# 新建节点
class CreateNodeRequest(BaseModel):
    task_type: str
    state_description: str
    node_meta: Dict[str, Any]
    annotator_id: str
    # 同时挂载第一个帧实例
    video_id: str
    frame_index: int
    timestamp: float

class NodeResponse(BaseModel):
    node_id: str                # 返回自动生成的 "001"
    task_type: str
    state_description: str
    node_meta: Dict[str, Any]
    source_frames: List[FrameRefResponse]
    annotator_id: str
    created_at: str
    updated_at: str

# 更新节点（回溯修改）
class UpdateNodeRequest(BaseModel):
    state_description: Optional[str]
    node_meta: Optional[Dict[str, Any]]
    annotator_id: str
    # 前端传入确认修改的边 ID 列表
    edges_to_update: List[str]  # 标注员在弹窗中勾选的边

# 新建边
class CreateEdgeRequest(BaseModel):
    task_type: str
    from_node_id: str
    to_node_id: str
    action_description: str
    action_lib_id: Optional[str]    # 若从预设库选择则传此 ID
    source_video_id: str
    annotator_id: str

# 图查询响应
class GraphResponse(BaseModel):
    task_type: str
    nodes: List[NodeResponse]
    edges: List[EdgeResponse]

# 动作预设库搜索
class ActionLibSearchResponse(BaseModel):
    results: List[ActionLibEntry]   # 模糊匹配结果，按 use_count 降序
    exact_match: bool               # 是否有完全匹配项
```

### 3.4 节点 ID 自增服务

```python
# services/node_id_service.py

def get_next_node_id(task_type: str, db: Session) -> str:
    """
    查询当前任务类型已有的最大节点 ID，返回下一个三位数字符串
    例：已有 001, 002, 005 → 返回 006
    """
    existing = db.query(StateNode.node_id)\
                 .filter(StateNode.task_type == task_type)\
                 .all()
    if not existing:
        return "001"
    max_id = max(int(row[0]) for row in existing)
    return str(max_id + 1).zfill(3)
```

### 3.5 DAG 校验服务

```python
# services/graph_validator.py
import networkx as nx

def validate_task_graph(task_type: str, db: Session) -> List[str]:
    errors = []

    nodes = db.query(StateNode).filter_by(task_type=task_type).all()
    edges = db.query(ActionEdge).filter_by(task_type=task_type).all()

    G = nx.DiGraph()
    for n in nodes:
        G.add_node(n.node_id)
    for e in edges:
        G.add_edge(e.from_node_id, e.to_node_id)

    # 1. 检测环
    if not nx.is_directed_acyclic_graph(G):
        cycles = list(nx.simple_cycles(G))
        errors.append(f"图中存在环: {cycles}")

    # 2. 孤立节点（无入边也无出边）
    isolated = [n for n in G.nodes if G.degree(n) == 0]
    if isolated:
        errors.append(f"孤立节点（无连接）: {isolated}")

    return errors
```

---

## 4. 前端设计

### 4.1 页面结构

```
App
├── /                       首页 / 任务列表
├── /annotators             标注员管理（简单的增删列表）
├── /videos                 视频管理列表
├── /annotate/:video_id     标注主界面（核心页面）
├── /graph/:task_type       图可视化页面
└── /action-library         动作预设库管理
```

### 4.2 标注主界面布局

```
┌──────────────────────────────────────────────────────────────┐
│  顶栏：视频名称 | 任务类型 | 标注员 | 状态 | [提交] [保存]    │
├────────────────────────────┬─────────────────────────────────┤
│                            │  右侧面板                        │
│  视频播放区                │                                  │
│                            │  ┌─ 当前节点信息 ─────────────┐ │
│  [■ 帧预览大图]            │  │ 节点 ID：[自动] or [选择]   │ │
│                            │  │ 状态描述：[文本框]           │ │
│  进度条 ◄──────●────────►  │  │ task_meta 字段：[动态表单]  │ │
│  帧号：1024 / 3600         │  └─────────────────────────────┘ │
│  时间：34.13s              │                                  │
│                            │  ┌─ 动作输入（非首节点）──────┐ │
│  [◄1帧] [▶播放] [1帧►]     │  │ 来自：节点 001             │ │
│                            │  │ 动作：[搜索/输入框]         │ │
│  [M] 打关键帧              │  │ 预设：[匹配列表下拉]         │ │
│                            │  └─────────────────────────────┘ │
│  ─── 已标关键帧列表 ──────  │                                  │
│  ▸ 帧 0215  → 节点 001     │  [确认并继续标注下一帧]          │
│  ▸ 帧 0892  → 节点 002     │                                  │
│  ▸ 帧 1024  ← 当前         │                                  │
└────────────────────────────┴─────────────────────────────────┘
```

### 4.3 关键帧定位交互规范

```
拖动进度条
  → 实时更新帧预览图（节流：100ms）
  → 显示当前帧号和时间戳

键盘快捷键：
  ←        上一帧（frame_index - 1）
  →        下一帧（frame_index + 1）
  Shift+←  后退 10 帧
  Shift+→  前进 10 帧
  M        打关键帧（触发节点匹配弹窗）
  Space    播放/暂停

帧图像获取：
  调用 GET /api/videos/{video_id}/frame/{frame_index}
  节流请求，避免拖动时大量请求
```

### 4.4 节点匹配弹窗

```
按下 M 键后弹出：

┌─ 当前帧 #1024（34.13s）确认为关键帧 ─────────────────────────┐
│                                                               │
│  [帧缩略图预览]                                               │
│                                                               │
│  这个状态是否已经存在？                                        │
│                                                               │
│  ┌─ 现有节点列表（当前任务类型）──────────────────────────┐   │
│  │ 001  抽屉关闭，手空              [drawer:closed/open]  │   │
│  │ 002  抽屉半开，手持把手          [drawer:half/holding] │   │
│  │ 003  抽屉半开，手持方块          [drawer:half/holding] │   │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [选择已有节点（挂载帧）]     [新建节点]     [取消]           │
└───────────────────────────────────────────────────────────────┘
```

### 4.5 回溯修改弹窗

```
标注员点击已标注的历史节点"编辑"：

┌─ 修改节点 002 ────────────────────────────────────────────────┐
│  ⚠️ 此节点被多条视频引用，修改将影响以下内容：               │
│                                                               │
│  请勾选需要同步检查/修改的项：                               │
│                                                               │
│  入边（需确认动作描述是否仍准确）：                           │
│  ☐  001 → 002   "右手握把手向外拉"  [video_03]               │
│  ☐  001 → 002   "双手拉抽屉"       [video_07]               │
│                                                               │
│  出边（需确认动作描述是否仍准确）：                           │
│  ☐  002 → 003   "松手，拿起方块"   [video_03]               │
│                                                               │
│  节点本身：                                                   │
│  ☑  state_description（必选，本次修改目标）                  │
│  ☐  node_meta 字段                                           │
│                                                               │
│  [进入编辑]                                  [取消]           │
└───────────────────────────────────────────────────────────────┘
```

### 4.6 图可视化页面（基础版）

```
使用 ReactFlow 实现：

节点渲染：
  - 显示 node_id（001）+ state_description 前20字
  - 悬停显示完整信息 tooltip
  - 新建节点用蓝色边框，复用节点用灰色边框
  - 点击节点可跳转到编辑

边渲染：
  - 显示 action_description 前15字
  - 多条边（同节点对，不同视频）并排显示
  - 悬停显示完整动作 + 来源视频

布局：
  - 使用 dagre 自动布局（ReactFlow 插件）
  - 提供"重新布局"按钮

功能按钮：
  - [刷新图]  [导出 JSON]  [校验 DAG]
```

---

## 5. 标注完整流程

### 5.1 主流程（逐步）

```
Step 1  登录/选择标注员 ID
        → 从已有列表选择，或输入新 ID

Step 2  新建标注任务
        → 选择本地视频文件
        → 填写 video_level_meta（task_type, scene_id）
        → 系统自动读取 total_frames / fps / duration
        → 生成 video_id，状态设为 in_progress

Step 3  定位第一个关键帧（根节点）
        → 拖进度条 + ←/→ 微调
        → 按 M 打帧
        → 弹出节点匹配弹窗
        → 选择"新建节点"（第一帧通常是新状态）
        → 填写 state_description + node_meta
        → 系统分配 node_id（如 "001"）
        → 父节点 = None（图的起点）

Step 4  定位下一个关键帧
        → 同上定位 + 按 M
        → 弹出节点匹配弹窗
        → 选择已有节点 OR 新建节点
        → 填写 action_description（搜索预设库或自由输入）
          · 自由输入后，系统提示"是否保存到预设库" → 确认后追加
        → 确认创建 ActionEdge（from: 上一节点, to: 当前节点）

Step 5  重复 Step 4 直到视频所有关键帧标注完毕

Step 6  预览本次视频产生的子图
        → 可在此进行回溯修改
        → 校验 DAG（提示错误）

Step 7  提交
        → 视频状态改为 submitted
        → 操作日志完整保存
```

### 5.2 节点复用判断指南（标注员参考）

```
判断两个状态是否为"同一节点"的标准：

✅ 以下情况应复用已有节点：
   - node_meta 枚举字段完全相同
   - state_description 语义相同（允许文字略有不同）
   - 对应帧的机器人/物体状态视觉上一致

❌ 以下情况应新建节点：
   - 任何 node_meta 枚举字段不同（如 gripper_state 不同）
   - 物体位置/状态发生了本质变化

⚠️ 关键帧判断标准：[待补充 - 不阻塞开发]
```

---

## 6. 目录结构

```
vla-annotation-tool/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── task_schemas.py
│   ├── routers/
│   │   ├── videos.py
│   │   ├── nodes.py
│   │   ├── edges.py
│   │   ├── action_library.py
│   │   └── graph.py
│   ├── services/
│   │   ├── video_service.py
│   │   ├── node_id_service.py
│   │   └── graph_validator.py
│   ├── requirements.txt
│   └── annotation.db          # SQLite 数据库文件（运行时生成）
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── VideoList.tsx
│   │   │   ├── AnnotatePage.tsx      # 核心标注页面
│   │   │   ├── GraphView.tsx         # 图可视化
│   │   │   └── ActionLibrary.tsx
│   │   ├── components/
│   │   │   ├── VideoPlayer.tsx       # 视频/帧控制组件
│   │   │   ├── NodeMatchModal.tsx    # 节点匹配弹窗
│   │   │   ├── EditNodeModal.tsx     # 回溯修改弹窗
│   │   │   ├── ActionInput.tsx       # 动作输入+预设搜索
│   │   │   ├── NodeMetaForm.tsx      # 动态 task_meta 表单
│   │   │   └── TaskGraph.tsx         # ReactFlow 图组件
│   │   ├── api/
│   │   │   └── client.ts             # axios 封装
│   │   └── types/
│   │       └── index.ts              # TypeScript 类型定义
│   ├── package.json
│   └── tsconfig.json
│
├── README.md
└── docker-compose.yml            # 可选：容器化部署
```

---

## 7. 依赖清单

### 7.1 Python 后端

```txt
# requirements.txt
fastapi==0.111.0
uvicorn==0.30.0
sqlalchemy==2.0.30
pydantic==2.7.0
opencv-python==4.9.0.80
networkx==3.3
python-multipart==0.0.9     # 文件上传
Pillow==10.3.0               # 帧图像处理
```

### 7.2 前端

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "axios": "^1.7.0",
    "reactflow": "^11.11.0",
    "dagre": "^0.8.5",
    "@reactflow/dagre": "^0.1.0",
    "tailwindcss": "^3.4.0",
    "zustand": "^4.5.0"
  }
}
```

---

## 8. 环境启动

```bash
# 克隆项目
git clone <repo>
cd vla-annotation-tool

# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 前端（另开终端）
cd frontend
npm install
npm run dev     # 默认 http://localhost:5173

# 访问
# 标注工具：http://localhost:5173
# API 文档：http://localhost:8000/docs
```

---

## 9. 待定项（不阻塞开发，后续迭代）

| 编号 | 事项 | 说明 |
|------|------|------|
| P1 | 关键帧判断标准文档 | 写入标注指南，不影响工具逻辑 |
| P2 | 动作预设库同义词合并 | 当前只支持手动重命名/删除 |
| P3 | 图可视化高级功能 | 折叠、过滤、按视频着色 |
| P4 | 多标注员任务分配 | 当前不做任务锁定 |
| P5 | 导出为训练数据格式 | LeRobot / OpenVLA 兼容格式 |

---

## 10. 关键设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 节点定义 | 抽象状态（跨视频复用） | 避免训练数据冗余，图结构紧凑 |
| 节点 ID 格式 | 三位数字字符串（001） | 简洁可读，上限 999 满足单任务需求 |
| 动作属于 | 边，不属于节点 | 语义正确：动作发生在两状态之间 |
| 存储方案 | SQLite | 单机使用，无需部署独立数据库 |
| 预设库初始化 | 第一条视频自由输入建库 | 最低实现复杂度，后续可扩展 |
| task_meta 分层 | video 级 + node 级 | 减少重复填写，保证字段规范性 |
| 帧定位方式 | 拖动进度条 + ←/→ 微调 | 兼顾效率与精度 |
