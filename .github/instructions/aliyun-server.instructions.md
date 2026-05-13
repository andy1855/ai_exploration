---
name: aliyun-server
description: '处理阿里云服务器相关的任务。Use when: 用户要求操作阿里云服务器、ECS、部署到服务器、SSH、查看服务器状态、管理云资源。'
applyTo: "**/*"
---

# 阿里云服务器操作指南

## 可用工具

本 workspace 配置了 **阿里云 MCP Server**，提供以下能力：

### 🔑 SSH 工具（需先配置 SSH）
| 工具 | 用途 |
|------|------|
| `ssh_exec` | 在远程服务器执行 Shell 命令 |
| `ssh_upload` | 上传文件到远程服务器 |
| `ssh_list_hosts` | 列出已配置的服务器 |

### ☁️ 阿里云 CLI 工具（需安装 aliyun CLI）
| 工具 | 用途 |
|------|------|
| `aliyun_ecs_list` | 列出/过滤 ECS 实例 |
| `aliyun_ecs_start/stop/reboot` | 启停重启实例 |
| `aliyun_ecs_describe` | 查看实例详情 |
| `aliyun_oss_list` | 查看 OSS 存储 |
| `aliyun_rds_list` | 列出 RDS 实例 |
| `aliyun_monitor` | 查询监控指标 |
| `aliyun_billing` | 查询账单 |
| `aliyun_cli` | 执行任意 CLI 命令 |

## 常见场景操作流程

### 部署代码到服务器
1. 先用 `ssh_list_hosts` 查看可用服务器
2. 用 `ssh_exec` 在服务器上执行部署命令（git pull、构建、重启服务）
3. 如需上传文件，用 `ssh_upload`

### 排查服务器问题
1. `ssh_exec` → `top -bn1 | head -20` 查看 CPU/内存
2. `ssh_exec` → `df -h` 查看磁盘
3. `ssh_exec` → `free -m` 查看内存
4. `ssh_exec` → `systemctl status nginx` 查看服务状态

### 查看日志
`ssh_exec` → `tail -n 200 /var/log/nginx/access.log`

### 管理云资源
- 用 `aliyun_ecs_list` 查看所有实例
- 用 `aliyun_ecs_describe` 查看详情
- 用 `aliyun_monitor` 查看 CPU/内存监控

## 注意事项
- SSH 操作需先在 `~/.ssh/config` 中配置服务器
- 阿里云 CLI 操作需先安装并配置：`aliyun configure`
- 敏感操作（停止/重启实例）前先确认用户意图
