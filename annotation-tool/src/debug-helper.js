/**
 * 调试帮助函数 - 在浏览器 Console 中运行这些代码来排查问题
 */

// 检查所有 store 的当前状态
export function debugStores() {
  const { useVideoStore } = require('./stores/videoStore');
  const { useAnnotationStore } = require('./stores/annotationStore');
  const { useSessionStore } = require('./stores/sessionStore');
  const { useUIStore } = require('./stores/uiStore');

  console.log('=== Video Store ===');
  console.log('videos:', useVideoStore.getState().videos);
  console.log('currentVideoId:', useVideoStore.getState().currentVideoId);
  
  console.log('=== Annotation Store ===');
  console.log('nodes:', useAnnotationStore.getState().nodes);
  console.log('edges:', useAnnotationStore.getState().edges);
  console.log('marks:', useAnnotationStore.getState().marks);
  
  console.log('=== Session Store ===');
  console.log('started:', useSessionStore.getState().started);
  
  console.log('=== UI Store ===');
  console.log('activeTab:', useUIStore.getState().activeTab);
}

// 手动检查 IndexedDB 中的数据
export async function debugDB() {
  const { listProjects, getVideosByProject, getAnnotations } = require('./utils/db');
  
  console.log('=== IndexedDB 项目列表 ===');
  const projects = await listProjects();
  console.log('Projects:', projects);
  
  for (const project of projects) {
    console.log(`\n=== 项目: ${project.id} ===`);
    const videos = await getVideosByProject(project.id);
    console.log('Videos:', videos);
    
    const annotations = await getAnnotations(project.id);
    console.log('Annotations:', annotations);
  }
}

// 检查 OPFS 中的视频文件
export async function debugOPFS() {
  const { listVideoFiles } = require('./utils/localFs');
  
  console.log('=== OPFS 视频文件 ===');
  const files = await listVideoFiles();
  console.log('Video files:', files);
}

console.log('调试工具已加载！运行以下命令：');
console.log('  debugStores() - 查看所有 store 状态');
console.log('  debugDB() - 查看 IndexedDB 数据');
console.log('  debugOPFS() - 查看 OPFS 视频文件');
