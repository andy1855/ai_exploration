#!/usr/bin/env tsx
/**
 * erase_subagent.ts — 笔迹擦除 Cursor SDK 子代理
 *
 * 以 @cursor/sdk 为入口，启动一个本地 Cursor Agent，协调 Python 擦除脚本。
 * 可作为库导入（eraseHandwriting），也可直接从命令行调用。
 *
 * 用法示例：
 *   npx tsx erase_subagent.ts raw.jpg
 *   npx tsx erase_subagent.ts raw.jpg --backend llm --provider anthropic
 *   npx tsx erase_subagent.ts ./photos/ --backend local --save-mask
 *   npm run erase -- raw.jpg --backend local
 *
 * 环境变量：
 *   CURSOR_API_KEY  — Cursor 用户或服务账号 API Key（必需）
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY — LLM 后端时需要（由 Python 脚本读取）
 */

import path from "node:path";
import fs from "node:fs";
import { Agent, CursorAgentError } from "@cursor/sdk";

// ─────────────────────────────────────────────────────────────
// 公开接口
// ─────────────────────────────────────────────────────────────

export interface EraseOptions {
  /** 输入图片绝对路径列表，或包含图片的文件夹路径 */
  images: string[];
  /** 擦除后端：local = 纯 OpenCV inpaint；llm = LLM 视觉定位 + OpenCV 擦除。默认 "local" */
  backend?: "local" | "llm";
  /** LLM 后端时使用的提供商。backend="llm" 时必填 */
  provider?: "anthropic" | "openai";
  /** 输出目录。默认为第一张图片所在目录下的 cleaned/ 子目录 */
  outDir?: string;
  /** 是否同时保存调试用 mask 图片 */
  saveMask?: boolean;
  /** Cursor API Key。未提供时读 CURSOR_API_KEY 环境变量 */
  cursorApiKey?: string;
}

export interface EraseResult {
  status: "finished" | "error";
  /** agent run ID，可用于 Agent.getRun() 查询详情 */
  runId: string;
  /** 预期输出图片路径（agent 完成后由 Python 脚本写入） */
  outputs: string[];
}

// ─────────────────────────────────────────────────────────────
// 核心函数
// ─────────────────────────────────────────────────────────────

/**
 * 解析输入列表：将文件夹展开为图片文件路径列表。
 */
function resolveImages(inputs: string[]): string[] {
  const exts = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"]);
  const resolved: string[] = [];

  for (const input of inputs) {
    const abs = path.resolve(input);
    const stat = fs.statSync(abs, { throwIfNoEntry: false });
    if (!stat) throw new Error(`路径不存在: ${abs}`);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(abs);
      for (const entry of entries.sort()) {
        if (exts.has(path.extname(entry).toLowerCase())) {
          resolved.push(path.join(abs, entry));
        }
      }
    } else {
      if (!exts.has(path.extname(abs).toLowerCase())) {
        throw new Error(`不支持的文件格式: ${abs}`);
      }
      resolved.push(abs);
    }
  }

  if (resolved.length === 0) throw new Error("未找到任何可处理的图片文件");
  return resolved;
}

/**
 * 推断每张图片的输出路径（与 Python 脚本命名约定保持一致）。
 */
function inferOutputPaths(imagePaths: string[], opts: EraseOptions): string[] {
  return imagePaths.map((img) => {
    const dir = opts.outDir
      ? path.resolve(opts.outDir)
      : path.join(path.dirname(img), "cleaned");
    const stem = path.basename(img, path.extname(img));
    const suffix = opts.backend === "llm" ? "_cleaned" : "_cv_erased";
    return path.join(dir, `${stem}${suffix}${path.extname(img)}`);
  });
}

/**
 * 为 Python 命令生成 Markdown 代码块，供 agent prompt 使用。
 */
