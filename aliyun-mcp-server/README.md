# 阿里云 MCP Server

让 AI 工具（VS Code Copilot 等）直接管理和操作阿里云服务器。

## 功能

### 🔑 SSH 服务器操作
| 工具 | 说明 |
|------|------|
| `ssh_exec` | 在远程服务器执行任意 Shell 命令 |
| `ssh_upload` | 上传文件到远程服务器 |
| `ssh_list_hosts` | 列出 SSH config 中配置的服务器 |

### ☁️ 阿里云资源管理（需安装 aliyun CLI）
| 工具 | 说明 |
|------|------|
| `aliyun_ecs_list` | 列出 ECS 实例 |
| `aliyun_ecs_start/stop/reboot` | 启停重启实例 |
| `aliyun_ecs_describe` | 查看实例详情 |
| `aliyun_oss_list` | 查看 OSS 文件 |
| `aliyun_rds_list` | 列出 RDS 实例 |
| `aliyun_monitor` | 查询 CPU/内存/磁盘监控 |
| `aliyun_billing` | 查询账单 |
| `aliyun_cli` | 执行任意 aliyun 命令 |

## 前提条件

### 1. SSH 配置（服务器操作）
在 `~/.ssh/config` 中配置服务器：

```ssh-config
Host my-server
    HostName 123.123.123.123
    User root
    Port 22
    IdentityFile ~/.ssh/id_rsa
```

### 2. 阿里云 CLI（云资源管理）
```bash
# 安装
curl -fsSL https://aliyuncli.alicdn.com/install.sh | sh

# 配置凭证
aliyun configure
# 输入你的 AccessKey ID 和 Secret
```

## VS Code 配置

在 `.vscode/mcp.json` 或 VS Code 设置中添加：

```json
{
  "mcp": {
    "servers": {
      "aliyun": {
        "command": "node",
        "args": ["/Users/andymacbook/Documents/code/ai_exploration/aliyun-mcp-server/dist/index.js"],
        "env": {
          "ALIYUN_REGION": "cn-hangzhou"
        }
      }
    }
  }
}
```

或者通过 VS Code 的 `mcp.json` 配置：

`/Users/andymacbook/Documents/code/ai_exploration/.vscode/mcp.json`:

```json
{
  "servers": {
    "aliyun": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/aliyun-mcp-server/dist/index.js"],
      "env": {
        "ALIYUN_REGION": "cn-hangzhou"
      }
    }
  }
}
```

## 安装与启动

```bash
# 进入项目目录
cd aliyun-mcp-server

# 安装依赖
npm install

# 构建
npm run build

# 开发模式（热重载）
npm run dev
```

## 使用示例

### 通过 AI 操作服务器
```
"帮我部署项目到服务器"
→ AI 调用 ssh_exec 连接服务器执行部署命令

"检查服务器运行状态"
→ AI 调用 ssh_exec 执行 top, df -h 等命令

"查看 ECS 实例列表"
→ AI 调用 aliyun_ecs_list 列出所有实例

"重启这台服务器"
→ AI 调用 aliyun_ecs_reboot 重启实例

"上传配置文件"
→ AI 调用 ssh_upload 上传文件
```

### 常用运维命令
```
# 查看系统状态
ssh_exec → top -bn1 | head -20
ssh_exec → df -h
ssh_exec → free -m
ssh_exec → netstat -tlnp

# 查看日志
ssh_exec → tail -100 /var/log/nginx/access.log

# 部署更新
ssh_exec → cd /app && git pull && npm run build && pm2 restart all
```
