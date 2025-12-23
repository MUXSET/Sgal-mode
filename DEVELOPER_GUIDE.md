# Sgal-mode Developer Guide

> **面向 AI 助手的代码修改指南**  
> 本文档为未来的 AI 助手提供完整的架构说明和修改指南

---

## 📁 项目结构

```
Sgal-mode/
├── manifest.json                 # 插件配置（entry: src/main.js）
├── style.css                     # 主样式文件
        │               │
┌───────▼────┐    ┌────▼──────────────┐
│ UI组件     │    │ Services (服务)   │
│ 7个组件    │    │ ├─ SaveManager   │
└────────────┘    │ ├─ LocalStorage  │
                  │ └─ ImageService  │
                  └──────┬────────────┘
                         │
                  ┌──────▼────────────┐
                  │ Adapters (适配)   │
                  │ SillyTavern集成   │
                  └──────┬────────────┘
                         │
                  ┌──────▼────────────┐
                  │ Core (纯逻辑)     │
                  │ 引擎 + 状态       │
                  └───────────────────┘
```

### 设计原则

1. **单向数据流**：State → Render → User Action → Update State
2. **依赖注入**：所有依赖在 `main.js` 中创建并注入
3. **单一职责**：每个模块只做一件事
4. **接口隔离**：模块间通过清晰的接口通信

---

## 📊 数据流图

### 正常播放流程

```
用户点击屏幕
    ↓
UIManager.setupScreenClickHandler()
    ↓
NavigationController.next()
    ↓
StateManager.playIndex++
    ↓
DialogueBox.renderFrame(frame)
    ↓
TypewriterEngine.start() (可选)
    ↓
显示文字 + 更新进度条
```

### 流式传输流程 (Updated v10.0 - StreamingController)

```
用户点击"Continue"
    ↓
GameFlowController.continueStory()
    ↓
STAdapter.sendMessage('')
    ↓
setupStreamingListeners(messageId)
    ↓
1. rebuildHistoryUntil(messageId) - 清理历史
    ↓
2. StreamingController.start(messageId, startIndex)
    ↓
每次收到 token ──→ StreamingController.onToken(token)
    │                    ↓
    │              bufferText += token (增量缓冲)
    │                    ↓
    │              requestAnimationFrame (防抖)
    │                    ↓
    │              processUpdate() (每帧最多一次)
    │                    ↓
    │              buildPlaylist(临时DOM)
    │                    ↓
    │              合并历史 + 新帧
    │                    ↓
    └──────────→  syncUI() - 智能更新
                       │
                       ├─→ 场景A: 用户在最新帧 → 直接文本更新
                       └─→ 场景B: 新帧生成 → 显示Next指示器
    
流式完成 → StreamingController.stop()
    ↓
handleMessageReceived(messageId)
    ↓
完整重建 playList
```

**主要改进 (v10.0)**:
- ✅ Token级增量缓冲，避免重复Context读取
- ✅ requestAnimationFrame防抖，降低CPU使用
- ✅ 智能UI同步，无闪烁更新
- ✅ 保持历史不变，只更新生成部分


### 存档/读档流程

```
存档:
用户点击💾 → SaveLoadMenu.showSaveMenu() 
    → 选择 Quick Save → LocalStorageService.saveQuickSave()
    → 选择 Full Save → SaveManager.saveGame() → 创建 [GAL] 聊天文件
    → 触发 onSave 回调 (如 New Game 流程)

读档:
用户点击📂 → SaveLoadMenu.showLoadMenu()
    → 选择存档 → SaveManager.loadGame()
    → 恢复 playIndex & playlistSnapshot
    → 触发 gal:force-sync-ui 事件
    → GameFlowController.renderCurrentFrame()
```

### New Game 流程 (V9.0)

```
用户点击 "New Game"
    ↓
UIManager.startNewGame()
    ↓
1. 执行 /newchat 命令 (STAdapter.sendCommand)
    ↓
2. 等待 ST 切换到新会话
    ↓
3. 打开 SaveMenu (autoClose: true)
    ↓
4. 用户选择槽位保存
    ↓
5. SaveManager.saveGame() -> 创建独立存档文件
    ↓
6. 触发 onSave 回调:
    a. SaveManager.loadGame() -> 加载新创建的存档
    b. SaveManager.deleteChatFile() -> 删除 /newchat 创建的临时文件
       (如果跨页面，使用 sessionStorage 标记 pending delete)
```

