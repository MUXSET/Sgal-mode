/**
 * StreamingController - 流式传输控制器
 * 
 * 负责管理流式传输的状态，实现增量缓冲、防抖解析和智能合并
 * 核心优化：
 * 1. 增量缓冲：维护本地 Token 缓冲区，不再每次读取整个 Context
 * 2. 防抖解析：使用 requestAnimationFrame 防抖，避免每个字符都触发重排
 * 3. 智能合并：保持历史不动，只更新当前正在生成的部分
 * 4. 打字机透传：直接更新文本，无需重新渲染整个 Frame
 */
class StreamingController {
    constructor(core) {
        this.core = core; // 引用全局作用域的变量 (playList, playIndex等)
        this.isStreaming = false;
        this.messageId = null;
        this.startIndex = 0;
        this.bufferText = "";
        this.updateTimer = null;
        this.lastParsedLength = 0;
    }

    /**
     * 开始监听流
     * @param {number} msgId - 正在生成的消息ID
     * @param {number} startIndex - 播放列表的起始索引（历史记录的末尾）
     */
    start(msgId, startIndex) {
        this.isStreaming = true;
        this.messageId = msgId;
        this.startIndex = startIndex;
        this.bufferText = ""; // 重置缓冲
        this.lastParsedLength = 0;
        
        console.log(`[GAL Stream] Started. Base Index: ${startIndex}`);
    }

    /**
     * 接收到 Token
     * @param {string} token 
     */
    onToken(token) {
        if (!this.isStreaming) return;
        
        this.bufferText += token;

        // 优化：防抖处理，避免每个字符都触发重排，每帧更新一次 UI
        if (!this.updateTimer) {
            this.updateTimer = requestAnimationFrame(() => {
                this.processUpdate();
                this.updateTimer = null;
            });
        }
    }

    /**
     * 核心更新逻辑
     */
    processUpdate() {
        // 1. 构建临时 DOM (因为 buildPlaylist 依赖 DOM)
        // 注意：我们处理换行符以确保 buildPlaylist 能正确分帧
        const formattedText = this.bufferText
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '<br>');

        const tempMsg = document.createElement('div');
        tempMsg.classList.add('mes');
        tempMsg.setAttribute('is_user', 'false');
        
        const textDiv = document.createElement('div');
        textDiv.className = 'mes_text';
        textDiv.innerHTML = formattedText;
        
        // 名字 (Mock)
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name_text';
        nameDiv.innerText = this.core.getCharacterName();
        
        tempMsg.appendChild(nameDiv);
        tempMsg.appendChild(textDiv);

        // 2. 获取背景图 (沿用上一帧的)
        let initialBg = this.core.characterAvatarUrl;
        if (this.startIndex > 0 && this.core.playList[this.startIndex - 1]) {
            initialBg = this.core.playList[this.startIndex - 1].img;
        }

        // 3. 解析出新产生的 Frames
        const newFrames = this.core.buildPlaylist(tempMsg, initialBg, this.messageId);

        // 4. 更新全局 playList
        // 保持历史不变，只替换尾部
        const history = this.core.playList.slice(0, this.startIndex);
        this.core.setPlayList(history.concat(newFrames));

        // 5. 智能 UI 更新
        this.syncUI(newFrames);
    }

    /**
     * 界面同步逻辑：实现"点击切换下一帧"的关键
     */
    syncUI(newFrames) {
        const currentIndex = this.core.playIndex;
        const totalLength = this.core.playList.length;
        
        // 场景 A: 用户正在看生成的最新一帧 -> 实时更新文字
        if (currentIndex >= this.startIndex && currentIndex === totalLength - 1) {
            const currentFrame = this.core.playList[currentIndex];
            // 直接更新 DOM 文本，不调用 renderFrame 以避免闪烁
            $('#gal-text-content').html(currentFrame.text.replace(/\n/g, '<br>'));
            // 可选：滚动到底部
            // const textBox = document.getElementById('gal-text-content');
            // textBox.scrollTop = textBox.scrollHeight;
        }
        
        // 场景 B: 新的帧产生了 (例如：buffer 里出现了一个句号，分出了新的一帧)
        // 此时 currentIndex 变成了 totalLength - 2 (或者更前)
        // 逻辑: 显示 "Next" 指示器，让用户点击
        if (currentIndex < totalLength - 1) {
            $('#gal-next-indicator').addClass('visible');
        }
    }

    /**
     * 结束流
     */
    stop() {
        if (this.updateTimer) cancelAnimationFrame(this.updateTimer);
        this.isStreaming = false;
        this.processUpdate(); // 确保最后一次更新执行
        console.log(`[GAL Stream] Stopped. Total Frames: ${this.core.playList.length}`);
    }
}

// Export for use in index.js or other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingController;
}
