#!/usr/bin/env node

/**
 * 阿里云 MCP Server
 * ===================
 * 让 AI 工具通过两种方式处理阿里云服务器：
 *  1. SSH 连接 — 直接登录服务器执行命令
 *  2. 阿里云 CLI — 管理云资源（ECS、OSS、RDS、监控、账单）
 *
 * 环境变量:
 *  ALIYUN_REGION - 默认地域（默认 cn-hangzhou）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync, exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const execAsync = promisify(exec);
const ALIYUN_REGION = process.env.ALIYUN_REGION || "cn-hangzhou";
const SSH_DIR = join(homedir(), ".ssh");
const SSH_CONFIG_PATH = join(SSH_DIR, "config");
const COMMON_KEYS = ["id_rsa", "id_ed25519", "id_ecdsa"];

// ============================================================
// 工具函数
// ============================================================

function hasAliyunCLI(): boolean {
  try { execSync("which aliyun", { encoding: "utf-8" }); return true; }
  catch { return false; }
}

async function runAliyunCLI(cmd: string, params: Record<string, string> = {}): Promise<string> {
  const args = Object.entries(params)
    .map(([k, v]) => `--${k} "${v}"`)
    .join(" ");
  const command = `aliyun ${cmd} ${args} --region ${ALIYUN_REGION}`;
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000, maxBuffer: 1024 * 1024 * 10 });
    if (stderr) console.error("aliyun CLI stderr:", stderr);
    return stdout || "(空结果)";
  } catch (error: any) {
    throw new Error(`阿里云 CLI 执行失败: ${error.stderr || error.message}\n命令: ${command}`);
  }
}

/** 判断 host 是否匹配 SSH config 中的 Host 别名 */
function isSSHHostAlias(host: string): boolean {
  if (!existsSync(SSH_CONFIG_PATH)) return false;
  const config = readFileSync(SSH_CONFIG_PATH, "utf-8");
  const regex = /^Host\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(config)) !== null) {
    const names = match[1]!.split(/\s+/);
    for (const name of names) {
      // 支持精确匹配和通配符匹配
      const pattern = name.trim().replace(/\*/g, ".*").replace(/\?/g, ".");
      if (new RegExp(`^${pattern}$`).test(host)) return true;
    }
  }
  return false;
}

/** 查找第一个可用的 SSH 密钥文件 */
function findSSHKey(): string | null {
  // 先从 SSH config 中找 IdentityFile
  if (existsSync(SSH_CONFIG_PATH)) {
    const config = readFileSync(SSH_CONFIG_PATH, "utf-8");
    const keyMatch = config.match(/IdentityFile\s+(.+)/g);
    if (keyMatch) {
      for (const line of keyMatch) {
        const path = line.split(/\s+/)[1]?.trim().replace(/^~/, homedir());
        if (path && existsSync(path)) return path;
      }
    }
  }
  // 再尝试常见密钥文件名
  for (const key of COMMON_KEYS) {
    const keyPath = join(SSH_DIR, key);
    if (existsSync(keyPath)) return keyPath;
  }
  return null;
}