---

## 🔧 常见修改场景

### 场景1: 添加新的UI按钮

**位置**: `src/ui/UIManager.js`

```javascript
// 1. 在 _buildHTML() 中添加按钮 HTML
<button id="gal-new-btn" class="gal-btn" title="新功能">🆕</button>

// 2. 在 ControlPanel 初始化中添加处理器
this.components.controlPanel.initialize({
    // ... 其他按钮
    newBtn: () => this.handleNewFeature()
});

// 3. 实现功能
handleNewFeature() {
    console.log('新功能被触发');
    // 你的逻辑
}
```

---

### 场景2: 添加新的游戏状态变量

**位置**: `src/core/StateManager.js`

```javascript
constructor() {
    // ... 现有状态
    this.myNewVariable = null; // 添加新变量
}

// 在 getState() 中导出
getState() {
    return {
        // ... 现有属性
        myNewVariable: this.myNewVariable
    };
}

// 在 resetState() 中重置
resetState() {
    // ... 现有重置
    this.myNewVariable = null;
}
```

---

### 场景3: 修改选项检测逻辑

**位置**: `src/controllers/ChoiceController.js`

**函数**: `detectChoices(text)`

当前支持的格式：
- `「选项1」「选项2」` (日文括号)
- `[选项1] [选项2]` (方括号，排除图片标签)
- `1. 选项1\n2. 选项2` (编号列表)

**添加新格式示例**:

```javascript
detectChoices(text) {
    // ... 现有模式匹配
    
    // 添加新模式：使用 >> 前缀
    choices = [];
    const newPattern = /^>>\s*(.+)$/gm;
    let match;
    while ((match = newPattern.exec(text)) !== null) {
        choices.push({ id: choices.length + 1, text: match[1].trim() });
    }
    if (choices.length > 1) return choices;
    
    return [];
}
```

---

### 场景4: 修改打字机速度范围

**位置**: `src/ui/UIManager.js` 和 `src/ui/components/SettingsMenu.js`

```javascript
// UIManager.js - 更新 HTML 模板
<input type="range" min="5" max="200" value="50" ...>
//                   ↑修改这里

// SettingsMenu.js 无需修改（自动读取 min/max）
```

---

### 场景5: 添加新的存档字段

**位置**: `src/ui/components/SaveLoadMenu.js`

```javascript
async saveFullSave(slotName) {
    const gameData = {
        playIndex: this.state.playIndex,
        maxPlayIndex: this.state.maxPlayIndex,
        timestamp: Date.now(),
        characterName: this.adapter.getCurrentCharacterName(),
        
        // 添加新字段
        myCustomData: this.state.myNewVariable,
        userChoices: this.state.choiceHistory, // 假设你追踪选择历史
    };
    
    await this.saveManager.saveGame(slotName, gameData);
}

async loadFullSave(fileName) {
    const gameData = await this.saveManager.loadGame(fileName);
    
    if (gameData) {
        this.state.playIndex = gameData.playIndex || 0;
        this.state.maxPlayIndex = gameData.maxPlayIndex || 0;
        
        // 恢复新字段
        this.state.myNewVariable = gameData.myCustomData;
        this.state.choiceHistory = gameData.userChoices || [];
        
        // ... 触发重新渲染
    }
}
```

---

### 场景6: 修改背景图片切换逻辑

**位置**: `src/ui/components/DialogueBox.js`

**函数**: `updateBackground(imageUrl)`

当前逻辑：仅在 URL 不同时更新（避免闪烁）

**添加淡入淡出效果**:

```javascript
updateBackground(imageUrl) {
    const targetUrl = `url("${imageUrl}")`;
    const currentUrl = this.$bgLayer.css('background-image');
    
    if (!currentUrl || (!currentUrl.includes(encodeURI(imageUrl)) && !currentUrl.includes(imageUrl))) {
        // 添加淡出效果
        this.$bgLayer.fadeOut(200, () => {
            this.$bgLayer.css('background-image', targetUrl);
            this.$bgBlur.css('background-image', targetUrl);
            this.$bgLayer.fadeIn(300);
        });
    }
}
```

