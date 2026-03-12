import { create } from 'zustand';

/**
 * Session Store
 * Manages session-level configuration (annotator, task type, scene)
 */
export const useSessionStore = create((set) => ({
  // State
  annotatorId: "annotator_01",
  taskType: "drawer",
  sceneId: "lab_001",
  started: false,

  // Actions
  setAnnotatorId: (id) => set({ annotatorId: id }),

  setTaskType: (type) => set({ taskType: type }),

  setSceneId: (id) => set({ sceneId: id }),

  startSession: () => set({ started: true }),

  resetSession: () => set({
    annotatorId: "annotator_01",
    taskType: "drawer",
    sceneId: "lab_001",
    started: false,
  }),
}));
