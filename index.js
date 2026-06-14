#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import https from 'https';


export function getConfigPath() {
  return path.join(os.homedir(), '.claudenotify.json');
}

export function loadConfig(configPath = getConfigPath()) {
  const defaultConfig = {
    tokens: []
  };
  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : (parsed.token ? [parsed.token] : [])
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(configPath = getConfigPath(), config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

export function handleConfigCommand(args, configPath = getConfigPath()) {
  const config = loadConfig(configPath);
  const subCommand = args[0];

  if (subCommand === 'add-token') {
    const token = args[1];
    if (!token) {
      console.error('错误: 请指定要添加的完整 Bark URL (需包含 http/https)');
      process.exit(1);
    }
    if (config.tokens.includes(token)) {
      console.log('Token 已存在于配置中。');
    } else {
      config.tokens.push(token);
      saveConfig(configPath, config);
      console.log(`成功添加设备: ${token}`);
    }
  } else if (subCommand === 'remove-token') {
    const token = args[1];
    if (!token) {
      console.error('错误: 请指定要移除的 Token');
      process.exit(1);
    }
    const index = config.tokens.indexOf(token);
    if (index === -1) {
      console.log('配置中未找到该设备。');
    } else {
      config.tokens.splice(index, 1);
      saveConfig(configPath, config);
      console.log(`成功移除设备: ${token}`);
    }
  } else if (subCommand === 'list') {
    console.log('当前配置如下:');
    console.log('通知设备列表 (tokens):');
    if (config.tokens.length === 0) {
      console.log('  (无已配置的设备)');
    } else {
      config.tokens.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    }
  } else {
    console.log('用法: node index.js config [add-token|remove-token|list]');
  }
}

export function parsePayload(data, clientName = 'Claude') {
  let displayName = 'Claude Code';
  if (clientName && clientName.toLowerCase() === 'codex') {
    displayName = 'Codex';
  } else if (clientName && clientName.toLowerCase() === 'claude') {
    displayName = 'Claude Code';
  } else if (clientName) {
    displayName = clientName;
  }

  const defaultTitle = `${displayName} 通知`;
  const defaultBody = '会话已停下，等待您的输入。';

  if (!data || data.trim() === '') {
    return { title: defaultTitle, body: defaultBody };
  }

  try {
    const parsed = JSON.parse(data);
    const event = parsed.event || parsed.hook_event_name || '';

    // 处理 Claude Code 与 Codex 常见的事件格式
    if (event === 'Notification') {
      const msg = parsed.last_assistant_message || (parsed.notification && parsed.notification.message) || parsed.message || '等待您的进一步指令。';
      return {
        title: `⚠️ ${displayName} 等待授权`,
        body: msg
      };
    } else if (event === 'Stop') {
      const msg = parsed.last_assistant_message || parsed.message || '当前开发任务执行完毕。';
      return {
        title: `🤖 ${displayName} 任务已完成`,
        body: msg
      };
    } else if (event === 'SessionStart') {
      return {
        title: `🚀 ${displayName} 会话已启动`,
        body: '会话已初始化就绪。'
      };
    }

    // 存在自定义 message 或 last_assistant_message 的其他 JSON 结构
    if (parsed.last_assistant_message || parsed.message) {
      return { title: defaultTitle, body: parsed.last_assistant_message || parsed.message };
    }

    return { title: defaultTitle, body: data };
  } catch {
    // 无法解析为 JSON，则退回到纯文本模式
    return { title: defaultTitle, body: data.trim() };
  }
}

export function readStdin(timeoutMs = 100) {
  return new Promise((resolve) => {
    let data = '';
    let hasData = false;

    const timer = setTimeout(() => {
      if (!hasData) {
        cleanup();
        resolve('');
      }
    }, timeoutMs);

    function onData(chunk) {
      hasData = true;
      data += chunk;
    }

    function onEnd() {
      cleanup();
      resolve(data);
    }

    function cleanup() {
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
    }

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });
}

export function getLatestJsonlFile(baseDir) {
  if (!fs.existsSync(baseDir)) return null;

  let latestFile = null;
  let latestMtime = 0;

  function traverse(dir) {
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile() && file.endsWith('.jsonl')) {
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs;
          latestFile = fullPath;
        }
      }
    }
  }

  traverse(baseDir);
  return latestFile;
}