---

## 🎯 核心模块详解

### GameFlowController (大脑)

**职责**: 整个游戏的核心控制器

**关键方法**:

| 方法 | 说明 | 调用时机 |
|------|------|---------|
| `loadAllMessages()` | 加载所有消息到播放列表 | 游戏开始时 |
| `continueStory()` | 发送空消息继续剧情 | 用户点击Continue |
| `updateStreamingContent()` | 增量更新流式内容 | 每次收到token |
| `handleMessageReceived()` | 消息接收完成处理 | 流式传输结束 |
| `rebuildHistoryUntil()` | 重建历史到指定消息 | 流式传输开始前 |
| `enterActiveMode()` | 进入交互模式 | 到达播放列表末尾 |
| `checkForInteraction()` | 检查是否有选项或显示Continue | Active模式下 |

**状态变量**:
- `pendingGeneration`: 是否正在等待AI响应
- `streamingMessageId`: 当前流式传输的消息ID
- `streamingStartIndex`: 流式传输开始时的播放列表索引
- `resumePlayIndex`: 用于恢复播放进度

**修改建议**: 
- 不要直接修改此控制器，它协调其他模块
- 如需扩展功能，创建新控制器并在此注入

---

### StreamingController (流式传输控制器) - V10.0

**职责**: 管理流式传输过程中的Token缓冲和增量更新

**位置**: `index.js` 内嵌类 (lines 32-168)

**核心理念**: 从 "全量Context轮询" 转向 "Token级增量缓冲"

#### 架构对比

**旧方案 (updateStreamingContent)**:
```javascript
每次Token到达
  ↓
读取完整 context.chat[msgId].mes
  ↓
重新构建整个临时DOM
  ↓
完全替换 playList[startIndex:]
  ↓
触发完整 renderFrame()
```

**新方案 (StreamingController)**:
```javascript
每次Token到达
  ↓
bufferText += token (O(1) 字符串拼接)
  ↓
requestAnimationFrame 防抖
  ↓
processUpdate() (60fps 最多一次)
  ↓
仅构建增量DOM
  ↓
智能 syncUI (直接文本更新或显示Next)
```

#### 关键方法

| 方法 | 说明 | 调用时机 |
|------|------|----------|
| `start(msgId, startIndex)` | 初始化流式会话 | setupStreamingListeners开始时 |
| `onToken(token)` | 接收单个Token | 每次STREAM_TOKEN_RECEIVED事件 |
| `processUpdate()` | 执行增量解析和更新 | requestAnimationFrame回调 |
| `syncUI(newFrames)` | 智能同步UI状态 | processUpdate之后 |
| `stop()` | 结束流式会话 | MESSAGE_RENDERED事件 |

#### 生命周期

```javascript
// 1. 初始化
streamController.start(messageId, streamingStartIndex);
// 重置: bufferText = "", lastParsedLength = 0

// 2. Token累积
streamController.onToken("你");
streamController.onToken("好");
streamController.onToken("！");
// bufferText = "你好！"
// 触发 requestAnimationFrame

// 3. 帧更新 (下一个浏览器渲染帧)
processUpdate() 被调用
  → 构建临时DOM: <div class="mes">你好！</div>
  → buildPlaylist() 解析为 frames
  → playList = history.concat(newFrames)
  → syncUI() 更新界面

// 4. 智能UI同步
if (playIndex === playList.length - 1) {
    // 用户看的是最新帧 → 直接更新文本
    $('#gal-text-content').html(frame.text);
} else {
    // 用户落后 → 显示Next指示器
    $('#gal-next-indicator').addClass('visible');
}

// 5. 流式结束
streamController.stop();
  → cancelAnimationFrame()
  → 执行最后一次 processUpdate()
```

#### 核心API

**构造函数参数**:
```javascript
new StreamingController({
    get playList() { return playList; },
    setPlayList: (list) => { playList = list; },
    get playIndex() { return playIndex; },
    get characterAvatarUrl() { return characterAvatarUrl; },
    getCharacterName: getCharacterName,
    buildPlaylist: buildPlaylist
})
```

**访问器模式**: 使用 getter/setter 避免直接引用全局变量，保持封装性

#### syncUI 智能逻辑

