# 视频格式工具

这个目录包含两个脚本来帮助你检查和转换视频格式。

## 文件说明

- `video_tools.sh` - Bash 脚本（Linux/macOS）
- `video_tools.py` - Python 脚本（跨平台，Windows/Linux/macOS）

## 使用方法

### 方法 1: Bash 脚本 (Linux/macOS)

```bash
# 给脚本执行权限
chmod +x video_tools.sh

# 检查视频格式
./video_tools.sh check video.mp4

# 转换为 H.264
./video_tools.sh convert video.mp4
./video_tools.sh convert video.mp4 output.mp4

# 批量转换目录中的所有视频
./video_tools.sh batch ./videos
```

### 方法 2: Python 脚本 (跨平台)

```bash
# 检查视频格式
python video_tools.py check video.mp4

# 转换为 H.264
python video_tools.py convert video.mp4
python video_tools.py convert video.mp4 output.mp4
```

## 输出示例

### 检查格式
```
========================================
正在分析视频格式...
========================================

文件: video.mp4
时长: 00:00:11.90
分辨率: 1920x1080
文件大小: 5.49 MB

视频编码: HEVC/H.265 (Chrome 浏览器不支持)
编码详情: H.265 / HEVC (High Efficiency Video Coding)

音频编码: AAC

========================================
浏览器兼容性:
========================================
❌ Chrome/Edge: 不支持 (需要扩展或特殊版本)
✅ Firefox: 支持 (需系统支持)
⚠️  Safari: 支持 (macOS/iOS)

建议: 转换为 H.264 以获得最佳兼容性
命令: ./video_tools.sh convert "video.mp4"
```

### 转换结果
```
========================================
正在转换为 H.264 格式...
========================================

输入: video.mp4
输出: video_h264.mp4

[ffmpeg 输出...]

========================================
转换成功！
========================================

原文件大小: 5.49 MB
新文件大小: 4.21 MB

输出文件: video_h264.mp4

✅ 验证成功: 输出文件为 H.264 格式
```

## 浏览器兼容性说明

| 编码格式 | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| H.264   | ✅ 支持     | ✅ 支持  | ✅ 支持 |
| HEVC/H.265 | ❌ 不支持 | ✅ 支持(需系统) | ✅ 支持 |
| VP9     | ✅ 支持     | ✅ 支持  | ✅ 支持 |
| VP8     | ✅ 支持     | ✅ 支持  | ✅ 支持 |

**建议**: 使用 H.264 编码获得最佳浏览器兼容性。

## 依赖安装

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### macOS
```bash
brew install ffmpeg
```

### Windows
1. 下载: https://ffmpeg.org/download.html#build-windows
2. 解压并将 bin 目录添加到 PATH 环境变量

## 转换参数说明

脚本使用的 ffmpeg 参数:
- `-c:v libx264` - 使用 H.264 编码器
- `-preset medium` - 编码速度/质量平衡
- `-crf 23` - 质量设置 (0-51, 越小越好，默认 23)
- `-c:a aac` - AAC 音频编码
- `-b:a 128k` - 音频码率 128kbps
- `-movflags +faststart` - 优化网页播放
