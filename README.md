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

这是最简单、最鲁棒的安装方式。Claude Code 会自动拉取插件并在本地注册 Hook，省去手动编写路径的繁琐配置。

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

---

## 常用验证与管理命令

在工具根目录下，您可以通过 node 运行以下辅助管理指令：
*   `node index.js test`：向所有配置的设备发送一条测试消息，用以验证连通性。
*   `node index.js config list`：列出当前已加载的配置与通知设备。
*   `node index.js config add-token <token-or-url>`：快速向配置文件添加一个新的 Bark Token 或完整通知 URL。
*   `node index.js config remove-token <token-or-url>`：从配置文件中移除指定的设备。