```javascript
syncUI(newFrames) {
    const currentIndex = this.core.playIndex;
    const totalLength = this.core.playList.length;
    
    // 场景A: 用户在最新帧
    if (currentIndex >= this.startIndex && 
        currentIndex === totalLength - 1) {
        // 直接更新DOM文本，无需 renderFrame()
        const currentFrame = this.core.playList[currentIndex];
        $('#gal-text-content').html(
            currentFrame.text.replace(/\n/g, '<br>')
        );
        $('#gal-progress').text(`${currentIndex + 1}/${totalLength}`);
    }
    
    // 场景B: 新帧已生成，用户还在看旧帧
    if (currentIndex < totalLength - 1) {
        // 显示Next指示器，等待用户点击
        $('#gal-next-indicator').addClass('visible');
    }
}
```

#### 性能优化

**防抖机制 (Debouncing)**:
- 使用 `requestAnimationFrame` 而非 `setTimeout`
- 确保与浏览器渲染循环同步
- 最高频率：60fps (约16.7ms一次)
- 避免每个Token都触发DOM操作

**增量合并**:
```javascript
// 保持历史不变
const history = this.core.playList.slice(0, this.startIndex);

// 只替换当前生成部分
this.core.setPlayList(history.concat(newFrames));
```

**内存管理**:
- `bufferText` 在会话结束后自动清空
- 不保留中间状态，避免内存泄漏

#### 与旧系统对比

| 指标 | updateStreamingContent | StreamingController |
|------|------------------------|---------------------|
| Context读取 | 每次Token | 0次 (仅用Token) |
| DOM构建 | 完整重建 | 增量构建 |
| 更新频率 | 不定 (无防抖) | 最高60fps |
| UI闪烁 | 有 (完整重渲染) | 无 (直接文本更新) |
| CPU占用 | 高 | 低 (防抖优化) |
| 代码复杂度 | 低 | 中 (封装良好) |

#### 调试技巧

```javascript
// 查看Controller状态
console.log(streamController.isStreaming);
console.log(streamController.bufferText);

// 监控processUpdate调用
const originalProcessUpdate = streamController.processUpdate;
streamController.processUpdate = function() {
    console.log('[Debug] processUpdate called, buffer length:', this.bufferText.length);
    originalProcessUpdate.call(this);
};
```

#### Fallback机制

`updateStreamingContent` 函数仍保留在 `continueStory()` 的 fallback 逻辑中，用于兼容：
- 不支持 EventSource 的环境
- 事件系统初始化失败的情况

**触发条件**:
```javascript
if (!setupStreamingListeners(expectedMessageId)) {
    // Fallback to polling
    setInterval(() => {
        updateStreamingContent(expectedMessageId, false);
    }, 500);
}
```

#### 修改建议

✅ **可以修改**:
- `syncUI` 逻辑 (自定义UI更新行为)
- 防抖策略 (改用 `setTimeout` 或调整间隔)
- `processUpdate` 中的缓冲区处理

❌ **不建议修改**:
- 核心数据流 (start → onToken → processUpdate → stop)
- `core` API接口契约
- `buildPlaylist` 调用方式



### SaveManager (存档核心) - V3 独立文件策略

**架构**: Clone-Save Strategy（克隆保存策略）

**核心原理**:
1. 每个存档是**独立的 .jsonl 文件**
2. 文件名格式：`[GAL] Slot 1.jsonl`, `[GAL] Slot 2.jsonl` 等
3. 元数据寄生在 `chat[0].chat_metadata.gal_save_data`
4. 使用 ST 后端 API：`/api/chats/get`, `/api/chats/save`
5. 完整的 `playlistSnapshot` 快照，不依赖DOM重建

#### 存档文件结构

```
chats/
├── New Chat.jsonl              # 正常聊天
├── [GAL] Slot 1.jsonl          # 存档1 ✨
├── [GAL] Slot 2.jsonl          # 存档2 ✨
└── [GAL] Slot 3.jsonl          # 存档3 ✨
```

每个存档文件的第一条消息包含元数据：

