# claudenotify 配置向导

请引导用户完成 Bark 推送通知的配置。按以下步骤执行：

1. 先运行以下命令检查当前已有配置：
```bash
node "${CLAUDE_PLUGIN_ROOT}/index.js" config list
```

2. 询问用户输入 Bark 推送地址（Token URL）。告诉用户格式示例：
   - 官方服务：`https://api.day.app/你的TokenID`
   - 私有服务：`http://你的服务器IP:端口/你的TokenID`

3. 用户提供地址后，运行以下命令添加：
```bash
node "${CLAUDE_PLUGIN_ROOT}/index.js" config add-token <用户提供的地址>
```

4. 询问用户是否还要添加更多设备，如果是则重复步骤 2-3。

5. 所有设备添加完毕后，运行测试命令验证推送是否正常：
```bash
node "${CLAUDE_PLUGIN_ROOT}/index.js" test
```

6. 告知用户配置结果。如果测试通知发送成功，说明配置已完成。配置文件保存在 `~/.claudenotify.json`。
