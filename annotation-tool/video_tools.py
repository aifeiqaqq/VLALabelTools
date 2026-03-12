#!/usr/bin/env python3
"""
视频格式检查 & 转换工具
需要安装: pip install ffmpeg-python
"""

import sys
import os
import subprocess
import json

# 颜色定义
RED = '\033[91m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
NC = '\033[0m'

def check_ffmpeg():
    """检查 ffmpeg 是否安装"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"{RED}错误: 未找到 ffmpeg{NC}")
        print("请安装 ffmpeg:")
        print("  Ubuntu/Debian: sudo apt-get install ffmpeg")
        print("  macOS: brew install ffmpeg")
        print("  Windows: https://ffmpeg.org/download.html")
        return False

def get_video_info(input_file):
    """获取视频信息"""
    cmd = [
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams', input_file
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)

def check_format(input_file):
    """检查视频格式"""
    if not os.path.exists(input_file):
        print(f"{RED}错误: 文件不存在: {input_file}{NC}")
        return
    
    info = get_video_info(input_file)
    if not info:
        print(f"{RED}无法解析视频文件{NC}")
        return
    
    print(f"{BLUE}{'='*40}{NC}")
    print(f"{BLUE}正在分析视频格式...{NC}")
    print(f"{BLUE}{'='*40}{NC}")
    print()
    
    # 基本信息
    format_info = info.get('format', {})
    duration = float(format_info.get('duration', 0))
    size_bytes = int(format_info.get('size', 0))
    size_mb = size_bytes / (1024 * 1024)
    
    print(f"{GREEN}文件:{NC} {input_file}")
    print(f"{GREEN}时长:{NC} {duration:.2f} 秒")
    print(f"{GREEN}文件大小:{NC} {size_mb:.2f} MB")
    print()
    
    # 视频流信息
    video_stream = None
    audio_stream = None
    
    for stream in info.get('streams', []):
        if stream['codec_type'] == 'video':
            video_stream = stream
        elif stream['codec_type'] == 'audio':
            audio_stream = stream
    
    if video_stream:
        codec = video_stream.get('codec_name', 'unknown')
        width = video_stream.get('width', 0)
        height = video_stream.get('height', 0)
        
        print(f"{GREEN}分辨率:{NC} {width}x{height}")
        
        # 判断编码格式
        if codec in ['hevc', 'h265']:
            print(f"{YELLOW}视频编码: HEVC/H.265{NC} {RED}(Chrome 浏览器不支持){NC}")
            is_hevc = True
        elif codec in ['h264', 'avc']:
            print(f"{GREEN}视频编码: H.264/AVC{NC} {GREEN}(所有浏览器支持){NC}")
            is_hevc = False
        elif codec == 'vp9':
            print(f"{YELLOW}视频编码: VP9{NC}")
            is_hevc = False
        elif codec == 'vp8':
            print(f"{YELLOW}视频编码: VP8{NC}")
            is_hevc = False
        else:
            print(f"{YELLOW}视频编码: {codec}{NC}")
            is_hevc = False
        
        print(f"{GREEN}编码详情:{NC} {video_stream.get('codec_long_name', codec)}")
        print()
    
    if audio_stream:
        audio_codec = audio_stream.get('codec_name', 'unknown')
        print(f"{GREEN}音频编码:{NC} {audio_codec.upper()}")
        print()
    
    # 浏览器兼容性
    print(f"{BLUE}{'='*40}{NC}")
    print(f"{BLUE}浏览器兼容性:{NC}")
    print(f"{BLUE}{'='*40}{NC}")
    
    if is_hevc:
        print(f"{RED}❌ Chrome/Edge: 不支持{NC} (需要扩展或特殊版本)")
        print(f"{GREEN}✅ Firefox: 支持{NC} (需系统支持)")
        print(f"{YELLOW}⚠️  Safari: 支持{NC} (macOS/iOS)")
        print()
        print(f"{YELLOW}建议: 转换为 H.264 以获得最佳兼容性{NC}")
        print(f"命令: python {sys.argv[0]} convert \"{input_file}\"")
    else:
        print(f"{GREEN}✅ Chrome/Edge: 支持{NC}")
        print(f"{GREEN}✅ Firefox: 支持{NC}")
        print(f"{GREEN}✅ Safari: 支持{NC}")
        print()
        print(f"{GREEN}该视频格式兼容性良好！{NC}")
    print()

def convert_to_h264(input_file, output_file=None):
    """转换为 H.264"""
    if not os.path.exists(input_file):
        print(f"{RED}错误: 文件不存在: {input_file}{NC}")
        return
    
    if output_file is None:
        base, ext = os.path.splitext(input_file)
        output_file = f"{base}_h264.mp4"
    
    print(f"{BLUE}{'='*40}{NC}")
    print(f"{BLUE}正在转换为 H.264 格式...{NC}")
    print(f"{BLUE}{'='*40}{NC}")
    print()
    print(f"{GREEN}输入:{NC} {input_file}")
    print(f"{GREEN}输出:{NC} {output_file}")
    print()
    
    cmd = [
        'ffmpeg', '-i', input_file,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        output_file
    ]
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print()
        print(f"{GREEN}{'='*40}{NC}")
        print(f"{GREEN}转换成功！{NC}")
        print(f"{GREEN}{'='*40}{NC}")
        print()
        
        input_size = os.path.getsize(input_file) / (1024 * 1024)
        output_size = os.path.getsize(output_file) / (1024 * 1024)
        
        print(f"原文件大小: {input_size:.2f} MB")
        print(f"新文件大小: {output_size:.2f} MB")
        print()
        print(f"输出文件: {GREEN}{output_file}{NC}")
        print()
        
        # 验证输出格式
        output_info = get_video_info(output_file)
        if output_info:
            for stream in output_info.get('streams', []):
                if stream['codec_type'] == 'video':
                    if stream.get('codec_name') in ['h264', 'avc']:
                        print(f"{GREEN}✅ 验证成功: 输出文件为 H.264 格式{NC}")
                    break
    else:
        print()
        print(f"{RED}{'='*40}{NC}")
        print(f"{RED}转换失败！{NC}")
        print(f"{RED}{'='*40}{NC}")

def show_help():
    """显示帮助"""
    print("视频格式工具脚本")
    print()
    print("用法:")
    print(f"  python {sys.argv[0]} check <视频文件>       - 检查视频格式")
    print(f"  python {sys.argv[0]} convert <视频文件> [输出文件]  - 转换为 H.264")
    print(f"  python {sys.argv[0]} help                   - 显示帮助")
    print()
    print("示例:")
    print(f"  python {sys.argv[0]} check video.mp4")
    print(f"  python {sys.argv[0]} convert video.mp4")
    print(f"  python {sys.argv[0]} convert video.mp4 output.mp4")

def main():
    if len(sys.argv) < 2:
        show_help()
        return
    
    if not check_ffmpeg():
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'check':
        if len(sys.argv) < 3:
            print(f"{RED}错误: 请指定视频文件{NC}")
            show_help()
            sys.exit(1)
        check_format(sys.argv[2])
    elif command == 'convert':
        if len(sys.argv) < 3:
            print(f"{RED}错误: 请指定视频文件{NC}")
            show_help()
            sys.exit(1)
        output = sys.argv[3] if len(sys.argv) > 3 else None
        convert_to_h264(sys.argv[2], output)
    elif command in ['help', '--help', '-h']:
        show_help()
    else:
        print(f"{RED}未知命令: {command}{NC}")
        show_help()
        sys.exit(1)

if __name__ == '__main__':
    main()