```jsonl
{
  "name": "System",
  "mes": "Galgame Save: Slot 1",
  "chat_metadata": {
    "gal_save_data": {
      "_plugin": "sgal-mode",
      "_version": "3.0",
      "_saved_at": 1732685991000,
      "gameState": {
        "playIndex": 42,
        "maxPlayIndex": 145,
        "playlistSnapshot": [287帧完整剧本],
        "characterAvatar": "url",
        "typewriterSpeed": 50,
        "autoPlayDelay": 2000
      },
      "stats": {
        "totalFrames": 287,
        "totalMessages": 145
      }
    }
  }
}
```

#### 保存流程（三种情况）

```javascript
// === 情况1: 保存到新槽位 ===
用户点击"保存到Slot 1"（空槽位）
  ↓
读取当前聊天文件 (GET /api/chats/get)
  ↓
注入 GAL 元数据到 chatData[0].chat_metadata
  ↓
创建新文件 (POST /api/chats/save)
  file_name: "[GAL] Slot 1"
  chat: [完整的chatData + 元数据]
  ↓
✅ 独立存档文件创建成功

// === 情况2: 覆盖已有槽位 ===
用户点击"保存到Slot 2"（已有存档）
  ↓
读取当前聊天文件 (GET /api/chats/get)
  ↓
注入新的 GAL 元数据
  ↓
直接保存到 "[GAL] Slot 2" (覆盖旧文件)
  ↓
✅ 存档更新成功

// === 情况3: 原地保存（优化） ===
如果当前聊天已经是存档文件
  ↓
检测到 currentFile === "[GAL] Slot 1"
  ↓
跳过文件复制，直接更新元数据
```

#### 读取流程

```javascript
用户点击"读取Slot 1"
  ↓
SaveManager.loadGame("1")
  ↓
1. 主动读取文件内容 (GET /api/chats/get)
   {
     ch_name: "角色名",
     avatar_url: "avatar.png",
     file_name: "[GAL] Slot 1"
   }
  ↓
2. 提取元数据
   galData = chatData[0].chat_metadata.gal_save_data
  ↓
3. 设置待恢复状态
   window.GAL_PENDING_LOAD_STATE = galData.gameState
  ↓
4. 切换UI (STAdapter.loadChat)
   触发 ST 加载聊天文件
  ↓
5. 触发 gal:force-sync-ui 事件
  ↓
GameFlowController 监听到事件
  ↓
6. 检测到 GAL_PENDING_LOAD_STATE
  ↓
7. 直接使用 playlistSnapshot（不重建）
   state.playList = pendingState.playlistSnapshot
   state.playIndex = pendingState.playIndex
  ↓
8. 渲染正确的帧
  ↓
✅ 存档恢复成功，进度正确
```

#### CSRF Token 处理

```javascript
async _getAuthHeaders() {
    try {
        const res = await fetch('/csrf-token');
        const data = await res.json();
        return {
            'Content-Type': 'application/json',
            'X-CSRF-Token': data.token
        };
    } catch (e) {
        // Fallback to basic headers
        return { 'Content-Type': 'application/json' };
    }
}
```

#### 关键API方法

| 方法 | 功能 | API调用 |
|------|------|---------|
| `saveGame(slotId, gameState)` | 保存游戏 | POST /api/chats/save |
| `loadGame(slotId)` | 读取存档 | POST /api/chats/get |
| `listSaves()` | 列出所有存档 | POST /api/characters/chats |
| `checkSlot(slotId)` | 检查槽位状态 | 调用 listSaves() |
| `deleteSlot(slotId)` | 删除存档 | POST /api/chats/delete |

#### 修改存档内容

在 `SaveManager.saveGame()` 中修改 `galMetadata` 对象：

```javascript
const galMetadata = {
    _plugin: "sgal-mode",
    _version: "3.0",
    gameState: {
        playIndex: gameState.playIndex,
        playlistSnapshot: gameState.playList,
        
        // 🌟 添加你的自定义数据
        myCustomData: gameState.myNewVariable,
        userChoices: gameState.choiceHistory
    }
};
```

#### 注意事项

⚠️ **不要修改的部分**:
- `_getAuthHeaders()`: CSRF Token 获取逻辑
- `_getContextInfo()`: ST 上下文读取
- 文件名前缀 `[GAL] Slot ` 必须保持一致

✅ **可以修改的部分**:
- `galMetadata.gameState` 中的字段
- `FILE_PREFIX` (如果需要改变前缀)
- API超时时间和重试逻辑

