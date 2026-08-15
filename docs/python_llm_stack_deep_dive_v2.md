# Python LLM 工程栈深度调研报告 v2

> **生成日期**: 2026-05-29  
> **定位**: Python LLM 应用的工程选型、生产风险、质量评估与落地路线  
> **输入材料**: `python_llm_stack_deep_dive.md`、本地 `oss-graph-repos/` 开源仓库、`repo-inv` 分析结果、GitHub/PyPI/官方文档  
> **核心变化**: 从“生态百科”改成“可执行的架构决策报告”。底层推理链路保留，但不再让缺来源的性能数字主导结论。

---

## 目录

1. [执行摘要：先按场景选型](#1-执行摘要先按场景选型)
2. [调研方法与证据等级](#2-调研方法与证据等级)
3. [LLM 工程栈分层地图](#3-llm-工程栈分层地图)
4. [开源仓库质量与风险地图](#4-开源仓库质量与风险地图)
5. [API 与多 Provider 网关](#5-api-与多-provider-网关)
6. [私有化推理 Serving 选型](#6-私有化推理-serving-选型)
7. [RAG 生产架构](#7-rag-生产架构)
8. [GraphRAG 与知识图谱增强](#8-graphrag-与知识图谱增强)
9. [Agent 工程架构](#9-agent-工程架构)
10. [Tool Calling 与结构化输出](#10-tool-calling-与结构化输出)
11. [评测、可观测性与回归体系](#11-评测可观测性与回归体系)
12. [安全、权限与合规治理](#12-安全权限与合规治理)
13. [成本与容量模型](#13-成本与容量模型)
14. [落地路线图](#14-落地路线图)
15. [参考资料](#15-参考资料)

---

## 1. 执行摘要：先按场景选型

### 1.1 结论表

| 场景 | 首选栈 | 备选 | 不建议默认选 | 关键原因 |
|------|--------|------|--------------|----------|
| 快速 API 应用 | 原生 SDK (`openai`, `anthropic`, `google-genai`) + FastAPI | LiteLLM 网关 | 一开始就套重型 Agent 框架 | 原生 SDK 语义最清楚，便于掌握错误、重试、限流、流式和 tool schema 差异 |
| 多模型/多云统一入口 | LiteLLM proxy / 自建 provider adapter | aisuite | 在业务代码里散落 provider 分支 | 网关能统一鉴权、预算、日志，但要审许可证、失败语义和 provider 差异 |
| 生产私有化推理 | vLLM / SGLang + OpenAI-compatible API | TensorRT-LLM | Transformers pipeline 直接做高并发服务 | serving 的核心是 batching、KV cache、admission control、tail latency，不是只会 `generate()` |
| 本地/边缘/开发体验 | Ollama / llama.cpp | MLX（Apple） | 把 Ollama 当企业多租户 serving | 本地体验强，生产治理、配额、隔离和审计要外层补齐 |
| 常规企业知识库 RAG | LlamaIndex 或 Haystack + Qdrant/pgvector/Pinecone + rerank | LangChain retriever 组合 | 只上向量库就声称完成 RAG | RAG 成败主要在解析、chunk、embedding、rerank、引用和评测闭环 |
| 合规/审计型 RAG | Haystack pipeline + 可审计存储 + trace | LlamaIndex 白名单组件 | 黑盒低代码流 | pipeline 边界清晰，便于审计、回放和版本化 |
| 状态化生产 Agent | LangGraph + checkpoint + human-in-the-loop | OpenAI Agents SDK / Claude Agent SDK | CrewAI 直接扛长流程生产 | 状态恢复、人工审批、工具幂等和审计比“多 Agent”概念更重要 |
| 角色协作原型 | CrewAI | AutoGen/AG2 | 过早生产化 | 原型快，但要补状态持久化、权限、错误恢复和观测 |
| GraphRAG / 关系推理 | Microsoft GraphRAG / LightRAG / Graphiti 小样本验证 | LlamaIndex PropertyGraphIndex | 简单 FAQ 默认 GraphRAG | 图抽取、去重、合并、删除和重建成本高，适合跨文档关系推理而非所有 RAG |

### 1.2 最大原则

LLM 应用不是“选一个框架”就结束，而是五个闭环：

1. **模型调用闭环**：请求、流式、重试、限流、tool schema、provider 差异。
2. **知识闭环**：摄取、解析、chunk、embedding、索引、检索、rerank、引用、删除和重建。
3. **执行闭环**：Agent 状态、工具权限、幂等、补偿、人工审批、审计。
4. **质量闭环**：golden set、离线评测、在线 trace、回归测试、人工抽检。
5. **成本闭环**：token、KV cache、GPU 利用率、索引重建、缓存命中、失败重试。

---

## 2. 调研方法与证据等级

### 2.1 证据等级

| 等级 | 来源 | 用途 |
|------|------|------|
| A | 官方文档、官方仓库、PyPI 元数据、论文 | API 行为、支持状态、license、release、核心机制 |
| B | 本地源码 + `repo-inv` 静态分析 | 代码规模、复杂度、模块边界、可借鉴点、维护风险线索 |
| C | GitHub stars/issues/PR/releases | 外部热度、维护活跃度、社区压力 |
| D | 社区 benchmark、博客、第三方下载量 | 只能做参考，不能单独作为架构结论 |

### 2.2 已使用的本地证据

本地 `oss-graph-repos/` 中与 LLM/RAG 直接相关的仓库包括：

| 本地仓库 | 上游 | `repo-inv` 快照 |
|----------|------|----------------|
| `langgraph` | `langchain-ai/langgraph` | 525 files / 153K code lines |
| `llama_index` | `run-llama/llama_index` | 8,575 files / 1.56M code lines，包含大量 docs/examples/JSON |
| `LightRAG` | `HKUDS/LightRAG` | 585 files / 171K code lines |
| `graphrag` | `microsoft/graphrag` | 802 files / 68K code lines |

这些 clone 多为浅拷贝或快照，本地 git contributor/commit 统计不能代表上游活跃度。

---

## 3. LLM 工程栈分层地图

```text
应用层
  ├─ Chat UI / API / CLI / workflow
  ├─ Agent state / session / memory / approval
  └─ business policy / auth / audit

编排层
  ├─ LangGraph / OpenAI Agents SDK / Claude Agent SDK / CrewAI
  ├─ Tool schema / handoff / retry / checkpoint
  └─ trace / cost / evaluation hooks

知识层
  ├─ ingestion: PDF/HTML/Office/code/database
  ├─ chunking / metadata / ACL / versioning
  ├─ embeddings / vector DB / keyword index / graph index
  └─ retriever / reranker / citation / freshness

模型访问层
  ├─ OpenAI / Anthropic / Google / Mistral / Bedrock / Azure OpenAI
  ├─ LiteLLM / aisuite / custom provider adapter
  └─ structured output / tool calling / streaming

推理服务层
  ├─ vLLM / SGLang / TensorRT-LLM / llama.cpp / Ollama / Transformers
  ├─ batching / KV cache / prefix cache / speculative decoding
  └─ GPU scheduling / model cache / admission control

基础设施层
  ├─ Kubernetes / GPU Operator / DCGM / Prometheus
  ├─ Redis / PostgreSQL / object storage / queue
  └─ IAM / secrets / network / data residency
```

关键判断：**框架只能覆盖其中一层或几层，不能替代端到端工程设计**。例如 LangGraph 管状态图，不替你解决文档解析；vLLM 管 serving，不替你解决 prompt injection；LlamaIndex 管 RAG pipeline，不替你证明答案可信。

---

## 4. 开源仓库质量与风险地图

GitHub 数字来自 2026-05-28 的 GitHub API；具体数值会变化，使用时应重新核验。

| 项目 | 定位 | 外部质量信号 | 工程风险 | 适合借鉴 |
|------|------|--------------|----------|----------|
| Transformers | 模型库/研究/微调基线 | 161K stars, Apache-2.0, 2026-05 release | serving 不是强项，生产高并发要另配服务层 | tokenizer/model loading、模型兼容 |
| vLLM | 高吞吐 serving | 81K stars, Apache-2.0, PR/issue 压力高 | 升级快、硬件/模型矩阵复杂 | OpenAI-compatible server、PagedAttention、batching |
| SGLang | serving + 复杂推理程序化 | 28K stars, Apache-2.0, 活跃 | 新生态变化快 | router、RadixAttention、复杂推理 workload |
| llama.cpp | C/C++ 本地推理/GGUF | 113K stars, MIT, 高频 release | 企业治理需外层补齐 | CPU/边缘推理、量化格式 |
| Ollama | 本地模型运行体验 | 172K stars, MIT, Go | 不是完整企业 serving 平台 | 模型分发和开发体验 |
| LangChain | LLM app 集成生态 | 137K stars, MIT | 抽象层多，依赖扩散 | provider/tool/retriever 集成 |
| LangGraph | 状态化 Agent | 33K stars, MIT；本地 153K LOC | 状态模型设计复杂 | checkpoint、interrupt、resume、human-in-loop |
| LlamaIndex | RAG 数据框架 | 49K stars, MIT；本地 1.56M LOC | connector 面大，依赖和版本风险高 | ingestion、index、retriever、query engine |
| Haystack | pipeline 型 RAG | 25K stars, Apache-2.0 | 组件选择需要工程约束 | 可审计 pipeline、企业检索 |
| LightRAG | 轻量 GraphRAG | 35K stars, MIT；本地 171K LOC | 图合并、删除、缓存一致性复杂 | GraphRAG 快速验证 |
| Microsoft GraphRAG | 图增强 RAG 方法论 | 33K stars, MIT；README 声明非正式支持产品 | indexing 成本高，配置迁移和重建要谨慎 | pipeline 方法、prompt tuning、社区检测 |
| LiteLLM | 多 provider 网关 | 48K stars, commit 多，license metadata 需核验 | provider 差异、失败语义、许可证边界 | API 网关、预算、统一日志 |
| CrewAI | 多 Agent 原型 | 52K stars, MIT, release 高频 | 长流程状态恢复和工具治理需补 | role/task 快速原型 |
| OpenAI Agents SDK | 官方 Agent SDK | 26K stars, MIT, 2025-03 创建 | 跨 provider 可用但不要假设完全可移植 | handoff、guardrails、tracing、sessions |
| Claude Agent SDK | Claude Code/Agent SDK | 7K stars, MIT, v0.2.x | 不是通用 Agent 框架替代品；更接近 Claude Code 自动化 SDK | Claude Code 风格工具循环、上下文管理 |
| Google ADK | Google Agent Development Kit | 19K stars, Apache-2.0 | Google 栈绑定较强 | Gemini/Google Cloud agent |
| TGI | HF Text Generation Inference | Hugging Face docs 标为 maintenance mode；GitHub `archived=true` | 不应作为新项目默认选项 | 存量系统维护与迁移评估 |

### 4.1 质量判断规则

1. **stars 是热度，不是质量**。高 stars + 高 open issue/PR 可能代表生态强，也可能代表维护噪声高。
2. **release 高频需要版本冻结**。vLLM、LiteLLM、CrewAI、LangChain 这类快速迭代项目必须固定版本并建立回归集。
3. **大生态库要白名单化**。LlamaIndex/LangChain 不应全量开放所有 connector 和工具。
4. **GraphRAG 不是默认升级路径**。只有当问题需要跨文档关系、社区结构、全局摘要时才值得引入图。
5. **official repo 不等于 official support**。Microsoft GraphRAG README 明确代码是 demonstration，不是 officially supported Microsoft offering。

---

## 5. API 与多 Provider 网关

### 5.1 原生 SDK vs 网关

| 方案 | 优点 | 风险 | 推荐场景 |
|------|------|------|----------|
| 原生 SDK | 语义清楚，最贴近 provider 能力 | 多 provider 时代码分散 | 单 provider、强依赖特定功能 |
| LiteLLM SDK/proxy | 统一接口、统一预算/日志/限流 | provider 差异被隐藏，debug 更复杂 | 多 provider、成本路由、统一 API 网关 |
| aisuite | 轻量统一调用 | 生态和治理能力较轻 | 原型、多 provider 简单比较 |
| 自建 adapter | 可控、可审计 | 维护成本高 | 企业合规、需要强 SLA 和明确失败语义 |

### 5.2 必须显式处理的 provider 差异

| 差异 | 影响 |
|------|------|
| tool schema 支持范围 | 同一个 JSON Schema 在不同 provider 上可能不等价 |
| streaming 事件格式 | UI、trace、超时处理不同 |
| rate limit 维度 | RPM/TPM/concurrent request 组合不同 |
| safety refusal 格式 | 错误处理和用户反馈不同 |
| cache/batch API | 成本模型不同 |
| system/developer message 语义 | prompt 迁移不能只替换 model name |

### 5.3 API 层生产检查清单

- 每个请求有 `request_id`、user/session id、model、prompt version。
- 重试只针对可重试错误，且带指数退避和全局预算。
- stream 断开要能恢复或给出一致失败结果。
- tool call 参数必须做 Pydantic/JSON Schema 校验，不能直接信任模型输出。
- provider fallback 必须记录：为什么 fallback、fallback 后能力是否降级、成本是否变化。
- 日志必须脱敏，不记录原始密钥、PII 和未授权上下文。

---

## 6. 私有化推理 Serving 选型

### 6.1 选型矩阵

| 引擎 | 最佳场景 | 强项 | 短板 |
|------|----------|------|------|
| vLLM | OpenAI-compatible 高吞吐 serving（兼容不等于所有 tool calling/streaming/error 语义完全一致） | PagedAttention、continuous batching、模型生态广 | 版本变化快，GPU/模型/量化组合需压测 |
| SGLang | 复杂推理程序、router、structured generation | RadixAttention、前后端协同 | 新生态，团队需跟进变化 |
| TensorRT-LLM | NVIDIA 极致性能 | 硬件优化深、吞吐强 | 构建/部署复杂，模型适配成本高 |
| llama.cpp | CPU/边缘/本地/跨平台 | GGUF、低门槛、资源占用低 | 多租户 serving 和治理不足 |
| Ollama | 本地开发和模型分发 | DX 好、安装简单 | 生产隔离、配额、审计需外层实现 |
| Transformers | 研究/微调/兼容性 | 模型支持最广 | 不是高并发 serving 默认方案 |
| TGI | 存量 HF serving | 历史部署参考 | 仓库 archived，新项目不应默认选 |

### 6.2 Serving 不能只看 tok/s

生产压测至少要拆成：

| 指标 | 说明 |
|------|------|
| TTFT | 首 token 时间，受 prefill、排队、prefix cache 影响 |
| TPOT | 每 token decode 时间 |
| p95/p99 latency | 比平均值更重要 |
| throughput | tokens/s 或 requests/s，要区分输入/输出 token |
| KV cache occupancy | 长上下文和并发的核心瓶颈 |
| GPU utilization | 需要结合显存、SM occupancy、PCIe/NVLink |
| queue time | admission control 是否有效 |
| error rate | OOM、timeout、cancel、model load failure |

### 6.3 私有化 Serving 最小架构

```text
client
  → API gateway: auth / quota / request id / logging
  → scheduler: model routing / queue / admission control
  → serving engine: vLLM or SGLang
  → model cache: local SSD / object storage
  → observability: Prometheus + DCGM + OpenTelemetry
  → eval replay: golden prompts + latency/cost regression
```

关键实践：

- 固定模型、engine、CUDA、driver、quantization 版本。
- 每次升级跑同一组 golden prompts、长上下文、并发、tool call 和 structured output 回归。
- 为长上下文请求做 admission control，不让少数请求打爆 KV cache。
- 对用户取消请求做资源释放验证。

---

## 7. RAG 生产架构

### 7.1 RAG 的真实主线

```text
source data
  → parser / OCR / table extraction
  → chunk + metadata + ACL + version
  → embedding model + vector index + keyword index
  → retrieval + filter + hybrid search
  → rerank + context compression
  → answer generation + citation
  → evaluation + feedback + re-index
```

### 7.2 RAG 质量不在向量库品牌

| 环节 | 常见失败 | 应对 |
|------|----------|------|
| 文档解析 | 表格、页眉页脚、扫描 PDF、代码块丢结构 | 解析器评测集，保留结构 metadata |
| Chunking | 切断语义、重复上下文、chunk 过大 | 按文档类型分策略，保存 chunk version |
| Embedding | 模型迁移导致向量不可比 | embedding version 入库，支持重建 |
| ACL | 检索泄露无权限文档 | 查询时强制 metadata filter，评测越权样本 |
| Retrieval | top-k 召回低 | hybrid search + query rewrite + rerank |
| Citation | 答案引用不支持原文 | citation span 校验 |
| 更新/删除 | 旧 chunk 残留 | doc_id/chunk_id/version 索引，删除回归测试 |

### 7.3 框架选型

| 需求 | 推荐 |
|------|------|
| 大量 connector 和快速 RAG 原型 | LlamaIndex |
| 审计清晰、pipeline 工程化 | Haystack |
| 与 LangChain Agent 紧耦合 | LangChain retriever + LangGraph |
| 已有 PostgreSQL | pgvector + SQL metadata |
| 高性能独立向量库 | Qdrant / Milvus |
| 托管、少运维 | Pinecone / Zilliz Cloud / Weaviate Cloud |

### 7.4 RAG 必备评测集

- 直接命中问题：答案在单 chunk 中。
- 跨 chunk 问题：需要合并多个 chunk。
- 拒答问题：知识库没有答案。
- 权限问题：用户无权访问相关文档。
- 新旧版本问题：同一文档不同版本答案冲突。
- 表格/代码/图片问题：验证 parser 能力。
- 对抗问题：prompt injection 写在文档中。

---

## 8. GraphRAG 与知识图谱增强

### 8.1 什么时候值得 GraphRAG

值得：

- 问题需要跨文档实体关系推理。
- 需要全局主题/社区摘要。
- 需要追踪人、组织、事件、时间线。
- 普通 top-k chunk 检索经常漏掉间接关系。

不值得：

- 简单 FAQ。
- 文档量小且结构清晰。
- 答案主要来自单段原文。
- 无法承担抽取、去重、图合并和重建成本。

### 8.2 项目判断

| 项目 | 可借鉴点 | 风险 |
|------|----------|------|
| Microsoft GraphRAG | pipeline 方法、社区检测、全局/局部查询模式 | 官方声明非正式支持产品；indexing 成本高 |
| LightRAG | 轻量实现，适合快速验证 GraphRAG 思路 | 图合并、删除、缓存和存储一致性复杂 |
| Graphiti | temporal KG / agent memory | 抽取、去重、时间语义和 bulk 写入复杂 |
| LlamaIndex PropertyGraphIndex | 与 RAG 生态结合 | 仍需治理图 schema 和更新策略 |

### 8.3 GraphRAG 上线前检查

- 实体和关系 schema 是否稳定。
- 抽取 prompt 是否版本化。
- 同义实体合并规则是否可解释。
- 删除文档后图中实体/边如何回收。
- 图查询能否回溯到原文 citation。
- indexing 成本是否可预测。
- 有无小样本基准证明 GraphRAG 优于普通 hybrid RAG。

---

## 9. Agent 工程架构

### 9.1 Agent 的生产定义

生产 Agent 不是“模型会调用工具”，而是：

```text
goal
  → plan
  → tool call with permission
  → observation
  → state update
  → checkpoint
  → optional human approval
  → retry/compensate
  → final answer / audit trail
```

### 9.2 框架选择

| 需求 | 选择 |
|------|------|
| 长流程、可恢复、人工介入 | LangGraph |
| OpenAI 模型和官方 tracing/handoff | OpenAI Agents SDK |
| Claude Code/Anthropic 自动化 | Claude Agent SDK |
| Google/Gemini 生态 | Google ADK |
| 角色扮演多 Agent 原型 | CrewAI |
| 强类型 Python、Pydantic 模型 | Pydantic AI |
| Code Agent / Python 工具执行 | smolagents |

### 9.3 Agent 风险清单

| 风险 | 例子 | 控制 |
|------|------|------|
| 工具越权 | 模型调用删除/转账/发邮件 | tool scope、审批、dry-run、allowlist |
| 非幂等重试 | 网络失败后重复扣款 | idempotency key、事务日志 |
| 状态丢失 | 长任务中断后从头执行 | checkpoint/resume |
| 工具输出注入 | 网页内容诱导忽略系统指令 | 工具输出隔离、引用标记、策略检查 |
| 并发冲突 | 多 Agent 修改同一资源 | 锁、版本号、补偿操作 |
| 不可审计 | 无法解释为何调用工具 | trace、request id、tool log |

---

## 10. Tool Calling 与结构化输出

### 10.1 设计规则

- tool schema 要窄：只暴露必要字段和枚举。
- 参数必须二次校验：Pydantic/JSON Schema/业务规则。
- tool 结果当作不可信输入处理。
- 写操作默认 `dry_run`，关键动作需要人工确认。
- tool 执行要有 timeout、retry budget、幂等 key 和审计日志。

### 10.2 Structured Output vs JSON Mode

| 机制 | 适合 | 风险 |
|------|------|------|
| JSON Mode | 只要求输出 JSON | 字段和类型仍可能不满足业务约束 |
| Structured Output / schema constrained | 强结构化数据 | schema 太复杂会降低成功率或增加延迟 |
| Instructor/Pydantic retry | Python app 层校验重试 | 重试成本和延迟增加 |
| Outlines/Guidance | 本地/受控解码 | 模型和 serving 兼容性需验证 |

---

## 11. 评测、可观测性与回归体系

### 11.1 最小可观测字段

每次 LLM 调用至少记录：

- `trace_id`, `request_id`, `user_id/session_id`
- model/provider/version
- prompt template version
- input/output token
- latency: queue / TTFT / total / tool time
- retrieval: query, filters, doc ids, scores, rerank scores
- tool calls: name, args hash, result status, duration
- cost estimate
- safety/refusal/error code

### 11.2 评测分层

| 层 | 指标 |
|----|------|
| Retrieval | recall@k, MRR, nDCG, permission leakage |
| Generation | faithfulness, answer correctness, citation accuracy |
| Agent | task success, tool error rate, human intervention rate |
| Serving | TTFT, TPOT, p95/p99 latency, OOM rate |
| Cost | cost/request, cache hit rate, retry cost |

### 11.3 回归机制

- golden set 固定输入、期望行为、允许变化范围。
- 每次改 prompt/model/retriever/chunker 都跑离线评测。
- 线上 trace 抽样进入人工评审。
- 对失败样本打标签：检索失败、引用失败、模型推理失败、工具失败、权限失败。
- 建立 replay 工具，能复现历史请求。

---

## 12. 安全、权限与合规治理

### 12.1 主要威胁

| 威胁 | 位置 | 例子 |
|------|------|------|
| Prompt injection | 用户输入 | “忽略之前指令” |
| Indirect injection | RAG 文档/网页/tool 输出 | 文档里诱导模型泄露密钥 |
| Data exfiltration | tool/API | 模型调用搜索/HTTP 工具外传数据 |
| RAG poisoning | ingestion | 恶意文档污染知识库 |
| Excessive agency | Agent | 自动执行高风险动作 |
| Sensitive logging | observability | trace 中含 PII/secrets |

### 12.2 控制措施

- 工具最小权限：读写分离，按用户 ACL 过滤。
- 高风险工具人工审批。
- tool output 与系统指令隔离，不让网页/文档改写策略。
- RAG 文档入库前做来源、权限、hash、版本记录。
- trace 脱敏和保留周期控制。
- 对越权检索、注入、拒答建立红队评测集。

参考框架：OWASP LLM Top 10、NIST AI RMF / GenAI profile。

---

## 13. 成本与容量模型

### 13.1 API 成本公式

```text
cost/request =
  input_tokens * input_price
  + output_tokens * output_price
  + cached_tokens * cache_price
  + retry_tokens
  + tool/API downstream cost
```

不要只看模型单价。实际成本常被这些因素放大：

- prompt 模板过长。
- RAG top-k 太高。
- tool schema 太大。
- 多轮 Agent 循环失控。
- 失败重试没有预算。
- 无缓存或 cache key 设计错误。

### 13.2 私有化 GPU 容量

```text
capacity ≈
  min(
    GPU compute throughput,
    KV cache memory / (concurrent_requests * context_length),
    network + serialization overhead,
    scheduler queue policy
  )
```

必测 workload：

- 短 prompt / 短输出。
- 长 prompt / 短输出。
- 长 prompt / 长输出。
- 多并发混合。
- streaming cancel。
- tool call 多轮。
- prefix cache 命中/未命中。

---

## 14. 落地路线图

### 14.1 两周原型

- 选 1 个 provider + 1 个模型。
- 不上复杂 Agent，先做单轮/少轮工作流。
- 建 50-100 条 golden set。
- RAG 只接 1-2 类文档。
- 打通 trace、成本、错误日志。

### 14.2 一个月 MVP

- provider adapter 或 LiteLLM proxy。
- RAG ingestion 版本化。
- 引入 rerank 和 citation。
- 工具调用加 Pydantic 校验和审计。
- 建立离线评测 + 每日回归。
- 小流量 A/B。

### 14.3 生产化

- 版本冻结：model、prompt、retriever、chunker、embedding。
- 安全红队：prompt injection、越权检索、工具越权。
- 容量压测：p95/p99、并发、KV cache、重试成本。
- 故障演练：provider outage、vector DB outage、tool timeout。
- 数据治理：PII、日志脱敏、保留周期、删除链路。

---

## 15. 参考资料

| 主题 | URL |
|------|-----|
| OpenAI Function Calling | https://platform.openai.com/docs/guides/function-calling |
| OpenAI Structured Outputs | https://platform.openai.com/docs/guides/structured-outputs |
| OpenAI Agents SDK | https://github.com/openai/openai-agents-python |
| Anthropic Claude Agent SDK | https://github.com/anthropics/claude-agent-sdk-python |
| Google ADK | https://github.com/google/adk-python |
| vLLM Docs | https://docs.vllm.ai/ |
| vLLM PagedAttention paper | https://arxiv.org/abs/2309.06180 |
| SGLang | https://github.com/sgl-project/sglang |
| llama.cpp | https://github.com/ggml-org/llama.cpp |
| Ollama | https://github.com/ollama/ollama |
| Transformers | https://github.com/huggingface/transformers |
| LangGraph Docs | https://docs.langchain.com/oss/python/langgraph/overview |
| LangGraph Human-in-the-loop | https://docs.langchain.com/oss/python/langgraph/human-in-the-loop |
| LlamaIndex Docs | https://docs.llamaindex.ai/ |
| Haystack Pipelines | https://docs.haystack.deepset.ai/docs/pipelines |
| Microsoft GraphRAG | https://github.com/microsoft/graphrag |
| LightRAG | https://github.com/HKUDS/LightRAG |
| Graphiti | https://github.com/getzep/graphiti |
| OpenTelemetry GenAI Semantic Conventions | https://opentelemetry.io/docs/specs/semconv/gen-ai/ |
| OWASP LLM Top 10 | https://owasp.org/www-project-top-10-for-large-language-model-applications |
| NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework |
| Ragas Metrics | https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/ |