function buildCommands(imagePaths: string[], opts: EraseOptions): string {
  const scriptDir = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname));

  return imagePaths
    .map((img) => {
      if (opts.backend === "llm") {
        const providerArg = `--provider ${opts.provider ?? "anthropic"}`;
        const maskArg = opts.saveMask ? " --save-mask" : "";
        const outArg = opts.outDir ? ` --out "${path.join(opts.outDir, path.basename(img).replace(/(\.[^.]+)$/, "_cleaned$1"))}"` : "";
        return `python3 "${path.join(scriptDir, "handwriting_eraser_agent.py")}" "${img}"${outArg} ${providerArg}${maskArg}`;
      } else {
        const maskArg = opts.saveMask ? " --save-mask" : "";
        const outArg = opts.outDir ? ` --out "${path.join(opts.outDir, path.basename(img).replace(/(\.[^.]+)$/, "_cv_erased$1"))}"` : "";
        return `python3 "${path.join(scriptDir, "cv_eraser.py")}" "${img}"${outArg}${maskArg}`;
      }
    })
    .join("\n");
}

/**
 * 构建发给 Cursor Agent 的任务 prompt。
 */
function buildPrompt(imagePaths: string[], opts: EraseOptions): string {
  const backend = opts.backend ?? "local";
  const backendLabel = backend === "llm"
    ? `LLM 增强（${opts.provider ?? "anthropic"} 视觉定位 + OpenCV 擦除）`
    : "本地 OpenCV（纯规则管线，无需 API Key）";

  const commands = buildCommands(imagePaths, opts);
  const imageList = imagePaths.map((p) => `  - ${p}`).join("\n");

  return `你是一个试卷笔迹擦除子代理。请按照以下步骤处理图片，不要解释或询问，直接执行。

## 任务

对以下 ${imagePaths.length} 张试卷图片进行笔迹擦除，后端模式：**${backendLabel}**。

## 输入图片

${imageList}

## 执行步骤

1. 在终端依次运行下方每条命令，等待每条命令执行完成后再执行下一条。
2. 如果某张图片处理失败，打印错误信息后继续处理下一张，不要中止整个任务。
3. 所有图片处理完成后，列出所有成功生成的输出文件路径（每行一个完整绝对路径）。

## 命令

\`\`\`bash
${commands}
\`\`\`

## 完成标准

- 每条命令运行完毕（成功或失败）
- 输出一个汇总列表，格式：
  OUTPUT: /absolute/path/to/output1.jpg
  OUTPUT: /absolute/path/to/output2.jpg
  （每个成功输出一行，以 "OUTPUT: " 开头）
`;
}

/**
 * 从 agent 对话文本中提取 "OUTPUT: /path" 行。
 */
function parseOutputPaths(text: string): string[] {
  const lines = text.split("\n");
  return lines
    .filter((l) => l.trimStart().startsWith("OUTPUT:"))
    .map((l) => l.replace(/^.*OUTPUT:\s*/, "").trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// 公开主函数
// ─────────────────────────────────────────────────────────────

/**
 * 创建一个本地 Cursor Agent 子代理，执行笔迹擦除任务。
 *
 * @example
 * import { eraseHandwriting } from "./erase_subagent.js";
 * const result = await eraseHandwriting({ images: ["./raw.jpg"], backend: "local" });
 */
export async function eraseHandwriting(opts: EraseOptions): Promise<EraseResult> {
  if (opts.backend === "llm" && !opts.provider) {
    throw new Error('backend="llm" 时必须指定 provider（"anthropic" 或 "openai"）');
  }

  const apiKey = opts.cursorApiKey ?? process.env["CURSOR_API_KEY"];
  if (!apiKey) {
    throw new Error("未找到 Cursor API Key。请设置 CURSOR_API_KEY 环境变量或传入 cursorApiKey 选项。");
  }

  const imagePaths = resolveImages(opts.images);
  const expectedOutputs = inferOutputPaths(imagePaths, opts);
  const prompt = buildPrompt(imagePaths, opts);
  const scriptDir = path.resolve(
    import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname)
  );

  console.log(`[erase_subagent] 处理 ${imagePaths.length} 张图片，后端: ${opts.backend ?? "local"}`);
  imagePaths.forEach((p, i) => console.log(`  [${i + 1}/${imagePaths.length}] ${p}`));

  const agent = await Agent.create({
    apiKey,
    model: { id: "composer-2" },
    local: { cwd: scriptDir },
  });

  let runId = "";
  let collectedText = "";

  try {
    const run = await agent.send(prompt);
    runId = run.id;
    console.log(`[erase_subagent] Agent 启动，run.id = ${runId}`);

    // 流式打印 agent 输出
    if (run.supports("stream")) {
      for await (const event of run.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message.content) {
            if (block.type === "text") {
              process.stdout.write(block.text);
              collectedText += block.text;
            }
          }
        }
      }
      if (!collectedText.endsWith("\n")) process.stdout.write("\n");
    }

    const result = await run.wait();

    if (result.status === "error") {
      console.error(`[erase_subagent] Agent 运行失败，run.id = ${runId}`);
      return { status: "error", runId, outputs: [] };
    }

    // 尝试从输出文本提取实际路径；回退到推断路径
    const parsedOutputs = parseOutputPaths(collectedText);
    const outputs = parsedOutputs.length > 0 ? parsedOutputs : expectedOutputs;

    console.log(`[erase_subagent] 完成。输出文件：`);
    outputs.forEach((p) => console.log(`  → ${p}`));

    return { status: "finished", runId, outputs };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(`[erase_subagent] Agent 启动失败: ${err.message} (retryable=${err.isRetryable})`);
      throw err;
    }
    throw err;
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