⚡ **性能优化**:
- `playlistSnapshot` 可能很大（数百帧），保存时会略慢
- 读取时直接使用快照，跳过 DOM 解析，**速度更快**
- 建议限制 `playlistSnapshot.length` 在合理范围（< 1000帧）



---

### PlaylistEngine (解析引擎)

**职责**: 将 SillyTavern 的 DOM 消息解析为对话帧

**核心方法**: `buildPlaylist(msgElement, initialBg, messageIndex)`

**返回格式**:
```javascript
[
    {
        text: "清理后的文本",
        img: "背景图片URL",
        name: "角色名",
        isUser: false
    },
    // ...
]
```

**解析流程**:
1. `flattenDom()` 遍历 DOM 提取文本/图片/换行
2. 逐个处理 token，合并文本到 buffer
3. 遇到 `<br>` 或图片时，创建新帧
4. `parseCharacterName()` 检测 "角色名：" 格式
5. `removeNamePrefix()` 移除前缀
6. `cleanText()` 清理系统标记

**修改解析逻辑**:
- **过滤更多元素**: 修改 `flattenDom()` 中的 `nodeFilter`
- **改变分帧规则**: 修改 `buildPlaylist()` 中的 buffer 刷新时机
- **自定义名称格式**: 修改 `parseCharacterName()` 的正则表达式

---

## 🔌 SillyTavern 集成

### 事件系统

**位置**: `src/adapters/STEventHandler.js`

**核心事件**:
- `STREAM_TOKEN_RECEIVED`: 每次收到流式token
- `CHARACTER_MESSAGE_RENDERED`: 消息渲染完成

**使用示例**:
```javascript
// 在 GameFlowController 中
this.eventHandler.setupStreamingListeners(
    messageId,
    () => this.updateStreamingContent(messageId, false),  // onToken
    (receivedId) => this.handleMessageReceived(receivedId) // onComplete
);
```

**Fallback 机制**: 如果事件系统不可用，使用轮询 (`setupFallbackPolling`)

---

### Context API

**位置**: `src/adapters/STAdapter.js`

**关键方法**:

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getContext()` | Object | ST全局上下文 |
| `getCurrentCharacter()` | Object | 当前角色数据 |
| `getCurrentCharacterName()` | String | 角色名（sanitized） |
| `getCurrentCharacterAvatar()` | String | 角色头像URL |
| `getChat()` | Array | 当前聊天消息数组 |
| `sendMessage(text)` | Promise | 发送消息 |
| `isGenerating()` | Boolean | 是否正在生成 |

**多重Fallback**:
1. 优先从 `window.SillyTavern.getContext()`
2. 失败则从 DOM 读取 (`#avatar_url_pole`, `#character_name_div`)
3. 都失败则返回默认值

---

## 🐛 调试指南

### 浏览器控制台调试

```javascript
// 查看当前状态
GAL_DEBUG.state.getState()

// 查看播放列表
GAL_DEBUG.getPlayList()

// 查看当前播放位置
GAL_DEBUG.getPlayIndex()

// 手动更新流式内容
GAL_DEBUG.gameFlow.updateStreamingContent(messageId)

// 跳转到指定帧
GAL_DEBUG.navigation.jumpTo(42)

// 检测文本中的选项
GAL_DEBUG.choice.detectChoices("文本内容")
```

### 常见问题定位

#### 1. "按钮不响应"
**检查**: `src/ui/components/ControlPanel.js` 的事件绑定

```javascript
// 在浏览器控制台
$('#gal-prev-btn').off('click').on('click', () => console.log('按钮被点击'));
```

#### 2. "存档失败"
**检查**: CSRF Token 是否获取成功

```javascript
// 在浏览器控制台
fetch('/csrf-token').then(r => r.json()).then(console.log)
```

#### 3. "流式传输不更新"
**检查**: 事件系统是否初始化

```javascript
// 在浏览器控制台
console.log(window.SillyTavern.eventSource);
console.log(window.SillyTavern.event_types);
```

#### 4. "选项不显示"
**检查**: `ChoiceController.detectChoices()` 是否匹配

```javascript
// 测试选项检测
GAL_DEBUG.choice.detectChoices("测试文本「选项A」「选项B」");
```

---