async function runSSHCommand(host: string, command: string, options: { username?: string; port?: number } = {}): Promise<string> {
  const isAlias = isSSHHostAlias(host);

  let sshCmd: string;
  if (isAlias) {
    // 使用 SSH config 中的 Host 别名——自动继承配置的用户、端口、密钥
    sshCmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${host} ${JSON.stringify(command)}`;
  } else {
    // 手动构造连接
    const user = options.username || "root";
    const port = options.port || 22;
    const keyPath = findSSHKey();
    const keyOpt = keyPath ? `-i ${keyPath}` : "";
    sshCmd = `ssh ${keyOpt} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${user}@${host} ${JSON.stringify(command)}`;
  }

  try {
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 10 });
    if (stderr) console.error("SSH stderr:", stderr);
    return stdout || "(无输出)";
  } catch (error: any) {
    throw new Error(`SSH 执行失败: ${error.stderr || error.message}\n主机: ${host}`);
  }
}

function getSSHHosts(): string[] {
  if (!existsSync(SSH_CONFIG_PATH)) return [];
  const config = readFileSync(SSH_CONFIG_PATH, "utf-8");
  const hosts: string[] = [];
  const regex = /^Host\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(config)) !== null) {
    const host = match[1]!.trim();
    if (!host.includes("*") && !host.includes("?")) hosts.push(host);
  }
  return hosts;
}

// ============================================================
// MCP Server (使用 McpServer 高阶 API)
// ============================================================

const server = new McpServer(
  { name: "aliyun-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ========================
// SSH 工具
// ========================

server.tool(
  "ssh_exec",
  "通过 SSH 在远程服务器上执行 Shell 命令",
  {
    host: z.string().describe("服务器 IP、域名 或 SSH config 中的 Host 别名"),
    command: z.string().describe("要执行的 Shell 命令"),
    username: z.string().optional().default("root").describe("SSH 用户名"),
    port: z.number().optional().default(22).describe("SSH 端口"),
    description: z.string().optional().describe("命令用途说明"),
  },
  async (args) => {
    const desc = args.description || args.command;
    const output = await runSSHCommand(args.host, args.command, { username: args.username, port: args.port });
    return { content: [{ type: "text", text: `📋 ${desc}\n🖥️ ${args.host}\n\n${output}` }] };
  }
);

server.tool(
  "ssh_upload",
  "通过 SCP 上传本地文件到远程服务器",
  {
    host: z.string().describe("服务器 IP/域名"),
    localPath: z.string().describe("本地文件路径"),
    remotePath: z.string().describe("远程目标路径"),
    username: z.string().optional().default("root").describe("SSH 用户名"),
    port: z.number().optional().default(22).describe("SSH 端口"),
  },
  async (args) => {
    const userPrefix = args.username ? `${args.username}@` : "";
    await execAsync(`scp -P ${args.port || 22} ${args.localPath} ${userPrefix}${args.host}:${args.remotePath}`, { timeout: 120000 });
    return { content: [{ type: "text", text: `✅ 上传成功: ${args.localPath} → ${args.host}:${args.remotePath}` }] };
  }
);

server.tool(
  "ssh_list_hosts",
  "列出 SSH config 中配置的所有可用服务器",
  {},
  async () => {
    const hosts = getSSHHosts();
    const text = hosts.length
      ? `📋 可用主机:\n${hosts.map((h: string) => `  • ${h}`).join("\n")}`
      : `未找到 SSH 配置。请编辑 ~/.ssh/config，例如:\n\nHost my-server\n    HostName 123.123.123.123\n    User root\n    IdentityFile ~/.ssh/id_rsa`;
    return { content: [{ type: "text", text }] };
  }
);

// ========================
// 阿里云 CLI 工具（条件注册）
// ========================

if (hasAliyunCLI()) {

  server.tool(
    "aliyun_ecs_list",
    "列出阿里云 ECS 实例列表",
    {
      regionId: z.string().optional().describe("地域 ID"),
      status: z.string().optional().describe("实例状态过滤: Running, Stopped"),
    },
    async (args) => {
      let cmd = "ecs DescribeInstances";
      if (args.status) cmd += ` --Status ${args.status}`;
      return { content: [{ type: "text", text: await runAliyunCLI(cmd, {}) }] };
    }
  );

  server.tool(
    "aliyun_ecs_start",
    "启动一台 ECS 实例",
    { instanceId: z.string().describe("ECS 实例 ID") },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI("ecs StartInstance", { InstanceId: args.instanceId }) }],
    })
  );

  server.tool(
    "aliyun_ecs_stop",
    "停止一台 ECS 实例",
    { instanceId: z.string().describe("ECS 实例 ID") },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI("ecs StopInstance", { InstanceId: args.instanceId }) }],
    })
  );

  server.tool(
    "aliyun_ecs_reboot",
    "重启一台 ECS 实例",
    { instanceId: z.string().describe("ECS 实例 ID") },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI("ecs RebootInstance", { InstanceId: args.instanceId }) }],
    })
  );

  server.tool(
    "aliyun_ecs_describe",
    "查看 ECS 实例的详细信息（配置、IP、状态等）",
    { instanceId: z.string().describe("ECS 实例 ID") },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI("ecs DescribeInstanceAttribute", { InstanceId: args.instanceId }) }],
    })
  );

  server.tool(
    "aliyun_oss_list",
    "列出 OSS Bucket 中的文件对象",
    {
      bucketName: z.string().optional().describe("Bucket 名称（不填则列出所有 bucket）"),
      prefix: z.string().optional().describe("对象名前缀过滤"),
    },
    async (args) => {
      let cmd = "oss ls";
      if (args.bucketName) cmd += ` oss://${args.bucketName}${args.prefix ? "/" + args.prefix : ""}`;
      return { content: [{ type: "text", text: await runAliyunCLI(cmd, {}) }] };
    }
  );

  server.tool(
    "aliyun_rds_list",
    "列出阿里云 RDS 数据库实例",
    { regionId: z.string().optional().describe("地域 ID") },
    async () => ({
      content: [{ type: "text", text: await runAliyunCLI("rds DescribeDBInstances", {}) }],
    })
  );

  server.tool(
    "aliyun_monitor",
    "查询 ECS 实例的云监控指标（CPU/内存/磁盘等）",
    {
      instanceId: z.string().describe("ECS 实例 ID"),
      metric: z.string().optional().default("CpuUtilization").describe("指标名: CpuUtilization, MemoryUtilization, DiskUtilization"),
    },
    async (args) => {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 3600000).toISOString();
      return {
        content: [{
          type: "text",
          text: await runAliyunCLI("cms DescribeMetricList", {
            Namespace: "acs_ecs_dashboard",
            MetricName: args.metric,
            Dimensions: JSON.stringify([{ instanceId: args.instanceId }]),
            StartTime: start, EndTime: end, Period: "300"
          })
        }]
      };
    }
  );

  server.tool(
    "aliyun_billing",
    "查询阿里云账单和消费情况",
    { billingCycle: z.string().describe("账期, 格式: YYYY-MM") },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI("bssopenapi QueryBill", { BillingCycle: args.billingCycle }) }],
    })
  );

  server.tool(
    "aliyun_cli",
    "执行任意阿里云 CLI 命令（高级操作，如创建资源、配置安全组等）",
    {
      command: z.string().describe("aliyun CLI 命令参数，如: 'ecs DescribeInstances --Status Running'"),
      description: z.string().optional().describe("命令用途说明"),
    },
    async (args) => ({
      content: [{ type: "text", text: await runAliyunCLI(args.command, {}) }],
    })
  );
}

// ============================================================
// 启动
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 阿里云 MCP Server 已启动");
  console.error(`   SSH config: ${existsSync(SSH_CONFIG_PATH) ? "✅" : "❌"}`);
  console.error(`   SSH 密钥: ${findSSHKey() ? "✅" : "❌"}`);
  console.error(`   阿里云 CLI: ${hasAliyunCLI() ? "✅" : "❌"}`);
  if (!hasAliyunCLI()) {
    console.error("💡 安装: curl -fsSL https://aliyuncli.alicdn.com/install.sh | sh && aliyun configure");
  }
}

main().catch(console.error);