// ─────────────────────────────────────────────────────────────
// CLI 入口
// ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { inputs: string[]; opts: EraseOptions } {
  const args = argv.slice(2);
  const inputs: string[] = [];
  const opts: EraseOptions = { images: [], backend: "local" };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--backend" || arg === "-b") {
      const val = args[++i];
      if (val !== "local" && val !== "llm") {
        console.error(`错误：--backend 只接受 "local" 或 "llm"，收到: ${val}`);
        process.exit(1);
      }
      opts.backend = val;
    } else if (arg === "--provider" || arg === "-p") {
      const val = args[++i];
      if (val !== "anthropic" && val !== "openai") {
        console.error(`错误：--provider 只接受 "anthropic" 或 "openai"，收到: ${val}`);
        process.exit(1);
      }
      opts.provider = val;
    } else if (arg === "--out-dir" || arg === "-o") {
      opts.outDir = args[++i];
    } else if (arg === "--save-mask") {
      opts.saveMask = true;
    } else if (arg === "--api-key") {
      opts.cursorApiKey = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      inputs.push(arg);
    } else {
      console.error(`未知选项: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  if (inputs.length === 0) {
    console.error("错误：请提供至少一个图片路径或文件夹路径");
    printHelp();
    process.exit(1);
  }

  opts.images = inputs;
  return { inputs, opts };
}

function printHelp() {
  console.log(`
用法：
  npx tsx erase_subagent.ts <图片或文件夹> [选项]

选项：
  --backend, -b    local（默认）| llm
  --provider, -p   anthropic | openai   （backend=llm 时必填）
  --out-dir, -o    输出目录（默认为输入图片目录下的 cleaned/）
  --save-mask      同时保存 mask 调试图
  --api-key        Cursor API Key（默认读 CURSOR_API_KEY 环境变量）
  --help, -h       显示帮助

示例：
  npx tsx erase_subagent.ts raw.jpg
  npx tsx erase_subagent.ts raw.jpg --backend llm --provider anthropic
  npx tsx erase_subagent.ts ./photos/ --backend local --save-mask
  `.trim());
}

// 仅在直接执行（非 import）时运行 CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith("erase_subagent.ts") ||
  process.argv[1].endsWith("erase_subagent.js")
);

if (isMain) {
  const { opts } = parseArgs(process.argv);
  eraseHandwriting(opts)
    .then((result) => {
      process.exit(result.status === "finished" ? 0 : 2);
    })
    .catch((err) => {
      if (err instanceof CursorAgentError) process.exit(1);
      console.error(err);
      process.exit(2);
    });
}