## 📝 代码规范

### 命名约定

- **类名**: PascalCase (`GameFlowController`)
- **方法名**: camelCase (`loadAllMessages`)
- **私有方法**: 下划线前缀 (`_getAuthHeaders`)
- **常量**: UPPER_SNAKE_CASE (`SAVE_KEY_PREFIX`)
- **jQuery对象**: 美元符号前缀 (`$dialogueBox`)

### 注释规范

```javascript
/**
 * 多行注释用于方法说明
 * @param {string} text - 参数说明
 * @returns {Array} 返回值说明
 */
function detectChoices(text) {
    // 单行注释用于逻辑说明
    const pattern = /regex/;
}
```

### 错误处理

```javascript
try {
    // 操作
} catch (error) {
    console.error('[ModuleName] Error message:', error);
    // 降级处理或用户提示
}
```

---

## 🚀 扩展建议

### 添加新UI组件

1. 在 `src/ui/components/` 创建新文件
2. 实现 `initialize()` 方法
3. 在 `main.js` 中导入并实例化
4. 在 `UIManager` 中注入到 `components` 对象

### 添加新控制器

1. 在 `src/controllers/` 创建新文件
2. 通过构造函数接收依赖
3. 在 `main.js` 中创建实例并注入依赖
4. 在需要的地方调用控制器方法

### 添加新服务

1. 在 `src/services/` 创建新文件
2. 实现服务接口
3. 在 `main.js` 中实例化
4. 注入到需要的组件/控制器

---

## ⚠️ 注意事项

### 不要做的事

❌ **不要直接修改 StateManager 的状态**
```javascript
// 错误
stateManager.playIndex = 10;

// 正确
stateManager.updateState({ playIndex: 10 });
```

❌ **不要跳过依赖注入直接创建实例**
```javascript
// 错误（在模块内部）
const adapter = new STAdapter();

// 正确（在 main.js 中创建，然后注入）
constructor(stAdapter) { this.adapter = stAdapter; }
```

❌ **不要在 UI 组件中直接调用业务逻辑**
```javascript
// 错误
class DialogueBox {
    onClick() {
        // 直接调用 GameFlowController
    }
}

// 正确（通过回调）
class DialogueBox {
    initialize(onClick) {
        this.$element.on('click', onClick);
    }
}
```

### 必须做的事

✅ **所有异步操作都要有错误处理**

✅ **修改状态后触发相应的UI更新**

✅ **新增功能要更新 DEVELOPER_GUIDE.md**

✅ **重大修改要备份 `index.js.backup`**

---

## 📞 快速参考

### 修改流程检查清单

- [ ] 确定要修改的功能
- [ ] 找到对应的模块文件
- [ ] 查看模块的依赖注入
- [ ] 实现修改
- [ ] 在 `main.js` 中检查依赖是否正确注入
- [ ] 使用 `GAL_DEBUG` 测试
- [ ] 更新本文档（如有必要）

### 文件快速定位

| 功能 | 文件 |
|------|------|
| 入口/依赖注入 | `src/main.js` |
| 游戏总控逻辑 | `src/controllers/GameFlowController.js` |
| **流式传输控制** | **`index.js` (StreamingController class)** |
| 状态管理 | `src/core/StateManager.js` |
| 服务端存档 | `src/services/SaveManager.js` |
| 本地存档 | `src/services/LocalStorageService.js` |
| 对话框渲染 | `src/ui/components/DialogueBox.js` |
| 存档UI | `src/ui/components/SaveLoadMenu.js` |
| 选项系统 | `src/controllers/ChoiceController.js` |
| DOM解析 | `src/core/PlaylistEngine.js` |
| ST集成 | `src/adapters/STAdapter.js` |

---

## 📚 相关文档

- `implementation_plan.md`: 详细的实现计划
- `walkthrough.md`: 完整的测试清单和故障排除
- `task.md`: 开发任务清单

---

**最后更新**: 2025-11-28  
**版本**: v10.0 - StreamingController Refactoring  
**新增**: StreamingController 流式传输架构重构  
**架构版本**: V9.0 (Modular + Independent Save System)  
**维护者**: AI Assistant

---

**祝你编码愉快！如有疑问，查看本文档或使用 `GAL_DEBUG` 调试接口。**

