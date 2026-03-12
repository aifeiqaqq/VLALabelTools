#!/bin/bash

# ============================================
# 视频格式检查 & 转换工具脚本
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 ffmpeg 是否安装
check_ffmpeg() {
    if ! command -v ffmpeg &> /dev/null; then
        echo -e "${RED}错误: 未找到 ffmpeg${NC}"
        echo "请安装 ffmpeg:"
        echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
        echo "  macOS: brew install ffmpeg"
        echo "  Windows: https://ffmpeg.org/download.html"
        exit 1
    fi
}

# 检查视频格式
check_format() {
    local input_file="$1"
    
    if [ ! -f "$input_file" ]; then
        echo -e "${RED}错误: 文件不存在: $input_file${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}正在分析视频格式...${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # 获取视频流信息
    local video_info=$(ffmpeg -i "$input_file" 2>&1 | grep -E "Stream.*Video:")
    local audio_info=$(ffmpeg -i "$input_file" 2>&1 | grep -E "Stream.*Audio:")
    local duration=$(ffmpeg -i "$input_file" 2>&1 | grep -E "Duration:" | awk '{print $2}' | tr -d ',')
    
    echo -e "${GREEN}文件:${NC} $input_file"
    echo -e "${GREEN}时长:${NC} $duration"
    echo ""
    
    # 解析视频编码
    if echo "$video_info" | grep -q "hevc\|h265\|H.265"; then
        echo -e "${YELLOW}视频编码: HEVC/H.265${NC} ${RED}(Chrome 浏览器不支持)${NC}"
    elif echo "$video_info" | grep -q "h264\|avc"; then
        echo -e "${GREEN}视频编码: H.264/AVC${NC} ${GREEN}(所有浏览器支持)${NC}"
    elif echo "$video_info" | grep -q "vp9"; then
        echo -e "${YELLOW}视频编码: VP9${NC} ${YELLOW}(部分浏览器支持)${NC}"
    elif echo "$video_info" | grep -q "vp8"; then
        echo -e "${YELLOW}视频编码: VP8${NC} ${GREEN}(大部分浏览器支持)${NC}"
    else
        echo -e "${YELLOW}视频编码: 其他${NC}"
    fi
    
    echo -e "${GREEN}视频流:${NC} $video_info"
    echo ""
    
    # 解析音频编码
    if echo "$audio_info" | grep -q "aac"; then
        echo -e "${GREEN}音频编码: AAC${NC}"
    elif echo "$audio_info" | grep -q "mp3"; then
        echo -e "${GREEN}音频编码: MP3${NC}"
    else
        echo -e "${YELLOW}音频编码: 其他${NC}"
    fi
    
    echo -e "${GREEN}音频流:${NC} $audio_info"
    echo ""
    
    # 获取分辨率
    local resolution=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$input_file" 2>/dev/null)
    if [ -n "$resolution" ]; then
        echo -e "${GREEN}分辨率:${NC} $resolution"
    fi
    
    # 获取文件大小
    local filesize=$(ls -lh "$input_file" | awk '{print $5}')
    echo -e "${GREEN}文件大小:${NC} $filesize"
    echo ""
    
    # 浏览器兼容性提示
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}浏览器兼容性:${NC}"
    echo -e "${BLUE}========================================${NC}"
    if echo "$video_info" | grep -q "hevc\|h265\|H.265"; then
        echo -e "${RED}❌ Chrome/Edge: 不支持${NC} (需要扩展或特殊版本)"
        echo -e "${GREEN}✅ Firefox: 支持${NC} (需系统支持)"
        echo -e "${YELLOW}⚠️  Safari: 支持${NC} (macOS/iOS)"
        echo ""
        echo -e "${YELLOW}建议: 转换为 H.264 以获得最佳兼容性${NC}"
        echo -e "命令: $0 convert \"$input_file\""
    elif echo "$video_info" | grep -q "h264\|avc"; then
        echo -e "${GREEN}✅ Chrome/Edge: 支持${NC}"
        echo -e "${GREEN}✅ Firefox: 支持${NC}"
        echo -e "${GREEN}✅ Safari: 支持${NC}"
        echo ""
        echo -e "${GREEN}该视频格式兼容性良好！${NC}"
    else
        echo -e "${YELLOW}⚠️  兼容性未知，建议测试${NC}"
    fi
    echo ""
}

# 转换为 H.264
convert_to_h264() {
    local input_file="$1"
    local output_file="${2:-${input_file%.*}_h264.mp4}"
    
    if [ ! -f "$input_file" ]; then
        echo -e "${RED}错误: 文件不存在: $input_file${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}正在转换为 H.264 格式...${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${GREEN}输入:${NC} $input_file"
    echo -e "${GREEN}输出:${NC} $output_file"
    echo ""
    
    # 转换命令
    ffmpeg -i "$input_file" \
        -c:v libx264 \
        -preset medium \
        -crf 23 \
        -c:a aac \
        -b:a 128k \
        -movflags +faststart \
        -y \
        "$output_file" 2>&1 | tee /tmp/ffmpeg_output.log
    
    local exit_code=$?
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}转换成功！${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        
        # 显示输出文件信息
        local input_size=$(ls -lh "$input_file" | awk '{print $5}')
        local output_size=$(ls -lh "$output_file" | awk '{print $5}')
        
        echo -e "原文件大小: $input_size"
        echo -e "新文件大小: $output_size"
        echo ""
        echo -e "输出文件: ${GREEN}$output_file${NC}"
        echo ""
        
        # 验证输出格式
        local output_codec=$(ffmpeg -i "$output_file" 2>&1 | grep -E "Stream.*Video:" | grep -o "h264\|avc")
        if [ -n "$output_codec" ]; then
            echo -e "${GREEN}✅ 验证成功: 输出文件为 H.264 格式${NC}"
        fi
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}转换失败！${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "错误日志:"
        tail -20 /tmp/ffmpeg_output.log
        exit 1
    fi
}

# 批量转换
batch_convert() {
    local dir="${1:-.}"
    
    echo -e "${BLUE}批量转换目录: $dir${NC}"
    echo ""
    
    find "$dir" -maxdepth 1 -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.mkv" -o -name "*.avi" \) | while read -r file; do
        # 跳过已经转换过的文件
        if [[ "$file" == *"_h264.mp4" ]]; then
            echo -e "${YELLOW}跳过已转换文件: $file${NC}"
            continue
        fi
        
        echo ""
        convert_to_h264 "$file"
    done
}

# 显示帮助
show_help() {
    echo "视频格式工具脚本"
    echo ""
    echo "用法:"
    echo "  $0 check <视频文件>       - 检查视频格式"
    echo "  $0 convert <视频文件> [输出文件]  - 转换为 H.264"
    echo "  $0 batch [目录]           - 批量转换目录中的所有视频"
    echo "  $0 help                   - 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 check video.mp4"
    echo "  $0 convert video.mp4"
    echo "  $0 convert video.mp4 output.mp4"
    echo "  $0 batch ./videos"
}

# 主程序
check_ffmpeg

case "${1:-help}" in
    check)
        if [ -z "$2" ]; then
            echo -e "${RED}错误: 请指定视频文件${NC}"
            echo "用法: $0 check <视频文件>"
            exit 1
        fi
        check_format "$2"
        ;;
    convert)
        if [ -z "$2" ]; then
            echo -e "${RED}错误: 请指定视频文件${NC}"
            echo "用法: $0 convert <视频文件> [输出文件]"
            exit 1
        fi
        convert_to_h264 "$2" "$3"
        ;;
    batch)
        batch_convert "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
