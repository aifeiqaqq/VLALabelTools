import { create } from 'zustand';

/**
 * UI Store
 * Manages UI state (tabs, modals, search inputs)
 * 支持多视频和父节点选择
 * v2.2: 添加预选择路由状态，支持快速标注模式
 */
export const useUIStore = create((set) => ({
  // State
  activeTab: "annotate",

  // Mark modal state
  showMark: false,
  pendingCap: null,
  mMode: "new", // "new" | "existing" | "route"
  selNode: null,
  selectedRouteId: null,    // 当前选中的路线ID
  stateDesc: "",
  metaVals: {},
  // Structured action fields (v3.0)
  actionTarget: "",         // 目标对象（如：drawer, mug）
  actionName: "",           // 动作名称（如：open, close）
  customActionName: "",     // 自定义动作名称

  // Quick mark mode state (v2.2)
  showQuickMark: false,     // 快速标注模态框显示状态
  preselectedRouteId: null, // 预选择的路由ID（用于快速模式）

  // Edit modal state
  showEdit: false,
  editMark: null,
  editDesc: "",
  editMeta: {},
  editParentNodeId: [],  // 数组格式支持多父节点

  // Library tab search
  libTabSearch: "",

  // Frame input
  frameInput: "",

  // Actions - Tab
  setActiveTab: (activeTab) => set({ activeTab }),

  // Actions - Mark Modal
  openMarkModal: (pendingCap) => set({
    showMark: true,
    pendingCap,
    mMode: "new",
    selNode: null,
    selectedRouteId: null,
    stateDesc: "",
    metaVals: {},
    actionTarget: "",
    actionName: "",
    customActionName: "",
  }),

  closeMarkModal: () => set({
    showMark: false,
    pendingCap: null,
  }),

  setMarkMode: (mode) => set({ mMode: mode }),

  setSelectedNode: (nodeId) => set({ selNode: nodeId }),

  setSelectedRouteId: (routeId) => set({ selectedRouteId: routeId }),

  setStateDesc: (desc) => set({ stateDesc: desc }),

  setMetaVals: (vals) => set({ metaVals: vals }),

  // Structured action setters (v3.0)
  setActionTarget: (target) => set({ actionTarget: target }),

  setActionName: (name) => set({ actionName: name }),

  setCustomActionName: (name) => set({ customActionName: name }),

  // Actions - Edit Modal
  openEditModal: (editMark, editDesc, editMeta, editParentNodeId = []) => set({
    showEdit: true,
    editMark,
    editDesc,
    editMeta,
    editParentNodeId,
  }),

  closeEditModal: () => set({
    showEdit: false,
    editMark: null,
    editDesc: "",
    editMeta: {},
    editParentNodeId: [],
  }),

  setEditDesc: (desc) => set({ editDesc: desc }),

  setEditMeta: (meta) => set({ editMeta: meta }),

  setEditParentNodeId: (parentId) => set({ editParentNodeId: parentId }),

  // Actions - Library Search
  setLibTabSearch: (search) => set({ libTabSearch: search }),

  // Actions - Frame Input
  setFrameInput: (input) => set({ frameInput: input }),

  // Actions - Quick Mark Mode (v2.2)
  openQuickMarkModal: (pendingCap) => set({
    showQuickMark: true,
    pendingCap,
  }),

  closeQuickMarkModal: () => set({
    showQuickMark: false,
    pendingCap: null,
  }),

  setPreselectedRouteId: (routeId) => set({ preselectedRouteId: routeId }),

  clearPreselectedRoute: () => set({
    preselectedRouteId: null,
  }),
}));
