# Sgal-mode 更新日志 (2024-12-24)

## 主要修复

### 1. Continue 按钮点击后回跳问题 ✅
**问题**: 点击"Continue Story"后，playIndex 会回跳到前面的帧
**原因**: 
- `expectedMessageId` 计算错误（使用 `ctx.chat.length - 1` 而不是 `ctx.chat.length`）
- `rebuildHistoryUntil` 在 `sendMessage` 之后调用，此时 DOM 状态已改变

**修复** (`GameFlowController.js`):
- 修正 `expectedMessageId = ctx.chat.length`（新消息的正确索引）
- 在 `continueStory()` 中，**发送消息前**保存播放列表状态
- 移除 `setupStreamingListeners` 中的 `rebuildHistoryUntil` 调用

### 2. 点击屏幕导致重复帧问题 ✅
**问题**: 点击继续后，再点击屏幕会导致帧数翻倍
**原因**: `UIManager.setupScreenClickHandler` 中在生成期间调用 `updateStreamingContent(ctx.chat.length - 1)`

**修复** (`UIManager.js`):
- 移除点击处理器中对 `updateStreamingContent` 的直接调用
- 改为只刷新进度指示器和检查是否有新帧可翻页

### 3. playIndex 越界显示问题 ✅
**问题**: 显示如 96/94 这样的无效帧索引

**修复** (`GameFlowController.js`):
- 在 `handleMessageReceived` 中添加边界检查
- 在 `renderCurrentFrame` 中添加边界保护

## 新增功能

### 4. 加载指示器 ✅
**功能**: 点击"Continue"或选项后显示加载动画，直到新内容可用

**实现**:
- `UIManager.js`: 添加 `#gal-loading-overlay` HTML
- `style.css`: 添加加载动画 CSS（旋转圆环 + "Generating... / 生成中..."文字）
- `GameFlowController.continueStory()`: 开始时显示加载
- `GameFlowController.updateStreamingContent()`: 有新帧时隐藏
- `GameFlowController.handleMessageReceived()`: 完成时隐藏
- `ChoiceController.selectChoice()`: 选择选项时显示加载

### 5. 思维链(CoT)检测 ✅
**功能**: 加载指示器在检测到思维链内容时保持显示，直到正文出现

**实现** (`GameFlowController._isThinkingContent()`):
- 检测 `<thinking>...</thinking>` 和 `<think>...</think>` 标签
- 只有当闭标签后有实际内容时才隐藏加载

## 修复的样式问题

### 6. 存档/读档菜单不显示 ✅
**问题**: 从备份恢复 CSS 后，存档菜单样式丢失

**修复**:
- 添加 `.gal-menu-overlay` 及相关样式到 `style.css`
- 修改 `SaveLoadMenu.js`：将菜单添加到 `#gal-overlay` 内部而非 `body`

## 修改的文件列表

1. `src/controllers/GameFlowController.js` - 主要流程控制修复
2. `src/controllers/ChoiceController.js` - 添加加载指示器
3. `src/ui/UIManager.js` - 添加加载指示器HTML，修复点击处理器
4. `src/ui/components/SaveLoadMenu.js` - 修复菜单层级
5. `style.css` - 添加加载动画和存档菜单样式
