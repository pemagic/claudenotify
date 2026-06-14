# claudenotify

`claudenotify` 是一个为 Claude Code 与 Codex 打造的通用推送通知集成工具。当 AI 会话因任务完成（Stop）、等待授权（Notification）或启动（SessionStart）而停顿时，它会自动向您配置的多个 Bark 设备发送推送。

项目采用纯原生 Node.js 实现，**零外部依赖**，具备极快的启动速度。

## 功能特性

1.  **自动内容提取**：优先从 Claude Code 传入的载荷中提取 `last_assistant_message`，若载荷为空，则自动嗅探最近的会话日志（.jsonl），确保通知包含任务摘要。
2.  **精简配置**：直接配置完整的 Bark URL，支持多设备并发推送。
3.  **智能事件解析**：自动区分“任务完成”、“等待授权”和“会话启动”状态。

---

## 快速安装与集成

### 方式一：通过 Claude Code 插件市场一键安装（推荐）

这是最简单、最推荐的安装方式。通过添加 Marketplace 仓库，Claude Code 会自动解析并从 npm 官方源安全拉取 `@pemagic/claudenotify` 并在本地注册 Hook，无需配置 GitHub SSH 密钥权限。

1.  **添加插件市场**
    在 Claude Code 的交互式会话中运行以下命令，将本项目作为 Marketplace 添加：
    ```bash
    /plugin marketplace add pemagic/claudenotify
    ```
2.  **一键安装插件**
    运行以下命令安装并启用 `claudenotify`：
    ```bash
    /plugin install claudenotify
    ```
3.  **配置通知设备**
    创建或编辑全局家目录下的配置文件：`~/.claudenotify.json` (Windows 系统通常为 `C:\Users\<您的用户名>\.claudenotify.json`)。
    将以下内容复制进去，替换为您自己的 Bark 完整通知 URL（支持配置多个设备）：
    ```json
    {
      "tokens": [
        "https://api.day.app/your_token_1",
        "https://your.private.server/token_2"
      ]
    }
    ```

---

### 方式二：手动挂载集成（适用于 Codex 或自定义配置）

如果您使用 Codex，或者希望手动挂载本地脚本，请按照以下步骤配置：

#### 1. 配置通知设备
同样按照上述步骤 3 创建 `~/.claudenotify.json` 配置文件。

#### 2. 集成到 Claude Code
编辑您的 Claude Code 全局配置文件 `~/.claude/settings.json`。在 `hooks` 段中加入以下配置（注意将 `C:/path/to/claudenotify/index.js` 替换为插件在您本机的真实绝对路径，Windows 系统请注意使用正斜杠 `/`）：
```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/path/to/claudenotify/index.js --client claude"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/path/to/claudenotify/index.js --client claude"
          }
        ]
      }
    ]
  }
}
```

#### 3. 集成到 Codex
1.  在全局配置 `~/.codex/config.toml` 中启用 hook：
    ```toml
    [features]
    codex_hooks = true
    ```
2.  在 `~/.codex/hooks.json` 中配置挂载（同样替换为本地脚本的绝对路径）：
    ```json
    {
      "hooks": {
        "Notification": [
          {
            "hooks": [
              {
                "type": "command",
                "command": "node C:/path/to/claudenotify/index.js --client codex"
              }
            ]
          }
        ],
        "Stop": [
          {
            "hooks": [
              {
                "type": "command",
                "command": "node C:/path/to/claudenotify/index.js --client codex"
              }
            ]
          }
        ]
      }
    }
    ```

## 配置管理与验证指令

当您完成插件安装后，有以下两种方式来添加或管理您的 Bark 推送设备：

### 方式一：使用内置的命令行工具（推荐）

本工具提供了一套便捷的 CLI 命令行用于管理配置。

#### 1. (可选) 注册全局命令
如果您希望可以直接在终端中输入 `claudenotify` 进行管理，可以直接全局安装此包：
```bash
npm install -g @pemagic/claudenotify
```
如果您在本地克隆了本仓库进行开发，也可以在项目目录下运行：
```bash
npm link
```

#### 2. 配置管理命令
注册或链接后，您可以在终端直接使用以下命令进行配置：
*   **添加通知设备**（支持官方 Token ID 或自定义私有 Bark 服务端的完整 URL）：
    ```bash
    claudenotify config add-token <Bark-Token-或完整URL>
    ```
*   **移除通知设备**：
    ```bash
    claudenotify config remove-token <Bark-Token-或完整URL>
    ```
*   **列出当前已配置的设备**：
    ```bash
    claudenotify config list
    ```
*   **发送测试通知（验证连通性）**：
    ```bash
    claudenotify test
    ```

---

### 方式二：手动编辑配置文件

这也是最直接有效的方式，适合不需要使用命令行的用户。

直接创建或编辑您全局家目录下的隐藏配置文件：`~/.claudenotify.json` (Windows 系统通常为 `C:\Users\<您的用户名>\.claudenotify.json`)。

格式模版：
```json
{
  "tokens": [
    "https://api.day.app/YOUR_BARK_TOKEN_1",
    "http://10.0.0.5:19902/YOUR_BARK_TOKEN_2"
  ]
}
```
保存该文件后配置即刻在后台生效，插件在触发 Hook 时会自动加载最新写入的设备列表。
