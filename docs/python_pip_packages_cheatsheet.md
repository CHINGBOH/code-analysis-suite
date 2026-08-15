# Python 常用高效第三方包完全速查手册

> **更新日期**: 2026-05-28  
> **Python 版本**: 3.11+  
> **安装方式**: `pip install <package>` 或 `uv pip install <package>`  
> **推荐工具**: 可评估使用 [uv](https://github.com/astral-sh/uv) 加速安装/解析；具体速度收益取决于网络、缓存和依赖图规模

> **事实校验补充（2026-05-29）**: 这份清单是“常用包速查”，不是流行度排名。包名、安装名和维护状态应以 PyPI/项目主页为准；标准库条目（如 `tomllib`）以 docs.python.org 为准。来源: https://pypi.org/ , https://docs.python.org/3/library/

---

## 目录

1. [Web 框架与 API 开发](#1-web-框架与-api-开发)
2. [数据处理与科学计算](#2-数据处理与科学计算)
3. [机器学习、AI 与 LLM](#3-机器学习ai-与-llm)
4. [数据库、ORM 与缓存](#4-数据库orm-与缓存)
5. [异步、并发与网络](#5-异步并发与网络)
6. [爬虫与自动化](#6-爬虫与自动化)
7. [测试与质量保障](#7-测试与质量保障)
8. [CLI 与 TUI 开发](#8-cli-与-tui-开发)
9. [配置、日志与文档](#9-配置日志与文档)
10. [图像、视频与多媒体](#10-图像视频与多媒体)
11. [安全与加密](#11-安全与加密)
12. [序列化与数据格式](#12-序列化与数据格式)
13. [文本处理与 NLP](#13-文本处理与-nlp)
14. [日期时间与调度](#14-日期时间与调度)
15. [系统、文件与运维](#15-系统文件与运维)
16. [开发工具与辅助库](#16-开发工具与辅助库)

---

## 1. Web 框架与 API 开发

### 全栈框架

| 包名 | 安装命令 | 说明 | 适用场景 |
|------|----------|------|----------|
| **Django** | `pip install django` | Python 最成熟的 Web 全栈框架，ORM/Admin/Auth 内置 | 企业级 Web 应用、CMS、电商 |
| **Django REST Framework** | `pip install djangorestframework` | Django 的 REST API 扩展，功能强大 | RESTful API 开发 |
| **Flask** | `pip install flask` | 轻量级微框架，灵活可扩展 | 小型服务、原型、微服务 |
| **Flask-SQLAlchemy** | `pip install flask-sqlalchemy` | Flask 的 ORM 集成 | Flask 数据库操作 |
| **Tornado** | `pip install tornado` | 异步非阻塞 Web 框架，支持 WebSocket | 实时应用、长连接服务 |
| **Bottle** | `pip install bottle` | 单文件微框架，零依赖 | 超轻量 API、嵌入式服务 |
| **Pyramid** | `pip install pyramid` | 灵活的中型框架，可伸缩 | 中大型可定制项目 |
| **CubicWeb** | `pip install cubicweb` | 语义化 Web 框架 | 数据密集型复杂应用 |

### 高性能异步 API 框架

| 包名 | 安装命令 | 说明 | 适用场景 |
|------|----------|------|----------|
| **FastAPI** ⭐ | `pip install fastapi[standard]` | 现代高性能异步 API 框架，自动 OpenAPI/Swagger 文档，基于 Pydantic | 微服务、ML 模型部署、高性能 API |
| **Starlette** | `pip install starlette` | ASGI 工具集，FastAPI 的底层基础 | 底层 ASGI 应用 |
| **Sanic** | `pip install sanic` | 类 Flask 语法的异步框架 | 高并发 API 服务 |
| **Falcon** | `pip install falcon` | 极简高性能 WSGI/ASGI 框架 | 大规模 API 后端 |
| **Litestar** | `pip install litestar` | 全功能 ASGI 框架（原 Starlite） | 企业级异步应用 |

### WebSocket / 实时通信

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **python-socketio** | `pip install python-socketio` | Socket.IO 服务器实现 |
| **websockets** | `pip install websockets` | 纯 Python WebSocket 客户端/服务端 |
| **channels** | `pip install channels` | Django 的 WebSocket/异步扩展 |

### ASGI/WSGI 服务器

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Uvicorn** ⭐ | `pip install uvicorn[standard]` | ASGI 服务器，支持 HTTP/1.1 和 WebSocket |
| **Gunicorn** | `pip install gunicorn` | WSGI HTTP 服务器，多 worker 模式 |
| **Hypercorn** | `pip install hypercorn` | 支持 HTTP/2 和 HTTP/3 的 ASGI 服务器 |
| **Daphne** | `pip install daphne` | Django Channels 的 ASGI 服务器 |

### 数据验证与序列化

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Pydantic** ⭐ | `pip install pydantic` | 基于类型提示的数据验证与序列化，FastAPI 核心依赖 |
| **Pydantic-Settings** | `pip install pydantic-settings` | 环境变量/配置文件与 Pydantic 模型绑定 |
| **Marshmallow** | `pip install marshmallow` | 轻量级对象序列化/反序列化库 |
| **Cerberus** | `pip install cerberus` | 轻量级数据验证 |

```python
# FastAPI 示例
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float
    tax: float | None = None

@app.post("/items/")
async def create_item(item: Item):
    return {"item": item, "total": item.price + (item.tax or 0)}
# 自动生成 Swagger UI: http://localhost:8000/docs
```

---

## 2. 数据处理与科学计算

### 数据框与表格处理

| 包名 | 安装命令 | 说明 | 备注 |
|------|----------|------|------|
| **Pandas** ⭐ | `pip install pandas` | 数据分析和处理的事实标准 | 下载量请查 PyPI BigQuery/第三方统计 |
| **Polars** ⭐ | `pip install polars` | Rust 编写的高性能 DataFrame，常在列式/并行场景表现突出 | 下载量请查 PyPI BigQuery/第三方统计 |
| **PyArrow** | `pip install pyarrow` | Apache Arrow 的 Python 绑定，列式内存格式 | 下载量请查 PyPI BigQuery/第三方统计 |
| **Dask** | `pip install dask[dataframe]` | 并行计算 + 分布式 DataFrame | 下载量请查 PyPI BigQuery/第三方统计 |
| **Modin** | `pip install modin` | 分布式 Pandas 替代品，API 兼容 | 下载量请查 PyPI BigQuery/第三方统计 |
| **vaex** | `pip install vaex` | 内存映射的大规模数据框处理 | 下载量请查 PyPI BigQuery/第三方统计 |

### 数值计算与科学计算

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **NumPy** ⭐ | `pip install numpy` | 多维数组与矩阵运算基石 |
| **SciPy** | `pip install scipy` | 科学计算库（优化、积分、插值、信号、统计） |
| **Numba** | `pip install numba` | JIT 编译 Python/NumPy 代码为机器码 |
| **CuPy** | `pip install cupy` | NumPy 的 GPU 加速替代品 |
| **Xarray** | `pip install xarray` | 带标签的多维数组（NetCDF 等） |
| **Zarr** | `pip install zarr` | 分块压缩 N 维数组存储 |

### 大数据与分布式

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **PySpark** | `pip install pyspark` | Apache Spark 的 Python API |
| **Ray** | `pip install ray` | 分布式计算与 AI 训练框架 |
| **Flink** | `pip install apache-flink` | 流处理引擎 Python API |

### 可视化

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Matplotlib** | `pip install matplotlib` | 最成熟的静态图表库 |
| **Seaborn** | `pip install seaborn` | 基于 Matplotlib 的统计可视化 |
| **Plotly** | `pip install plotly` | 交互式 Web 可视化 |
| **Bokeh** | `pip install bokeh` | 浏览器交互可视化 |
| **Altair** | `pip install altair` | 声明式可视化（Vega-Lite） |
| **PyQtGraph** | `pip install pyqtgraph` | 实时高性能科学绘图 |
| **Rich** ⭐ | `pip install rich` | 终端富文本、表格、进度条、树形图 |
| **Tqdm** | `pip install tqdm` | 轻量级进度条 |

```python
# Polars 高性能示例（比 Pandas 快得多）
import polars as pl

df = pl.read_csv("big_data.csv")
result = df.filter(pl.col("age") > 18).group_by("city").agg(pl.col("income").mean())

# Rich 终端美化
from rich.console import Console
from rich.table import Table
console = Console()
table = Table(title="Stars")
table.add_column("Name", style="cyan")
table.add_column("Stars", style="magenta")
table.add_row("Polars", "★★★★★")
console.print(table)
```

---

## 3. 机器学习、AI 与 LLM

### 深度学习框架

| 包名 | 安装命令 | 说明 | 场景 |
|------|----------|------|------|
| **PyTorch** ⭐ | `pip install torch` | Meta 开源动态图深度学习框架，研究首选 | 研究、CV、NLP、生成模型 |
| **TensorFlow** | `pip install tensorflow` | Google 静态图深度学习框架，生产部署强 | 生产级大规模模型 |
| **Keras** | `pip install keras` | Keras 3 是独立多后端高级神经网络 API，支持 TensorFlow/JAX/PyTorch/OpenVINO 后端 | 快速原型 |
| **JAX** ⭐ | `pip install jax[cuda]` | Google 高性能数值计算+自动微分，TPU 支持 | 科研、大规模训练 |
| **Flax** | `pip install flax` | JAX 之上的神经网络库 | JAX 生态 |
| **MLX** | `pip install mlx` | Apple Silicon 优化的机器学习框架 | M 系列芯片 |
| **ONNX Runtime** | `pip install onnxruntime` | 跨平台推理加速引擎 | 模型部署 |

### 传统机器学习

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Scikit-learn** ⭐ | `pip install scikit-learn` | 最全面的传统 ML 库（分类/回归/聚类/降维） |
| **XGBoost** | `pip install xgboost` | 梯度提升决策树，竞赛神器 |
| **LightGBM** | `pip install lightgbm` | 微软高效梯度提升框架 |
| **CatBoost** | `pip install catboost` | Yandex 类别特征优化的 GBDT |
| **Optuna** | `pip install optuna` | 超参数优化框架 |
| **MLflow** | `pip install mlflow` | ML 生命周期管理与实验追踪 |
| **Weights & Biases** | `pip install wandb` | 实验追踪与可视化平台 |

### 计算机视觉

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **OpenCV-Python** ⭐ | `pip install opencv-python` | 最全面的 CV 库 |
| **Pillow** ⭐ | `pip install pillow` | 图像处理基础库 |
| ** Albumentations** | `pip install albumentations` | 快速图像增强 |
| **timm** | `pip install timm` | PyTorch 图像模型库 |
| **Ultralytics** | `pip install ultralytics` | YOLOv8/v11 目标检测 |

### NLP 与大模型

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Transformers** ⭐ | `pip install transformers` | Hugging Face 预训练模型库（BERT/GPT/LLaMA） |
| **Datasets** | `pip install datasets` | Hugging Face 大规模数据集加载 |
| **Tokenizers** | `pip install tokenizers` | 高性能分词器 |
| **Accelerate** | `pip install accelerate` | Hugging Face 分布式训练 |
| **Sentence-Transformers** | `pip install sentence-transformers` | 文本嵌入/向量化 |
| **LangChain** | `pip install langchain` | LLM 应用开发框架 |
| **LangGraph** | `pip install langgraph` | LangChain 状态机/工作流扩展 |
| **LlamaIndex** | `pip install llama-index` | RAG 与数据增强 LLM 框架 |
| **OpenAI** | `pip install openai` | OpenAI API 客户端 |
| **Anthropic** | `pip install anthropic` | Claude API 客户端 |
| **vLLM** | `pip install vllm` | 高吞吐 LLM 推理引擎 |
| **llama-cpp-python** | `pip install llama-cpp-python` | 本地运行量化 GGUF 模型 |

### 向量数据库 / RAG

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **ChromaDB** | `pip install chromadb` | 轻量级嵌入式向量数据库 |
| **FAISS** | `pip install faiss-cpu` | Meta 高效相似度搜索库 |
| **Milvus** | `pip install pymilvus` | 分布式向量数据库 |
| **Qdrant** | `pip install qdrant-client` | 高性能向量数据库 |
| **Weaviate** | `pip install weaviate-client` | 语义向量搜索引擎 |

```python
# Transformers 快速推理
from transformers import pipeline
classifier = pipeline("sentiment-analysis", model="distilbert-base-uncased")
print(classifier("I love this product!"))  # [{'label': 'POSITIVE', 'score': 0.999}]

# OpenAI API
from openai import OpenAI
client = OpenAI(api_key="sk-...")
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## 4. 数据库、ORM 与缓存

### ORM 与数据库工具

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **SQLAlchemy** ⭐ | `pip install sqlalchemy` | Python 最强大 ORM，支持 1.x/2.0 风格 |
| **Alembic** | `pip install alembic` | SQLAlchemy 数据库迁移工具 |
| **Django ORM** | (内置) | Django 内置 ORM |
| **Peewee** | `pip install peewee` | 轻量级 ORM |
| **Tortoise-ORM** | `pip install tortoise-orm` | 异步 ORM，类 Django 语法 |
| **Prisma Client Python** | `pip install prisma` | Prisma ORM 的 Python 绑定 |
| **Piccolo** | `pip install piccolo` | 异步 ORM + 查询构建器 |

### 数据库驱动

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **psycopg** ⭐ | `pip install psycopg[binary]` | PostgreSQL 驱动（v3，支持异步） |
| **PyMySQL** | `pip install pymysql` | MySQL/MariaDB 纯 Python 驱动 |
| **asyncpg** | `pip install asyncpg` | 高性能异步 PostgreSQL 驱动 |
| **aiomysql** | `pip install aiomysql` | 异步 MySQL 驱动 |
| **sqlite3** | (内置) | SQLite 内置驱动 |
| **motor** | `pip install motor` | 异步 MongoDB 驱动 |
| **redis-py** | `pip install redis` | Redis 官方 Python 客户端 |
| **pymongo** | `pip install pymongo` | MongoDB 同步驱动 |
| **cassandra-driver** | `pip install cassandra-driver` | Apache Cassandra 驱动 |
| **neo4j** | `pip install neo4j` | Neo4j 图数据库驱动 |

### 缓存

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Redis** | `pip install redis` | 分布式内存缓存/消息队列 |
| **DiskCache** | `pip install diskcache` | 本地磁盘缓存，SQLite 后端 |
| **cachetools** | `pip install cachetools` | 内存缓存工具（TTL/LRU） |
| **joblib** | `pip install joblib` | 函数结果缓存与并行执行 |
| **functools.lru_cache** | (内置) | 内置 LRU 缓存装饰器 |

```python
# SQLAlchemy 2.0 示例
from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]

engine = create_engine("postgresql+psycopg://user:pass@localhost/db")
with Session(engine) as session:
    result = session.execute(select(User).where(User.name == "Alice"))
```

---

## 5. 异步、并发与网络

### 异步核心

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **asyncio** | (内置) | Python 标准异步 I/O 库 |
| **aiohttp** ⭐ | `pip install aiohttp` | 异步 HTTP 客户端/服务端 |
| **httpx** ⭐ | `pip install httpx` | 同步+异步 HTTP/2 客户端 |
| **aiobotocore** | `pip install aiobotocore` | 异步 AWS SDK |
| **aiofiles** | `pip install aiofiles` | 异步文件操作 |
| **aio-pika** | `pip install aio-pika` | 异步 RabbitMQ 客户端 |
| **aioredis** | (已并入 redis-py) | 异步 Redis（现用 `redis.asyncio`） |

### HTTP 客户端

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **requests** ⭐ | `pip install requests` | 最人性化的同步 HTTP 库 |
| **httpx** ⭐ | `pip install httpx` | 现代 HTTP/1.1 + HTTP/2，同步+异步 |
| **urllib3** | (requests 依赖) | 底层 HTTP 连接池 |
| **httplib2** | `pip install httplib2` | 全面 HTTP 功能支持 |
| **treq** | `pip install treq` | Twisted 之上的异步 HTTP |

### RPC / 消息队列

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **gRPC** | `pip install grpcio grpcio-tools` | Google 高性能 RPC |
| **Celery** | `pip install celery[redis]` | 分布式任务队列 |
| **RQ** | `pip install rq` | 基于 Redis 的简单任务队列 |
| **Dramatiq** | `pip install dramatiq` | 替代 Celery 的轻量级任务队列 |
| **Nameko** | `pip install nameko` | 微服务 RPC 框架 |
| **Pyro5** | `pip install Pyro5` | Python 远程对象 |

```python
# httpx 异步请求
import httpx
async with httpx.AsyncClient() as client:
    resp = await client.get("https://api.github.com/user", headers={"Authorization": "token ..."})
    print(resp.json())

# Celery 任务定义
from celery import Celery
app = Celery('tasks', broker='redis://localhost:6379/0')

@app.task
def add(x, y):
    return x + y
# 调用: add.delay(4, 5)
```

---

## 6. 爬虫与自动化

### 爬虫框架

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Scrapy** ⭐ | `pip install scrapy` | 最强大异步爬虫框架 |
| **Scrapy-Playwright** | `pip install scrapy-playwright` | Scrapy + Playwright 渲染 |
| **BeautifulSoup4** ⭐ | `pip install beautifulsoup4` | HTML/XML 解析，人性化 API |
| **lxml** | `pip install lxml` | 高性能 XML/HTML 解析 |
| **html5lib** | `pip install html5lib` | 标准兼容 HTML5 解析 |
| **pyquery** | `pip install pyquery` | jQuery 风格 HTML 操作 |
| **MechanicalSoup** | `pip install mechanicalsoup` | 自动处理 Cookie/表单 |
| **requests-html** | `pip install requests-html` | requests + pyquery + 浏览器渲染 |

### 浏览器自动化

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Selenium** ⭐ | `pip install selenium` | 最通用浏览器自动化 |
| **Playwright** ⭐ | `pip install playwright` + `playwright install` | 微软现代自动化，多浏览器 |
| **DrissionPage** | `pip install DrissionPage` | 国产融合驱动（requests + 浏览器） |
| **PyAutoGUI** | `pip install pyautogui` | 跨平台 GUI 自动化（键盘鼠标） |

### 自动化工具

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **schedule** | `pip install schedule` | 人性化定时任务 |
| **APScheduler** | `pip install apscheduler` | 高级调度器（cron/间隔/日期） |
| **Fabric** | `pip install fabric` | SSH 远程执行与部署 |
| **Paramiko** | `pip install paramiko` | SSHv2 协议纯 Python 实现 |
| **Invoke** | `pip install invoke` | 本地 shell 任务执行 |

```python
# Scrapy 爬虫示例
import scrapy

class QuotesSpider(scrapy.Spider):
    name = "quotes"
    start_urls = ["http://quotes.toscrape.com/"]
    
    def parse(self, response):
        for quote in response.css("div.quote"):
            yield {
                "text": quote.css("span.text::text").get(),
                "author": quote.css("small.author::text").get(),
            }

# Playwright 自动化
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    page.screenshot(path="example.png")
    browser.close()
```

---

## 7. 测试与质量保障

### 测试框架

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **pytest** ⭐ | `pip install pytest` | 最流行测试框架，插件丰富 |
| **pytest-asyncio** | `pip install pytest-asyncio` | pytest 异步测试支持 |
| **pytest-cov** | `pip install pytest-cov` | 覆盖率报告 |
| **pytest-xdist** | `pip install pytest-xdist` | 并行测试执行 |
| **unittest** | (内置) | 标准库单元测试 |
| **Hypothesis** | `pip install hypothesis` | 基于属性的智能测试 |
| **locust** | `pip install locust` | 负载测试/性能测试 |
| **Factory Boy** | `pip install factory_boy` | 测试数据工厂 |
| **Faker** | `pip install faker` | 生成假数据 |

### Mock / 补丁

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **unittest.mock** | (内置) | 标准库 mock |
| **pytest-mock** | `pip install pytest-mock` | pytest mock 封装 |
| **responses** | `pip install responses` | requests 的 mock 库 |
| **httpretty** | `pip install httpretty` | HTTP 请求 mock |
| **vcrpy** | `pip install vcrpy` | 录制/回放 HTTP 交互 |

### 代码质量

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **ruff** ⭐ | `pip install ruff` | Rust 编写超高速 linter + formatter，替代 flake8/black |
| **Black** | `pip install black` | 代码格式化（ opinionated ） |
| **isort** | `pip install isort` | import 排序 |
| **mypy** | `pip install mypy` | 静态类型检查 |
| **pyright** | `pip install pyright` | 微软类型检查器 |
| **bandit** | `pip install bandit` | 安全漏洞扫描 |
| **pylint** | `pip install pylint` | 老牌静态分析 |
| **sourcery** | (CLI/IDE) | AI 驱动的代码重构建议 |

```python
# pytest 示例
def test_addition():
    assert 1 + 1 == 2

# Hypothesis 属性测试
from hypothesis import given, strategies as st

@given(st.integers(), st.integers())
def test_add_commutative(a, b):
    assert a + b == b + a
```

---

## 8. CLI 与 TUI 开发

### CLI 框架

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Click** ⭐ | `pip install click` | Flask 团队出品，优雅命令行框架 |
| **Typer** ⭐ | `pip install typer` | 基于 Click，用类型提示自动生成 CLI |
| **argparse** | (内置) | 标准库命令行解析 |
| **Fire** | `pip install fire` | Google 出品，自动从任意 Python 对象生成 CLI |
| **docopt** | `pip install docopt` | 从文档字符串生成 CLI |
| **Plumbum** | `pip install plumbum` | Shell 组合器 + CLI 框架 |
| **Cleo** | `pip install cleo` | 美观可测试的 CLI（Poetry 使用） |

### TUI (终端用户界面)

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Textual** ⭐ | `pip install textual` | 现代 Python TUI 框架，CSS 样式 |
| **Rich** ⭐ | `pip install rich` | 终端富文本、表格、面板、进度 |
| **curses** | (内置) | 标准库终端控制（Unix） |
| **urwid** | `pip install urwid` | 老牌终端 UI 库 |
| **npyscreen** | `pip install npyscreen` | 表单驱动的 TUI |
| **asciimatics** | `pip install asciimatics` | 跨平台终端动画与效果 |
| **prompt-toolkit** | `pip install prompt_toolkit` | 强大的交互式命令行（IPython/Jupyter 使用） |

### 终端样式与交互

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Colorama** | `pip install colorama` | Windows 跨平台 ANSI 颜色 |
| **termcolor** | `pip install termcolor` | 终端颜色输出 |
| **questionary** | `pip install questionary` | 美观交互式命令行提示 |
| **PyInquirer** | `pip install PyInquirer` | 交互式命令行问卷 |
| **alive-progress** | `pip install alive-progress` | 酷炫动态进度条 |

```python
# Typer 示例
import typer

app = typer.Typer()

@app.command()
def hello(name: str, count: int = 1):
    for _ in range(count):
        typer.echo(f"Hello {name}!")

if __name__ == "__main__":
    app()

# Textual TUI 计数器示例
from textual.app import App, ComposeResult
from textual.widgets import Button, Label

class CounterApp(App):
    count = 0
    def compose(self) -> ComposeResult:
        yield Button("Increment", id="inc")
        yield Label("0", id="count")
    
    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "inc":
            self.count += 1
            self.query_one("#count", Label).update(str(self.count))

if __name__ == "__main__":
    CounterApp().run()
```

---

## 9. 配置、日志与文档

### 配置管理

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Pydantic-Settings** ⭐ | `pip install pydantic-settings` | 环境变量/dotenv/密钥管理 |
| **python-dotenv** | `pip install python-dotenv` | `.env` 文件加载 |
| **dynaconf** | `pip install dynaconf` | 多源配置管理（YAML/TOML/ENV/Redis） |
| **omegaconf** | `pip install omegaconf` | 结构化配置，支持合并与插值 |
| **hydra-core** | `pip install hydra-core` | 插件化配置框架（Meta AI 开发） |
| **configparser** | (内置) | INI 文件解析 |
| **tomllib** | (内置 3.11+) | TOML 解析 |

### 日志

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **logging** | (内置) | 标准库日志 |
| **loguru** ⭐ | `pip install loguru` | 现代化日志库，零配置即用 |
| **structlog** | `pip install structlog` | 结构化日志 |
| **python-json-logger** | `pip install python-json-logger` | JSON 格式日志输出 |
| **sentry-sdk** | `pip install sentry-sdk` | 错误追踪与监控 |

### 文档生成

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Sphinx** | `pip install sphinx` | Python 文档生成标准工具 |
| **MkDocs** | `pip install mkdocs` | Markdown 静态站点生成 |
| **MkDocs-Material** | `pip install mkdocs-material` | 美观的 MkDocs 主题 |
| **pdoc** | `pip install pdoc` | 从 docstring 自动生成 API 文档 |
| **ReadTheDocs Sphinx Theme** | `pip install sphinx-rtd-theme` | ReadTheDocs 风格主题 |

```python
# loguru 用法（极简）
from loguru import logger

logger.add("file.log", rotation="500 MB", retention="10 days")
logger.info("User {user} logged in", user="Alice")
logger.error("Something went wrong: {e}", e=Exception("fail"))

# Pydantic-Settings 自动加载环境变量
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    debug: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 10. 图像、视频与多媒体

### 图像处理

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **Pillow** ⭐ | `pip install pillow` | Python 图像处理标准库 |
| **OpenCV-Python** ⭐ | `pip install opencv-python` | 计算机视觉全能库 |
| **imageio** | `pip install imageio` | 多格式图像读写 |
| **scikit-image** | `pip install scikit-image` | SciPy 生态图像处理算法 |
| **Pillow-JXLPy** | `pip install jxlpy` | JPEG XL 格式支持 |
| **rembg** | `pip install rembg` | AI 自动背景移除 |
| **imgaug** | `pip install imgaug` | 图像增强（现已转向 Albumentations） |

### 视频与音频

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **moviepy** | `pip install moviepy` | 视频编辑与合成 |
| **ffmpeg-python** | `pip install ffmpeg-python` | FFmpeg 包装器 |
| **pydub** | `pip install pydub` | 音频处理 |
| **librosa** | `pip install librosa` | 音频与音乐分析 |
| **soundfile** | `pip install soundfile` | 音频文件读写 |
| **wave** | (内置) | WAV 文件读写 |
| **yt-dlp** | `pip install yt-dlp` | 视频下载（YouTube 等） |

### PDF / Office

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **PyPDF2** / **pypdf** | `pip install pypdf` | PDF 读写（PyPDF2 的继任者） |
| **pdfplumber** | `pip install pdfplumber` | PDF 文本与表格精确提取 |
| **pdf2image** | `pip install pdf2image` | PDF 转图片 |
| **ReportLab** | `pip install reportlab` | PDF 生成 |
| **WeasyPrint** | `pip install weasyprint` | HTML/CSS 转 PDF |
| **python-docx** | `pip install python-docx` | Word 文档读写 |
| **openpyxl** | `pip install openpyxl` | Excel 读写 |
| **XlsxWriter** | `pip install XlsxWriter` | Excel 创建与格式化 |
| **xlrd** | `pip install xlrd` | 旧版 Excel 读取 |
| **python-pptx** | `pip install python-pptx` | PowerPoint 读写 |

```python
# Pillow 图像处理
from PIL import Image, ImageFilter
img = Image.open("photo.jpg")
img = img.convert("L").filter(ImageFilter.BLUR)
img.save("photo_blur.png")

# pdfplumber 表格提取
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            print(table)
```

---

## 11. 安全与加密

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **cryptography** ⭐ | `pip install cryptography` | 现代加密库（TLS/X509/AES/RSA） |
| **PyJWT** | `pip install PyJWT` | JSON Web Token 编码/解码 |
| **passlib** | `pip install passlib` | 密码哈希（bcrypt/argon2/scrypt） |
| **bcrypt** | `pip install bcrypt` | bcrypt 密码哈希 |
| **argon2-cffi** | `pip install argon2-cffi` | Argon2 密码哈希 |
| **itsdangerous** | `pip install itsdangerous` | 安全数据签名（Flask 使用） |
| **python-jose** | `pip install python-jose` | JOSE 标准实现（JWT/JWS/JWE） |
| **authlib** | `pip install authlib` | OAuth/OIDC 实现 |
| **oauthlib** | `pip install oauthlib` | OAuth 1/2 基础库 |
| **requests-oauthlib** | `pip install requests-oauthlib` | requests + OAuth |
| **certifi** | `pip install certifi` | Mozilla CA 证书包 |
| **PyOpenSSL** | `pip install pyopenssl` | OpenSSL 绑定 |
| **keyring** | `pip install keyring` | 系统密钥环访问 |

```python
# cryptography 加密示例
from cryptography.fernet import Fernet

key = Fernet.generate_key()
cipher = Fernet(key)
token = cipher.encrypt(b"Secret message!")
print(cipher.decrypt(token))

# PyJWT
import jwt
token = jwt.encode({"user": "alice", "exp": 1893456000}, "secret", algorithm="HS256")
payload = jwt.decode(token, "secret", algorithms=["HS256"])
```

---

## 12. 序列化与数据格式

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **json** | (内置) | JSON 编码/解码 |
| **orjson** ⭐ | `pip install orjson` | Rust 编写超高速 JSON 库，比内置快 10 倍 |
| **ujson** | `pip install ujson` | C 编写快速 JSON 库 |
| **msgpack** | `pip install msgpack` | 二进制序列化（比 JSON 快且小） |
| **protobuf** | `pip install protobuf` | Google Protocol Buffers |
| **avro** | `pip install avro` | Apache Avro 序列化 |
| **cbor2** | `pip install cbor2` | CBOR (Concise Binary Object Representation) |
| **pyyaml** | `pip install pyyaml` | YAML 解析与生成 |
| **ruamel.yaml** | `pip install ruamel.yaml` | 保留注释的 YAML 库 |
| **tomli** / **tomli-w** | `pip install tomli tomli-w` | TOML 读写（3.10 及以下） |
| **xmltodict** | `pip install xmltodict` | XML ↔ dict 转换 |
| **defusedxml** | `pip install defusedxml` | 安全的 XML 解析（防 XXE） |
| **lxml** | `pip install lxml` | 高性能 XML/HTML 处理 |
| **xml.etree** | (内置) | 标准库 XML 解析 |
| **pickle** | (内置) | Python 对象二进制序列化 |
| **dill** | `pip install dill` | 扩展 pickle，支持 lambda/闭包等 |
| **cloudpickle** | `pip install cloudpickle` | 分布式计算序列化（Ray/Dask 使用） |

```python
# orjson 高性能 JSON
import orjson

data = {"users": [{"id": i, "name": f"user_{i}"} for i in range(100000)]}
json_bytes = orjson.dumps(data, option=orjson.OPT_SERIALIZE_NUMPY)
parsed = orjson.loads(json_bytes)

# msgpack 二进制序列化
import msgpack
packed = msgpack.packb(data, use_bin_type=True)
unpacked = msgpack.unpackb(packed, raw=False)
```

---

## 13. 文本处理与 NLP

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **re** | (内置) | 正则表达式 |
| **regex** | `pip install regex` | 增强版正则（支持 Unicode 属性等） |
| **jmespath** | `pip install jmespath` | JSON 查询语言 |
| **jsonpath-ng** | `pip install jsonpath-ng` | JSONPath 实现 |
| **parsimonious** | `pip install parsimonious` | 简洁的 PEG 语法解析器 |
| **lark** | `pip install lark-parser` | 现代解析库（LALR/Earley/CYK） |
| **pyparsing** | `pip install pyparsing` | 纯 Python 组合解析器 |
| **antlr4-python3-runtime** | `pip install antlr4-python3-runtime` | ANTLR4 运行时 |
| **Levenshtein** | `pip install python-Levenshtein` | 快速编辑距离计算 |
| **fuzzywuzzy** / **thefuzz** | `pip install thefuzz` | 模糊字符串匹配 |
| **rapidfuzz** | `pip install rapidfuzz` | 超快模糊匹配（C++ 优化） |
| **chardet** / **charset-normalizer** | `pip install charset-normalizer` | 字符编码检测 |
| **ftfy** | `pip install ftfy` | 修复混乱文本编码 |
| **html** | (内置) | HTML 转义/反转义 |
| **bleach** | `pip install bleach` | HTML 安全清理（防 XSS） |
| **markdown** | `pip install markdown` | Markdown 转 HTML |
| **markdownify** | `pip install markdownify` | HTML 转 Markdown |
| **python-slugify** | `pip install python-slugify` | Unicode 文本转 URL slug |
| **inflect** | `pip install inflect` | 英文单复数/序数词生成 |
| **num2words** | `pip install num2words` | 数字转文字 |
| **pyahocorasick** | `pip install pyahocorasick` | Aho-Corasick 多模式字符串匹配 |
| **nltk** | `pip install nltk` | 经典 NLP 工具包 |
| **spaCy** ⭐ | `pip install spacy` | 工业级 NLP 流水线 |
| **TextBlob** | `pip install textblob` | 简单 NLP API（情感分析/翻译） |
| **jieba** | `pip install jieba` | 中文分词 |

```python
# rapidfuzz 模糊匹配
from rapidfuzz import fuzz, process

choices = ["Atlanta Falcons", "New York Jets", "New York Giants", "Dallas Cowboys"]
print(process.extract("atlanta falons", choices, scorer=fuzz.WRatio, limit=2))
# [('Atlanta Falcons', 91.67, 0), ('New York Jets', 30.43, 1)]

# spaCy NLP 流水线
import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple is looking at buying U.K. startup for $1 billion")
for ent in doc.ents:
    print(ent.text, ent.label_)  # Apple ORG, U.K. GPE, $1 billion MONEY
```

---

## 14. 日期时间与调度

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **datetime** | (内置) | 标准日期时间 |
| **time** | (内置) | 时间戳/睡眠 |
| **zoneinfo** | (内置 3.9+) | IANA 时区数据库 |
| **dateutil** | `pip install python-dateutil` | 强大日期解析与运算 |
| **arrow** | `pip install arrow` | 更友好的日期时间 API |
| **pendulum** | `pip install pendulum` | 直觉化日期时间（时区感知） |
| **Delorean** | `pip install delorean` | 时间旅行风格的日期时间库 |
| **maya** | `pip install maya` | 人性化日期时间（基于 pendulum） |
| **freezegun** | `pip install freezegun` | 测试时间冻结 |
| **time-machine** | `pip install time-machine` | C 扩展时间冻结（更快） |
| **APScheduler** | `pip install apscheduler` | 进程内高级调度（cron/间隔/日期） |
| **schedule** | `pip install schedule` | 极简人性化定时任务 |
| **croniter** | `pip install croniter` | cron 表达式解析 |
| **whenever** | `pip install whenever` | 现代类型安全的日期时间库 |

```python
# pendulum 示例
import pendulum

now = pendulum.now("Asia/Shanghai")
print(now.add(days=1).diff_for_humans())  # "1 day from now"
print(now.in_timezone("UTC").isoformat())

# APScheduler 定时任务
from apscheduler.schedulers.background import BackgroundScheduler
scheduler = BackgroundScheduler()
scheduler.add_job(lambda: print("Tick"), 'interval', seconds=60)
scheduler.start()
```

---

## 15. 系统、文件与运维

### 文件与路径

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **pathlib** | (内置) | 面向对象路径操作 |
| **os** / **shutil** | (内置) | 文件系统操作 |
| **glob** | (内置) | 通配符文件查找 |
| **fnmatch** | (内置) | Unix 文件名模式匹配 |
| **tempfile** | (内置) | 临时文件/目录 |
| **watchdog** | `pip install watchdog` | 文件系统事件监控 |
| **pyfilesystem2** | `pip install fs` | 文件系统抽象层 |

### 系统信息

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **psutil** ⭐ | `pip install psutil` | 进程与系统资源监控（CPU/内存/磁盘/网络） |
| **platform** | (内置) | 平台信息 |
| **GPUtil** | `pip install gputil` | GPU 监控 |
| **nvidia-ml-py** | `pip install nvidia-ml-py` | NVIDIA GPU 管理库 |

### 进程与线程

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **threading** | (内置) | 标准线程库 |
| **multiprocessing** | (内置) | 标准多进程库 |
| **concurrent.futures** | (内置) | 线程/进程池 |
| **subprocess** | (内置) | 子进程管理 |
| **Pebble** | `pip install Pebble` | 并发任务池（支持超时/取消） |

### 打包与分发

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **setuptools** | `pip install setuptools` | 传统打包工具 |
| **wheel** | `pip install wheel` | 二进制 wheel 构建 |
| **build** | `pip install build` | PEP 517 构建前端 |
| **hatch** | `pip install hatch` | 现代项目管理与打包 |
| **poetry** ⭐ | `pip install poetry` | 依赖管理与打包 |
| **pdm** | `pip install pdm` | 现代 Python 包管理器 |
| **uv** ⭐ | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | 极速 Python 包管理器与项目管理 |
| **twine** | `pip install twine` | PyPI 上传工具 |
| **pyinstaller** | `pip install pyinstaller` | 打包为独立可执行文件 |
| **cx_Freeze** | `pip install cx_Freeze` | 跨平台可执行文件打包 |
| **Nuitka** | `pip install nuitka` | Python → C 编译器 |
| **cibuildwheel** | `pip install cibuildwheel` | CI 构建多平台 wheel |

### 容器与部署

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **docker** | `pip install docker` | Docker SDK |
| **kubernetes** | `pip install kubernetes` | K8s Python 客户端 |
| **gunicorn** | `pip install gunicorn` | WSGI HTTP 服务器 |
| **supervisor** | `pip install supervisor` | 进程管理 |
| **honcho** | `pip install honcho` | Procfile 进程管理 |

```python
# psutil 系统监控
import psutil

print(f"CPU: {psutil.cpu_percent()}%")
print(f"Memory: {psutil.virtual_memory().percent}%")
print(f"Disk: {psutil.disk_usage('/').percent}%")
for proc in psutil.process_iter(['pid', 'name', 'cpu_percent']):
    if proc.info['cpu_percent'] > 50:
        print(f"High CPU: {proc.info}")

# watchdog 文件监控
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class Handler(FileSystemEventHandler):
    def on_modified(self, event):
        print(f"File {event.src_path} modified")

observer = Observer()
observer.schedule(Handler(), path='./src', recursive=True)
observer.start()
```

---

### 16. 开发工具与辅助库

### 静态分析与 AST 操作 (代码分析利器)

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **ast** | (内置) | 标准库抽象语法树解析 |
| **libcst** ⭐ | `pip install libcst` | Instagram 开源的具象语法树 (CST)，保留注释和格式，适合自动化重构 |
| **parso** | `pip install parso` | 支持容错的 Python 解析器 (Jedi 的底层) |
| **tree-sitter-python** | `pip install tree-sitter` | Tree-sitter 高性能增量解析器 Python 绑定 |
| **astroid** | `pip install astroid` | 增强版 AST，支持类型推导 (Pylint 的底层) |

### 类型系统

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **typing** | (内置) | 类型提示基础 |
| **typing-extensions** | `pip install typing-extensions` | 新版类型特性向后移植 |
| **Pydantic** | `pip install pydantic` | 运行时类型验证 |
| **beartype** | `pip install beartype` | O(1) 运行时类型检查 |
| **typeguard** | `pip install typeguard` | 运行时类型检查 |
| **overrides** | `pip install overrides` | `@override` 装饰器检查 |

### 数据结构

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **collections** | (内置) | 容器数据类型 |
| **dataclasses** | (内置 3.7+) | 数据类 |
| **attrs** | `pip install attrs` | 高级类装饰器（dataclasses 的前身/增强） |
| **pydantic-dataclasses** | (内置) | Pydantic 风格 dataclass |
| **frozenlist** | `pip install frozenlist` | 不可变列表 |
| **immutables** | `pip install immutables` | 不可变映射 |
| **sortedcontainers** | `pip install sortedcontainers` | 排序列表/字典/集合 |
| **blist** | `pip install blist` | 历史包，最新发布较旧；Python 3.11+ 项目不建议作为默认选择 |

### 函数式编程

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **toolz** | `pip install toolz` | 函数式编程工具集 |
| **cytoolz** | `pip install cytoolz` | Cython 加速版 toolz |
| **fn.py** | `pip install fn.py` | Scala 风格函数式编程 |
| **returns** | `pip install returns` | 类型安全的函数式编程（Maybe/Either/IO） |

### 实用工具

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **tenacity** | `pip install tenacity` | 通用重试机制 |
| **retrying** | `pip install retrying` | 简单重试装饰器 |
| **backoff** | `pip install backoff` | 指数退避重试 |
| **python-box** | `pip install python-box` | 点号访问的字典 |
| **addict** | `pip install addict` | 自动创建嵌套字典 |
| **boltons** | `pip install boltons` | 通用实用工具集 |
| **more-itertools** | `pip install more-itertools` | itertools 扩展 |
| **tqdm** | `pip install tqdm` | 进度条 |
| **tabulate** | `pip install tabulate` | 表格格式化输出 |
| **pprint** | (内置) | 漂亮打印 |
| **icecream** | `pip install icecream` | 调试打印增强 |
| **devtools** | `pip install devtools` | 开发调试工具 |
| **pdb++** | `pip install pdbpp` | 增强版 pdb |
| **ipdb** | `pip install ipdb` | IPython 调试器 |
| **ipython** | `pip install ipython` | 增强交互式 Python |
| **jedi** | `pip install jedi` | 自动补全库 |
| **pkginfo** | `pip install pkginfo` | 包元数据查询 |
| **pipdeptree** | `pip install pipdeptree` | 依赖树可视化 |
| **pip-audit** | `pip install pip-audit` | 依赖安全漏洞扫描 |

### 插件系统

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **pluggy** | `pip install pluggy` | 极简插件系统（pytest 使用） |
| **stevedore** | `pip install stevedore` | OpenStack 插件管理 |

### 装饰器与元编程

| 包名 | 安装命令 | 说明 |
|------|----------|------|
| **decorator** | `pip install decorator` | 装饰器辅助（签名保留） |
| **wrapt** | `pip install wrapt` | 健壮的对象代理/装饰器 |
| **cached-property** | (内置 3.8+) | `@cached_property` |
| **functools.lru_cache** | (内置) | LRU 缓存 |
| **cachetools** | `pip install cachetools` | 扩展缓存策略 |

```python
# tenacity 重试
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=4, max=10))
def call_api():
    import random
    if random.random() < 0.8:
        raise ConnectionError("API failed")
    return "success"

# python-box 点号访问
from box import Box
b = Box({"user": {"name": "Alice", "age": 30}})
print(b.user.name)  # "Alice"

# icecream 调试
from icecream import ic
ic(x, y, z)  # 自动打印变量名和值
```

---

## 快速安装命令合集

### 全栈 Web 开发
```bash
pip install fastapi[standard] uvicorn[standard] sqlalchemy alembic psycopg pydantic-settings
```

### 数据科学
```bash
pip install numpy pandas polars scipy matplotlib seaborn plotly jupyterlab
```

### 机器学习
```bash
pip install scikit-learn xgboost lightgbm optuna mlflow
```

### 深度学习
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers datasets accelerate
```

### LLM / RAG
```bash
pip install openai langchain langgraph llama-index chromadb sentence-transformers
```

### 爬虫
```bash
pip install scrapy beautifulsoup4 lxml playwright selenium requests httpx
```

### 异步服务
```bash
pip install aiohttp httpx redis celery[redis] asyncpg
```

### CLI 开发
```bash
pip install typer rich textual click
```

### 测试与质量
```bash
pip install pytest pytest-asyncio pytest-cov hypothesis faker ruff mypy bandit
```

### 通用工具
```bash
pip install loguru pydantic python-dotenv tenacity psutil orjson msgpack pyyaml
```

---

> **提示**: 所有包均可在 [PyPI](https://pypi.org/) 搜索获取最新版本信息。建议使用 `uv` 替代 `pip` 以获得更快的安装速度：
> ```bash
> # 安装 uv
> curl -LsSf https://astral.sh/uv/install.sh | sh
> # 使用 uv 安装（常见场景下解析/下载更快，实际收益取决于环境）
> uv pip install fastapi polars ruff
> # 创建虚拟环境 + 安装
> uv venv && uv pip install -r requirements.txt
> ```