export function extractLastMessageFromJsonl(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    // 从后往前查找 AI / assistant 的消息
    for (let i = lines.length - 1; i >= 0; i--) {
      const parsed = JSON.parse(lines[i]);

      const role = (parsed.role || parsed.speaker || '').toLowerCase();
      if (role === 'assistant' || role === 'model' || parsed.type === 'PLANNER_RESPONSE' || parsed.type === 'assistant') {
        let text = parsed.content || parsed.text || parsed.message;

        // 处理 Claude Code 日志中 message.content 是数组的情况
        if (parsed.message && parsed.message.content && Array.isArray(parsed.message.content)) {
          const textObj = parsed.message.content.find(item => item.type === 'text');
          if (textObj && textObj.text) {
            return textObj.text.trim();
          }
        }

        if (text && typeof text === 'string') {
          return text.trim();
        }
        if (text && Array.isArray(text)) {
          const textObj = text.find(item => item.type === 'text');
          if (textObj && textObj.text) {
            return textObj.text.trim();
          }
        }
      }

      // 备选 fallback
      if (i === lines.length - 1 || i === lines.length - 2) {
        const fallbackText = parsed.content || parsed.text || parsed.message;
        if (fallbackText && typeof fallbackText === 'string') {
          return fallbackText.trim();
        }
      }
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

export function tryGetLastAssistantMessage(clientName, customHomePath = null) {
  const isCodex = clientName && clientName.toLowerCase() === 'codex';
  const home = customHomePath || os.homedir();
  const baseDir = isCodex
    ? path.join(home, '.codex', 'sessions')
    : path.join(home, '.claude', 'projects');

  const latestFile = getLatestJsonlFile(baseDir);
  if (latestFile) {
    const lastMsg = extractLastMessageFromJsonl(latestFile);
    if (lastMsg) {
      if (lastMsg.length > 200) {
        return lastMsg.substring(0, 200) + '...';
      }
      return lastMsg;
    }
  }
  return null;
}

export function buildBarkUrl(token, title, body) {
  const cleanToken = token.replace(/\/+$/, '');
  return `${cleanToken}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=claudenotify`;
}

export function sendHttpGet(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https://') ? https : http;

    const req = client.get(url, { timeout: 5000 }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body: rawData });
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request Timeout (5s)' });
    });
  });
}

export async function sendBarkNotification(config, title, body) {
  if (!config.tokens || config.tokens.length === 0) {
    console.warn('警告: 未配置任何设备 Token，跳过通知发送。');
    return [];
  }

  const promises = config.tokens.map(async (token) => {
    const url = buildBarkUrl(token, title, body);
    const res = await sendHttpGet(url);
    return { token, ...res };
  });

  return Promise.all(promises);
}

// 区分 CLI 执行与模块导入
if (process.argv[1] && (process.argv[1] === path.resolve('index.js') || process.argv[1].endsWith('index.js'))) {
  const args = process.argv.slice(2);
  if (args[0] === 'config') {
    handleConfigCommand(args.slice(1));
  } else if (args[0] === 'test') {
    const config = loadConfig();
    console.log('正在向所有已配置的设备发送测试通知...');
    sendBarkNotification(config, 'claudenotify 测试', '这是一条测试通知')
      .then((results) => {
        results.forEach((r) => {
          if (r.success) {
            console.log(`设备 [${r.token}] 发送成功`);
          } else {
            console.error(`设备 [${r.token}] 发送失败: ${r.error || `HTTP ${r.statusCode}`}`);
          }
        });
      });
  } else {
    // 默认读取 stdin
    let clientName = 'Claude';
    const clientIndex = args.indexOf('--client');
    if (clientIndex !== -1 && args[clientIndex + 1]) {
      clientName = args[clientIndex + 1];
    }

    readStdin(100).then(async (data) => {
      let { title, body } = parsePayload(data, clientName);

      // 如果 body 属于默认的空通知正文，尝试从日志文件中读取“最后一句话”
      const isDefault = body === '会话已停下，等待您的输入。' || body === '当前开发任务执行完毕。';

      if (isDefault) {
        const lastLogMessage = tryGetLastAssistantMessage(clientName);
        if (lastLogMessage) {
          body = lastLogMessage;
        }
      }

      const config = loadConfig();
      const results = await sendBarkNotification(config, title, body);

      // 只将错误输出到 stderr，以免干扰 hook 本身
      results.forEach((r) => {
        if (!r.success) {
          console.error(`claudenotify 推送失败 [${r.token}]: ${r.error || `HTTP ${r.statusCode}`}`);
        }
      });
    });
  }
}
