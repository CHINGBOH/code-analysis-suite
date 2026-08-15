# Python 打包生态深度调研报告

> **调研来源**: https://packaging.python.org/ (Python Packaging User Guide)  
> **调研日期**: 2026-05-28  
> **维护组织**: PyPA (Python Packaging Authority)  
> **适用 Python 版本**: 3.9+

> **事实校验补充（2026-05-29）**: 本文以 PyPA 文档为主线；规范类事实应以 packaging.python.org 的 Specifications 和 peps.python.org 为准。Core Metadata 2.5 已在 2025-09 批准，合法版本包含 1.0/1.1/1.2/2.1/2.2/2.3/2.4/2.5。来源: https://packaging.python.org/specifications/ , https://packaging.python.org/specifications/core-metadata/

---

## 目录

1. [packaging.python.org 概述](#1-packagingpythonorg-概述)
2. [pip 详解：工作原理与内部机制](#2-pip-详解工作原理与内部机制)
3. [Wheel 二进制分发格式深度解析](#3-wheel-二进制分发格式深度解析)
4. [如何构建二进制 Wheel（含 C 扩展）](#4-如何构建二进制-wheel含-c-扩展)
5. [PyPI 包索引机制与 Simple API](#5-pypi-包索引机制与-simple-api)
6. [如何建立私有包索引](#6-如何建立私有包索引)
7. [打包后端（Build Backend）全景对比](#7-打包后端build-backend全景对比)
8. [打包工作流工具对比](#8-打包工作流工具对比)
9. [核心元数据规范（Core Metadata）](#9-核心元数据规范core-metadata)
10. [分发与上传流程](#10-分发与上传流程)
11. [Entry Points 与脚本分发](#11-entry-points-与脚本分发)
12. [最佳实践与常见陷阱](#12-最佳实践与常见陷阱)

---

## 1. packaging.python.org 概述

### 1.1 这是什么网站

**packaging.python.org** 是由 **PyPA (Python Packaging Authority)** 维护的官方打包用户指南，也是 Python 打包生态中面向用户和工具互操作规范的首要入口之一；具体工具行为仍应以各工具官方文档和相关 PEP 为准。

- **GitHub 仓库**: `github.com/pypa/packaging.python.org`
- **维护者**: PyPA 工作组成员（志愿者 + 核心开发者）
- **目标读者**: 需要分发 Python 包或安装第三方包的开发者
- **文档性质**: 教程(Tutorials) + 指南(Guides) + 规范(Specifications) + 讨论(Discussions)

### 1.2 网站结构

```
packaging.python.org/
├── Overview/              # 打包概述与决策树
│   └── 决定你的项目需要什么打包方案
├── Tutorials/
│   ├── Installing Packages          # 如何安装包
│   ├── Managing Application Dependencies  # 依赖管理
│   └── Packaging Python Projects    # 首次打包教程
├── Guides/
│   ├── Package Installation         # 安装相关
│   ├── Building & Distributing      # 构建与分发
│   └── Miscellaneous                # 其他主题
├── Discussions/
│   ├── Deploying Python Applications
│   ├── pip vs easy_install
│   └── 各种深度讨论
├── Specifications/          # PyPA 互操作规范（PEP 实现）
│   ├── Core Metadata        # 核心元数据规范
│   ├── Binary Distribution Format (Wheel)
│   ├── Simple Repository API
│   ├── Version Specifiers
│   ├── Name Format
│   ├── Entry Points
│   └── ... (20+ 份规范)
└── Glossary/                # 术语表
```

### 1.3 PyPA 是什么

**PyPA (Python Packaging Authority)** 是维护 Python 打包工具和标准的志愿者工作组。

| 项目 | 说明 | 地位 |
|------|------|------|
| **pip** | 包安装器 | 事实标准 |
| **setuptools** | 构建后端 | 历史最悠久 |
| **build** | PEP 517 构建前端 | 官方推荐 |
| **twine** | 上传工具 | 官方推荐 |
| **virtualenv** | 虚拟环境 | 标准库 venv 的超集 |
| **wheel** | 二进制格式 | 标准 |
| **packaging** | 版本/依赖解析库 | 底层基础 |
| **hatch / hatchling** | 工作流 + 构建后端 | 新兴主流 |
| **flit / flit-core** | 轻量打包工具 | 极简派首选 |
| **pdm** | 现代包管理器 | 后起之秀 |
| **poetry / poetry-core** | 依赖+打包一体 | 流行度高 |

---

## 2. pip 详解：工作原理与内部机制

### 2.1 pip 是什么

**pip** 是 Python 的**标准包安装器** (Package Installer for Python)，由 PyPA 维护。

```bash
# 基础用法
python -m pip install SomePackage
python -m pip install SomePackage==1.0.4
python -m pip install "SomePackage>=1.0.4,<2.0.0"
python -m pip install -e .                    # 可编辑安装
python -m pip install -r requirements.txt     # 从文件安装
python -m pip install --index-url https://... # 指定索引源
python -m pip install --no-binary :all:       # 强制从源码构建
```

### 2.2 pip 安装流程（内部机制）

```
┌─────────────────────────────────────────────────────────────────────┐
│                     pip install 完整流程                             │
├─────────────────────────────────────────────────────────────────────┤
│ 1. 解析命令行参数                                                    │
│    └─ 确定安装目标、版本约束、索引源、缓存策略                        │
│                                                                     │
│ 2. 查询包索引 (Simple API)                                           │
│    └─ GET https://pypi.org/simple/package-name/                     │
│    └─ 获取可用版本列表和文件列表（HTML/JSON）                         │
│                                                                     │
│ 3. 依赖解析 (Dependency Resolution)                                  │
│    └─ 使用 backtracking 算法解析依赖树                              │
│    └─ pip 20.3+ 引入新解析器，解决"依赖地狱"问题                     │
│                                                                     │
│ 4. 下载分发文件                                                      │
│    └─ 优先选择 Wheel（构建分发）> sdist（源码分发）                   │
│    └─ 根据兼容性标签筛选可用 wheel                                   │
│                                                                     │
│ 5. 构建（如果需要）                                                  │
│    └─ sdist 需要调用 build backend 构建成 wheel                     │
│    └─ 在隔离环境中安装 build-system requires                         │
│                                                                     │
│ 6. 安装 Wheel                                                       │
│    └─ 解压 wheel ZIP 到 site-packages                                │
│    └─ 执行 .data/ 目录 spread 操作（移动 scripts/headers 等）       │
│    └─ 生成 .dist-info/RECORD 和 .pyc 文件                           │
│                                                                     │
│ 7. 写入安装元数据                                                    │
│    └─ 更新 .dist-info/INSTALLER, REQUESTED 等                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 pip 的依赖解析器

**pip 20.3+** 引入了基于 **backtracking** 的新解析器，替代了旧的"递归安装"方式。

```
旧解析器的问题：
  安装 A→B→C，如果 B 和 C 对 D 的版本要求冲突，旧解析器可能静默安装错误版本

新解析器 (backtracking)：
  1. 收集所有包的版本约束
  2. 尝试找到一个满足所有约束的版本组合
  3. 如果冲突，回退(backtrack)并尝试其他版本
  4. 如果无法解决，明确报告冲突（而非静默失败）
```

**性能提示**: 如果解析过慢，可以先用 `pip cache purge` 清理缓存，或使用 `uv` 替代。

### 2.4 pip 缓存机制

```bash
# 查看缓存位置
python -m pip cache dir
# ~/.cache/pip/  (Linux)
# ~/Library/Caches/pip/  (macOS)
# %LocalAppData%\pip\Cache\  (Windows)

# 缓存内容
python -m pip cache list        # 列出缓存的 wheel
python -m pip cache info        # 缓存统计
python -m pip cache purge       # 清空缓存
python -m pip cache remove <pattern>  # 删除特定缓存
```

| 缓存类型 | 说明 |
|----------|------|
| **HTTP 缓存** | 索引页面、文件下载的 HTTP 响应缓存 |
| **Wheel 缓存** | 已下载/构建的 wheel 文件，避免重复下载和构建 |
| **自检查缓存** | pip 自身更新的检查缓存 |

### 2.5 pip 安全相关

```bash
# 推荐的安全安装方式
python -m pip install --require-hashes -r requirements.txt  # 校验哈希
python -m pip install --only-binary :all: SomePackage       # 只安装二进制 wheel
python -m pip install --no-deps SomePackage                 # 不安装依赖（手动管理）
```

- pip 默认使用 HTTPS 连接 PyPI
- 支持 `--trusted-host`（不推荐用于生产）
- 支持 `hash-checking mode`（requirements.txt 中包含 `--hash=sha256:...`）

---

## 3. Wheel 二进制分发格式深度解析

### 3.1 什么是 Wheel

**Wheel** 是 Python 的**官方二进制分发格式**，由 **PEP 427** 定义。

> Wheel 是一个 **ZIP 格式归档文件**，扩展名为 `.whl`，包含几乎按最终安装位置组织的文件。

**核心优势**:
- ✅ **安装速度快**: 无需构建步骤，直接解压即可
- ✅ **确定性**: 构建一次，到处安装（同一平台）
- ✅ **纯 Python 兼容性**: 纯 Python wheel 可跨平台使用
- ✅ **避免执行 setup.py**: 更安全，setup.py 可能包含任意代码

### 3.2 Wheel 文件命名规范（PEP 425）

```
{distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl

示例:
requests-2.31.0-py3-none-any.whl
numpy-1.24.3-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl
pytorch-2.0.1+cu118-cp311-cp311-linux_x86_64.whl
```

| 标签 | 示例 | 说明 |
|------|------|------|
| **distribution** | `requests` | 包名（规范化后） |
| **version** | `2.31.0` | 版本号（规范化后） |
| **build tag** | `1` | 可选，构建编号，用于区分同一版本的不同构建 |
| **python tag** | `py3`, `cp311`, `py2.py3` | Python 实现和版本 |
| **abi tag** | `none`, `cp311`, `abi3` | ABI（应用二进制接口） |
| **platform tag** | `any`, `linux_x86_64`, `win_amd64` | 目标平台 |

**兼容性标签详细说明**:

```
Python Tag:
  py3      → 任何 Python 3 实现（CPython, PyPy, Jython...）
  cp311    → CPython 3.11 专用
  pp39     → PyPy 3.9
  py2.py3  → Python 2 和 3 通用（旧包）

ABI Tag:
  none     → 纯 Python，无 ABI 要求
  cp311    → CPython 3.11 ABI
  cp311m   → CPython 3.11 with pymalloc（旧版本）
  abi3     → 稳定 ABI，兼容所有 Python 3.x（见 Limited API）

Platform Tag:
  any      → 任何平台
  linux_x86_64 → Linux x86_64
  manylinux2014_x86_64 → 兼容多发行版的 Linux wheel（PEP 600）
  macosx_11_0_x86_64 → macOS 11.0 x86_64
  win_amd64 → Windows 64-bit
```

### 3.3 Wheel 内部结构

```bash
# 查看 wheel 内容
unzip -l requests-2.31.0-py3-none-any.whl
```

```
requests-2.31.0-py3-none-any.whl
├── requests/                    # 包代码（安装到 site-packages）
│   ├── __init__.py
│   ├── api.py
│   └── ...
├── requests-2.31.0.dist-info/   # 元数据目录
│   ├── METADATA                 # 核心元数据（PEP 566/643）
│   ├── WHEEL                    # wheel 自身元数据
│   ├── RECORD                   # 文件清单 + SHA256 哈希
│   ├── INSTALLER               # 记录安装器（如 pip）
│   ├── REQUESTED               # 标记是否为直接请求安装（非依赖）
│   ├── LICENSE                 # 许可证文件（PEP 639）
│   └── entry_points.txt        # 入口点定义
└── requests-2.31.0.data/        # 非 site-packages 数据（可选）
    ├── scripts/                 # 安装到 bin/ 的脚本
    ├── headers/                 # C 头文件
    ├── data/                    # 其他数据文件
    └── purelib/platlib/         # 覆盖安装位置的文件
```

**WHEEL 文件示例**:
```
Wheel-Version: 1.0
Generator: bdist_wheel (0.41.2)
Root-Is-Purelib: true
Tag: py3-none-any
Build: 1
```

**RECORD 文件示例**:
```
requests/__init__.py,sha256=AVTFPZpEKzuHr7OvQZmhaU3LvwKz06AJw8mT_pNh2yI,3144
requests/api.py,sha256=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,1234
requests-2.31.0.dist-info/METADATA,sha256=...,2847
requests-2.31.0.dist-info/WHEEL,sha256=...,87
requests-2.31.0.dist-info/RECORD,,
```

### 3.4 纯 Python Wheel vs 平台 Wheel

| 类型 | Python Tag | ABI Tag | Platform Tag | 说明 |
|------|-----------|---------|--------------|------|
| **纯 Python Wheel** | `py3` | `none` | `any` | 跨平台通用，无需编译 |
| **通用 Wheel** | `py2.py3` | `none` | `any` | Python 2+3（旧） |
| **平台 Wheel** | `cp311` | `cp311` | `linux_x86_64` | C 扩展，平台特定 |
| **稳定 ABI Wheel** | `cp39`/`cp310`/... | `abi3` | `linux_x86_64` | 使用 Limited API，兼容所有 Python 3.x |

**构建纯 Python Wheel**:
```bash
python -m build --wheel
# 自动检测为纯 Python，生成 py3-none-any.whl
```

### 3.5 Wheel 安装过程

```python
# pip 安装 wheel 的内部步骤

# 1. 解析文件名，检查兼容性标签
#    - Python 版本是否匹配
#    - ABI 是否匹配
#    - 平台是否匹配

# 2. 解压 ZIP 到临时目录

# 3. 根据 Root-Is-Purelib 决定安装目标
#    - true  → site-packages (purelib)
#    - false → site-packages (platlib) [平台特定]

# 4. Spread .data/ 目录
#    - .data/scripts/    → /usr/local/bin/ 或 venv/bin/
#    - .data/headers/    → include/
#    - .data/data/       → share/

# 5. 重写 shebang (#!python → #!/path/to/venv/python)

# 6. 生成 .pyc 字节码

# 7. 验证 RECORD 哈希

# 8. 写入 INSTALLER 和 REQUESTED 文件
```

---

## 4. 如何构建二进制 Wheel（含 C 扩展）

### 4.1 为什么二进制 Wheel 特殊

含 C/C++/Rust/Fortran 扩展的包需要**编译**，产生平台特定的二进制文件：
- 不同操作系统（Linux/macOS/Windows）
- 不同架构（x86_64, arm64, aarch64）
- 不同 Python 版本和 ABI

### 4.2 构建后端选择

| 扩展语言 | 推荐构建后端 | 说明 |
|----------|-------------|------|
| **C/C++** | setuptools / scikit-build-core / meson-python | 传统选择 / CMake / Meson |
| **Rust** | Maturin / setuptools-rust | PyO3 / Rust-CPython |
| **Fortran** | meson-python / numpy.distutils | f2py |
| **Cython** | setuptools | .pyx → .c → .so |

### 4.3 使用 setuptools 构建 C 扩展

```toml
# pyproject.toml
[build-system]
requires = ["setuptools>=61.0", "wheel", "Cython>=3.0"]
build-backend = "setuptools.build_meta"

[project]
name = "mypackage"
version = "1.0.0"
requires-python = ">=3.9"
```

```python
# setup.py（仅在需要动态配置或 C 扩展时保留）
from setuptools import setup, Extension

ext_modules = [
    Extension(
        "mypackage._core",
        sources=["src/mypackage/_core.c"],
        include_dirs=["/usr/include"],
        libraries=["m"],
    )
]

setup(ext_modules=ext_modules)
```

### 4.4 使用 scikit-build-core（CMake 项目）

```toml
# pyproject.toml
[build-system]
requires = ["scikit-build-core>=0.5"]
build-backend = "scikit_build_core.build"

[project]
name = "mypackage"
version = "1.0.0"

[tool.scikit-build]
# CMake 配置自动检测
```

### 4.5 使用 Maturin（Rust 项目）

```toml
# pyproject.toml
[build-system]
requires = ["maturin>=1.0"]
build-backend = "maturin"

[project]
name = "mypackage"
version = "1.0.0"
```

```bash
# Cargo.toml 定义 Rust 依赖
# src/lib.rs 使用 PyO3

maturin build --release        # 构建 wheel
maturin publish                # 上传到 PyPI
```

### 4.6 跨平台 Wheel 构建：cibuildwheel

**cibuildwheel** 是在 CI 中自动构建多平台 wheel 的标准工具。

```yaml
# .github/workflows/build-wheels.yml
name: Build Wheels

on: [push, pull_request]

jobs:
  build_wheels:
    name: Build wheels on ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4
      - name: Build wheels
        uses: pypa/cibuildwheel@v2.16
        env:
          CIBW_SKIP: "pp* cp36-* cp37-*"  # 跳过 PyPy 和旧 Python
          CIBW_MANYLINUX_X86_64_IMAGE: manylinux2014
          CIBW_ARCHS_MACOS: "x86_64 arm64"

      - uses: actions/upload-artifact@v4
        with:
          name: wheels-${{ matrix.os }}
          path: ./wheelhouse/*.whl
```

**cibuildwheel 构建矩阵**:
```
Python 版本 × OS × 架构 = 大量 wheel

例如：
  CPython 3.9, 3.10, 3.11, 3.12, 3.13
  × Linux (x86_64, aarch64, i686, ppc64le, s390x)
  × macOS (x86_64, arm64, universal2)
  × Windows (AMD64, x86, ARM64)
  = 最多 60+ 个 wheel

使用 Limited API (abi3) 可减少到：
  1 Python 版本 × OS × 架构
```

### 4.7 Manylinux 标准（PEP 513/600）

**Manylinux** 是一组 Docker 镜像，确保在旧版 Linux 上编译的 wheel 能在新版上运行。

| 标准 | 最低 glibc | 支持范围 | 镜像 |
|------|-----------|----------|------|
| manylinux1 | 2.5 | CentOS 5 | 已废弃 |
| manylinux2010 | 2.12 | CentOS 6 | 已废弃 |
| manylinux2014 | 2.17 | CentOS 7+ | 主流 |
| manylinux_2_24 | 2.24 | Debian 9+ | 较少使用 |
| manylinux_2_28 | 2.28 | RHEL 8+ | 现代 |
| manylinux_2_34 | 2.34 | RHEL 9+ | 最新 |

```bash
# 使用 manylinux 构建
docker run -v $(pwd):/io quay.io/pypa/manylinux2014_x86_64 /io/build.sh

# build.sh 内部
/opt/python/cp311-cp311/bin/pip install build
/opt/python/cp311-cp311/bin/python -m build --wheel
auditwheel repair dist/*.whl -w /io/wheelhouse/
```

### 4.8 Limited API / 稳定 ABI（PEP 384）

```c
// 在 C 扩展中使用 Limited API
#define Py_LIMITED_API 0x03090000  // Python 3.9+
#include <Python.h>

// 这样构建的 wheel 使用 abi3 标签
// 一个 wheel 兼容所有 Python 3.9+
```

**优点**: 大幅减少 wheel 构建数量  
**缺点**: 只能使用有限的 C API 子集

---

## 5. PyPI 包索引机制与 Simple API

### 5.1 PyPI 是什么

**PyPI (Python Package Index)** 是 Python 包的官方中央仓库：
- **主站**: https://pypi.org/ （浏览）
- **Simple API**: https://pypi.org/simple/ （机器接口）
- **文件服务**: https://files.pythonhosted.org/ （文件下载）
- **测试站**: https://test.pypi.org/ （测试上传）

### 5.2 Simple Repository API

**Simple API** 是 pip 等安装器与包索引通信的标准接口，由 PEP 503/PEP 691 定义。

#### HTML 格式（v1.0+）

```html
<!-- 项目列表页: GET /simple/ -->
<!DOCTYPE html>
<html>
  <body>
    <a href="/simple/requests/">requests</a>
    <a href="/simple/numpy/">numpy</a>
  </body>
</html>

<!-- 项目详情页: GET /simple/requests/ -->
<!DOCTYPE html>
<html>
  <body>
    <a href="https://files.pythonhosted.org/.../requests-2.31.0-py3-none-any.whl"
       data-requires-python=">=3.7"
       data-core-metadata="sha256=abcdef..."
       data-yanked="security vulnerability">
       requests-2.31.0-py3-none-any.whl
    </a>
    <a href="https://files.pythonhosted.org/.../requests-2.31.0.tar.gz"
       data-requires-python=">=3.7">
       requests-2.31.0.tar.gz
    </a>
  </body>
</html>
```

#### JSON 格式（v1.1+，PEP 691）

```bash
# 请求 JSON 格式
GET /simple/requests/
Accept: application/vnd.pypi.simple.v1+json
```

```json
{
  "meta": {
    "api-version": "1.4",
    "project-status": "active"
  },
  "name": "requests",
  "files": [
    {
      "filename": "requests-2.31.0-py3-none-any.whl",
      "url": "https://files.pythonhosted.org/.../requests-2.31.0-py3-none-any.whl",
      "hashes": {"sha256": "..."},
      "requires-python": ">=3.7",
      "core-metadata": true,
      "size": 123456,
      "upload-time": "2023-05-22T15:30:00.000000Z",
      "yanked": null
    }
  ],
  "versions": ["2.31.0", "2.30.0", "2.29.0"]
}
```

### 5.3 内容协商（Content Negotiation）

```
客户端 Accept 头:
  application/vnd.pypi.simple.v1+json;q=1.0,
  application/vnd.pypi.simple.v1+html;q=0.2,
  text/html;q=0.01

服务端响应:
  Content-Type: application/vnd.pypi.simple.v1+json
```

### 5.4 pip 如何查询索引

```bash
# pip 默认查询
python -m pip install requests

# 内部流程:
# 1. GET https://pypi.org/simple/requests/
# 2. 解析 HTML/JSON，获取可用文件列表
# 3. 根据当前 Python 版本、平台、ABI 筛选兼容的 wheel
# 4. 优先选择最新版本 + wheel > sdist
# 5. 下载并安装
```

### 5.5 仓库内的"包库"结构

PyPI 上的包分为几大类（按分发方式）：

| 类别 | 特点 | 示例 |
|------|------|------|
| **纯 Python 包** | 只有 .py 文件，一个 wheel 通吃所有平台 | requests, click, rich |
| **C 扩展包** | 含编译代码，多平台多版本 wheel | numpy, pandas, pillow |
| **元包 (Meta)** | 仅依赖其他包，无实际代码 | jupyter, django[all] |
| **命名空间包** | 多个项目共享一个命名空间 | zope.interface, google-cloud-* |
| **单文件模块** | 极简，单 .py 文件 | boltons 的部分模块 |

---

## 6. 如何建立私有包索引

### 6.1 为什么需要私有索引

- 企业内部 Python 包分发
- 内部网络无法访问 PyPI
- 安全合规要求（代码不出内网）
- 依赖混淆攻击防护（Dependency Confusion）

### 6.2 方案一：devpi（功能最全面）

```bash
# 安装
pip install devpi-server devpi-web

# 启动
devpi-init
devpi-server --host 0.0.0.0 --port 3141

# 创建用户和索引
devpi use http://localhost:3141
devpi login root --password ''
devpi user -c myuser password=mypassword
devpi login myuser --password mypassword
devpi index -c myindex bases=root/pypi

# 上传包
devpi upload dist/*.whl

# 客户端配置
pip install --index-url http://localhost:3141/myuser/myindex/+simple/ mypackage
```

**devpi 特点**:
- ✅ 多索引继承（可继承 root/pypi 作为 fallback）
- ✅ 缓存/镜像 PyPI
- ✅ 包上传
- ✅ Web UI 浏览
- ✅ 复制/复制/故障转移

### 6.3 方案二：pypiserver（轻量级）

```bash
# 安装
pip install pypiserver

# 启动
pypi-server run -p 8080 ~/packages

# 上传（使用 twine）
twine upload --repository-url http://localhost:8080/simple/ dist/*

# 配置 pip
pip install --index-url http://localhost:8080/simple/ mypackage
```

### 6.4 方案三：静态文件 + Web 服务器（极简）

```bash
# 目录结构
myindex/
├── mypackage/
│   ├── mypackage-1.0.0-py3-none-any.whl
│   └── mypackage-1.0.0.tar.gz
└── anotherpkg/
    └── anotherpkg-2.0.0-py3-none-any.whl

# 启动（Python 内置）
cd myindex && python -m http.server 8080

# 或 nginx autoindex
nginx -c nginx.conf

# pip 配置
pip install --index-url http://localhost:8080/ mypackage
```

**nginx 配置示例**:
```nginx
server {
    listen 8080;
    root /var/www/packages;
    autoindex on;
    location / {
        index index.html;
    }
}
```

### 6.5 方案四：使用 pip 配置永久指向私有索引

```ini
# ~/.config/pip/pip.conf (Linux/macOS)
# %APPDATA%\pip\pip.ini (Windows)

[global]
index-url = https://mycompany.pypi.internal/simple/
trusted-host = mycompany.pypi.internal

[install]
extra-index-url = https://pypi.org/simple/
```

### 6.6 方案五：Pulp / Nexus / Artifactory（企业级）

| 产品 | 类型 | 特点 |
|------|------|------|
| **Sonatype Nexus** | 商业/开源 | 支持 PyPI, npm, Maven, Docker 等 |
| **JFrog Artifactory** | 商业 | 企业级，权限控制精细 |
| **Pulp** | 开源 | RedHat 出品，支持多格式 |

---

## 7. 打包后端（Build Backend）全景对比

### 7.1 什么是 Build Backend

```
Build Frontend (pip, build)
       ↓ 调用
Build Backend (setuptools, hatchling, flit, ...)
       ↓ 生成
Distribution (wheel, sdist)
```

**PEP 517/518** 定义了构建前端和后端分离的架构。

### 7.2 各 Build Backend 详细对比

| 特性 | **setuptools** | **hatchling** | **flit-core** | **PDM-backend** | **poetry-core** | **uv-build** | **maturin** |
|------|---------------|---------------|---------------|-----------------|-----------------|--------------|-------------|
| **定位** | 历史标准 | 现代全能 | 极简纯 Python | 现代通用 | 依赖管理优先 | 极速构建 | Rust 专用 |
| **pyproject.toml [project]** | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ Poetry 2.x 支持（旧项目常见 [tool.poetry]） | ✅ 支持 | ✅ 支持 |
| **C 扩展支持** | ✅ 原生 | ⚠️ 插件 | ❌ 不支持 | ⚠️ 插件 | ⚠️ 插件 | ⚠️ 有限 | ✅ Rust |
| **editable install** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **动态版本** | ✅ setup.py | ✅ 文件/VCS | ✅ 文件/VCS | ✅ 文件/VCS | ✅ VCS | ✅ VCS | ✅ VCS |
| **插件系统** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **构建速度** | 中等 | 快 | 很快 | 快 | 中等 | **极快** | 快 |
| **学习曲线** | 陡峭 | 平缓 | 极简 | 平缓 | 中等 | 极简 | 平缓 |
| **社区活跃度** | 高（维护模式） | 高（增长中） | 中 | 高（增长中） | 高（成熟） | 高（新兴） | 高（Rust 生态） |

### 7.3 setuptools（历史最悠久）

```toml
# pyproject.toml
[build-system]
requires = ["setuptools>=77.0.3", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "mypackage"
version = "1.0.0"
dynamic = ["dependencies"]  # 可从 setup.py 动态获取

[tool.setuptools.packages.find]
where = ["src"]
```

**特点**:
- 历史最久，兼容性最好
- 支持 C 扩展（最成熟）
- 支持 `setup.py` 动态配置
- ⚠️ 许多旧特性已废弃（`setup_requires`, `easy_install`）
- ⚠️ 配置分散在 `pyproject.toml`/`setup.py`/`setup.cfg` 中

### 7.4 hatchling（新兴主流）

```toml
# pyproject.toml
[build-system]
requires = ["hatchling>=1.26"]
build-backend = "hatchling.build"

[project]
name = "mypackage"
dynamic = ["version"]

[tool.hatch.version]
path = "src/mypackage/__init__.py"

[tool.hatch.build.targets.wheel]
packages = ["src/mypackage"]
```

**特点**:
- 现代设计，配置集中
- 强大的插件系统
- 支持环境管理（hatch CLI）
- 版本可从文件/VCS 自动提取
- 构建速度快

### 7.5 flit-core（极简派）

```toml
# pyproject.toml
[build-system]
requires = ["flit_core>=3.12.0,<4"]
build-backend = "flit_core.buildapi"

[project]
name = "mypackage"
version = "1.0.0"
authors = [{name="Author", email="a@example.com"}]
```

**特点**:
- 纯 Python 包的首选
- 极简配置，几行即可
- 不支持 C 扩展
- 无插件系统
- 构建速度极快

### 7.6 PDM-backend

```toml
# pyproject.toml
[build-system]
requires = ["pdm-backend>=2.4.0"]
build-backend = "pdm.backend"

[project]
name = "mypackage"
dynamic = ["version"]

[tool.pdm.version]
source = "scm"  # 从 Git tag 获取版本
```

**特点**:
- PDM 工具链的构建后端
- 支持 PEP 621 [project] 表
- 支持动态版本（VCS）
- 支持插件

### 7.7 poetry-core

```toml
# pyproject.toml
[build-system]
requires = ["poetry-core>=2.0.0"]
build-backend = "poetry.core.masonry.api"

# Poetry 2.x 支持标准 [project]；旧项目仍常见 [tool.poetry]
[project]
name = "mypackage"
version = "1.0.0"
authors = [{name = "Author", email = "a@example.com"}]
description = "A package"
requires-python = ">=3.9"
dependencies = ["requests>=2.31.0"]
```

**特点**:
- Poetry 工具的构建后端
- 支持标准 [project] 表；Poetry 1.x/旧项目常见 [tool.poetry]
- 依赖管理强大（lock file）
- 版本解析算法优秀
- 生态系统成熟，社区庞大

### 7.8 uv-build（极速新秀）

```toml
# pyproject.toml
[build-system]
requires = ["uv_build>=0.11.7,<0.12.0"]
build-backend = "uv_build"

[project]
name = "mypackage"
version = "1.0.0"
```

**特点**:
- Astral 出品（与 ruff 同公司）
- Rust 编写，构建速度极快
- 支持标准 [project] 表
- 目前功能相对简单，但发展迅猛

---

## 8. 打包工作流工具对比

### 8.1 工作流工具 vs 构建后端

**构建后端**只负责把源代码变成 wheel/sdist。  
**工作流工具** additionally 管理虚拟环境、依赖、任务、发布等。

| 工具 | 类型 | 虚拟环境 | 依赖锁定 | 任务运行 | 发布上传 | 特点 |
|------|------|----------|----------|----------|----------|------|
| **hatch** | 工作流 | ✅ 自动 | ❌ | ✅ | ✅ | 环境管理强大 |
| **PDM** | 工作流 | ✅ 可选 | ✅ | ✅ | ✅ | 推荐 venv；仍保留 PEP 582 模式但 PEP 582 已被拒绝 |
| **Poetry** | 工作流 | ✅ 自动 | ✅ | ✅ | ✅ | 生态最成熟 |
| **flit** | 轻量工具 | ❌ | ❌ | ❌ | ✅ | 仅打包和上传 |
| **uv** | 极速工具 | ✅ | ✅ | ❌ | ❌ | pip+venv+build 替代 |
| **pip-tools** | 辅助 | ❌ | ✅ | ❌ | ❌ | pip 的 lock 工具 |
| **Pipenv** | 工作流 | ✅ 自动 | ✅ | ❌ | ❌ | 已逐渐被 Poetry/PDM 替代 |
| **tox** | 测试矩阵 | ✅ 自动 | ❌ | ✅ | ❌ | 多环境测试 |
| **nox** | 测试矩阵 | ✅ 自动 | ❌ | ✅ | ❌ | tox 的 Pythonic 替代 |

### 8.2 Poetry 详细用法

```bash
# 初始化项目
poetry new myproject
cd myproject && poetry init

# 添加依赖
poetry add requests
poetry add --group dev pytest black
poetry add "numpy>=1.24,<2.0"

# 安装（自动创建 venv）
poetry install

# 运行命令
poetry run python script.py
poetry env activate  # 输出激活命令；也可直接使用 poetry run

# 锁定依赖
poetry lock

# 构建和发布
poetry build          # 生成 wheel + sdist
poetry publish        # 上传到 PyPI
```

### 8.3 PDM 详细用法

```bash
# 初始化
pdm init

# 添加依赖
pdm add requests
pdm add -dG test pytest  # dev group test

# 安装
pdm install

# 运行
pdm run python script.py

# PEP 582 已被拒绝；PDM 仍保留该模式，但官方更推荐 venv
pdm config python.use_venv false

# 构建和发布
pdm build
pdm publish
```

### 8.4 uv 详细用法

```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 替代 pip
uv pip install requests
uv pip install -r requirements.txt
uv pip compile requirements.in -o requirements.txt  # 类似 pip-tools

# 替代 venv
uv venv

# 替代 build
uv build

# 项目管理（实验性）
uv init myproject
uv add requests
uv run python script.py
```

**uv 的速度优势**:
- 在大量依赖解析/冷缓存/并行下载场景下，安装速度常显著快于 pip；“10-100 倍”属于 uv 项目宣传和基准口径，实际收益取决于网络、缓存和依赖图规模
- 解析速度比 Poetry/PDM 快数倍
- Rust 编写，全局缓存共享

---

## 9. 核心元数据规范（Core Metadata）

### 9.1 元数据版本演进

| 版本 | 批准时间 | 关键特性 |
|------|----------|----------|
| 1.0 | 2001 (PEP 241) | 初始版本 |
| 1.1 | 2003 (PEP 314) | Classifier, Download-URL |
| 1.2 | 2010 (PEP 345) | Requires-Dist, Requires-Python |
| 2.1 | 2018 (PEP 566) | Description-Content-Type (Markdown!) |
| 2.2 | 2020 (PEP 643) | Dynamic 字段 |
| 2.3 | 2022 (PEP 685) | 规范化 extra 名称 |
| 2.4 | 2024 (PEP 639) | License-Expression, License-File |
| 2.5 | 2025 (PEP 794) | Import-Name, Import-Namespace |

### 9.2 关键元数据字段

```
Metadata-Version: 2.4
Name: example-package
Version: 1.0.0
Summary: A short description
Description-Content-Type: text/markdown; charset=UTF-8
Author-email: "Author Name" <author@example.com>
License-Expression: MIT
License-File: LICENSE
Requires-Python: >=3.9
Classifier: Development Status :: 5 - Production/Stable
Classifier: Programming Language :: Python :: 3
Classifier: License :: OSI Approved :: MIT License
Requires-Dist: requests>=2.28.0
Requires-Dist: numpy>=1.24.0; extra == "array"
Provides-Extra: array
Project-URL: Homepage, https://github.com/user/project
Project-URL: Documentation, https://docs.example.com
Dynamic: version
```

### 9.3 pyproject.toml 中的元数据映射

```toml
[project]
name = "example-package"                    # → Name
version = "1.0.0"                           # → Version
authors = [
    {name="Author", email="a@example.com"}  # → Author-email
]
description = "A short description"         # → Summary
readme = "README.md"                        # → Description + Description-Content-Type
license = "MIT"                             # → License-Expression
license-files = ["LICENSE*"]                # → License-File
requires-python = ">=3.9"                   # → Requires-Python
classifiers = [                             # → Classifier
    "Development Status :: 5 - Production/Stable",
    "Programming Language :: Python :: 3",
]
dependencies = [                            # → Requires-Dist
    "requests>=2.28.0",
]

[project.optional-dependencies]             # → Provides-Extra + Requires-Dist
array = ["numpy>=1.24.0"]

[project.urls]                              # → Project-URL
Homepage = "https://github.com/user/project"
Documentation = "https://docs.example.com"
```

---

## 10. 分发与上传流程

### 10.1 标准分发流程

```bash
# Step 1: 项目结构
myproject/
├── pyproject.toml
├── README.md
├── LICENSE
├── src/
│   └── mypackage/
│       ├── __init__.py
│       └── module.py
└── tests/

# Step 2: 安装构建工具
python -m pip install build twine

# Step 3: 构建（生成 wheel + sdist）
python -m build
# dist/
# ├── mypackage-1.0.0-py3-none-any.whl
# └── mypackage-1.0.0.tar.gz

# Step 4: 检查
python -m twine check dist/*

# Step 5: 上传到 TestPyPI（测试）
python -m twine upload --repository testpypi dist/*

# Step 6: 上传到 PyPI（生产）
python -m twine upload dist/*
```

### 10.2 Trusted Publishing（推荐方式）

**Trusted Publishing** 是 PyPI 与 CI/CD 平台之间的安全集成，无需手动管理 API token。

**支持的 CI 平台** (2024年11月起):
- GitHub Actions
- GitLab CI/CD
- ActiveState
- Google Cloud

**GitHub Actions 配置**:
```yaml
# .github/workflows/publish.yml
jobs:
  pypi-publish:
    permissions:
      id-token: write  # 关键：允许获取 OIDC token
    steps:
      - uses: pypa/gh-action-pypi-publish@release/v1
```

**PyPI 配置**:
1. 访问 https://pypi.org/manage/account/publishing/
2. 填写：GitHub Owner / Repository / Workflow / Environment
3. 发布时自动创建项目

### 10.3 版本号规范（PEP 440）

```
版本号格式: [N!]N(.N)*[{a|b|c}N][.postN][.devN]

发布版本:
  1.0.0, 2.1.3, 2024.1.15

预发布版本:
  1.0.0a1  (alpha)
  1.0.0b2  (beta)
  1.0.0rc1 (release candidate)

开发版本:
  1.0.0.dev1

后发布版本:
  1.0.0.post1

 epoch:
  2!1.0.0  (重大版本重置)
```

---

## 11. Entry Points 与脚本分发

### 11.1 什么是 Entry Points

**Entry Points** 允许已安装的包向外界宣告"我提供了什么可被发现的组件"。

**主要用途**:
1. **console_scripts**: 创建命令行工具
2. **gui_scripts**: 创建 GUI 应用（Windows 无控制台）
3. **插件发现**: pytest 插件、pygments lexers 等

### 11.2 定义 Entry Points

```toml
# pyproject.toml
[project.scripts]
mycli = "mypackage.cli:main"       # console_scripts

[project.gui-scripts]
mygui = "mypackage.gui:launch"     # gui_scripts

[project.entry-points."pytest11"]
myplugin = "mypackage.pytest_plugin"
```

**生成的脚本** (Linux):
```bash
#!/path/to/venv/bin/python
import sys
from mypackage.cli import main
sys.exit(main())
```

**Windows 额外生成** `.exe` 包装器。

### 11.3 运行时发现 Entry Points

```python
# Python 3.8+ 标准库
import importlib.metadata

# 获取所有 console_scripts
eps = importlib.metadata.entry_points()
for ep in eps.select(group='console_scripts'):
    print(f"{ep.name} = {ep.value}")

# 加载特定 entry point
cli = eps.select(group='console_scripts', name='mycli')
func = next(iter(cli)).load()
func()  # 调用函数
```

---

## 12. 最佳实践与常见陷阱

### 12.1 项目结构最佳实践

```
myproject/
├── pyproject.toml          # 唯一配置入口
├── README.md               # 项目说明
├── LICENSE                 # 许可证（必须）
├── CHANGELOG.md            # 变更日志
├── .gitignore
├── src/                    # ✅ 使用 src 布局
│   └── mypackage/
│       ├── __init__.py
│       └── ...
├── tests/                  # 测试在包外
│   └── ...
└── docs/                   # 文档
    └── ...
```

**为什么用 src 布局**:
- 避免 `import mypackage` 意外导入开发目录而非安装版本
- 确保测试安装后的包
- 大多数现代工具默认支持

### 12.2 现代打包检查清单

```
✅ 使用 pyproject.toml 作为唯一配置入口
✅ 使用 [project] 表定义元数据（PEP 621）
✅ 使用标准 [build-system] 声明构建后端
✅ 包含 README.md（PyPI 展示用）
✅ 包含 LICENSE 文件（PEP 639）
✅ 使用 src/ 目录布局
✅ 声明 requires-python
✅ 使用版本约束（dependencies 中的 >=,<）
✅ 同时发布 wheel 和 sdist
✅ 使用 twine check 检查元数据
✅ 使用 python -m build（不直接调用 setup.py）
✅ 使用 Trusted Publishing 上传（不手动管理 token）
```

### 12.3 常见陷阱

| 错误做法 | 正确做法 | 原因 |
|----------|----------|------|
| `python setup.py install` | `pip install .` | setup.py 执行任意代码，不安全 |
| `python setup.py sdist bdist_wheel` | `python -m build` | 前者已废弃 |
| `python setup.py upload` | `twine upload` | 前者可能使用不安全的 HTTP |
| 缺少 `__init__.py` | 包含 `__init__.py` | namespace pkg 行为不同 |
| 不使用 src/ 布局 | 使用 src/ 布局 | 避免开发目录优先导入 |
| 硬编码版本号多处 | 动态读取或 VCS | 维护困难 |
| 将 tests 包含在 wheel 中 | tests 在包外 | 减少安装体积 |
| 忽略 requires-python | 声明 requires-python | 帮助安装器选择正确版本 |

### 12.4 已废弃的工具/做法

| 废弃项 | 替代方案 | 废弃原因 |
|--------|----------|----------|
| `easy_install` | `pip install` | 安全问题 |
| `python setup.py install` | `pip install .` | 安全问题 |
| `python setup.py develop` | `pip install -e .` | 安全问题 |
| `python setup.py upload` | `twine upload` | 安全问题 |
| `distutils` | `setuptools` | Python 3.12 已移除 |
| `setup_requires` | `[build-system] requires` | PEP 518 替代 |
| eggs | wheels | wheel 是标准格式 |
| `dependency_links` | 内部包索引 | 不安全 |

### 12.5 静态依赖分析（防恶意代码执行）

在构建像 `repo-inv` 这样的自动化代码分析工具时，**绝对禁止**通过执行 `python setup.py` 来获取依赖，因为这极易触发供应链攻击（任意代码执行）。

**安全解析方案**:
1. **`pyproject.toml`**: 使用标准库 `tomllib` (3.11+) 或 `tomli` 直接静态解析 `[project.dependencies]`。
2. **`requirements.txt`**: 使用 `pip-requirements-parser` 库进行静态解析，支持识别环境变量和哈希。
3. **`setup.cfg`**: 使用标准库 `configparser` 解析 `[options]` 下的 `install_requires`。
4. **规范化解析**: 使用官方 `packaging` 库 (`packaging.requirements.Requirement`) 来安全解析和比较版本约束规范（PEP 508）。

### 12.5 静态依赖分析（防恶意代码执行）

在构建像 `repo-inv` 这样的自动化代码分析工具时，**绝对禁止**通过执行 `python setup.py` 来获取依赖，因为这极易触发供应链攻击（任意代码执行）。

**安全解析方案**:
1. **`pyproject.toml`**: 使用标准库 `tomllib` (3.11+) 或 `tomli` 直接静态解析 `[project.dependencies]`。
2. **`requirements.txt`**: 使用 `pip-requirements-parser` 库进行静态解析，支持识别环境变量和哈希。
3. **`setup.cfg`**: 使用标准库 `configparser` 解析 `[options]` 下的 `install_requires`。
4. **规范化解析**: 使用官方 `packaging` 库 (`packaging.requirements.Requirement`) 来安全解析和比较版本约束规范（PEP 508）。

---

## 附录：关键 PEP 速查

| PEP | 主题 | 状态 |
|-----|------|------|
| PEP 427 | Wheel 二进制格式 | 已批准 |
| PEP 440 | 版本号规范 | 已批准 |
| PEP 503 | Simple Repository API | 已批准 |
| PEP 508 | 依赖规范语法 | 已批准 |
| PEP 517 | 构建前端/后端分离 | 已批准 |
| PEP 518 | pyproject.toml [build-system] | 已批准 |
| PEP 566 | 核心元数据 2.1 | 已批准 |
| PEP 621 | pyproject.toml [project] 表 | 已批准 |
| PEP 639 | SPDX 许可证表达式 | 已批准 |
| PEP 643 | 源分发元数据一致性 | 已批准 |
| PEP 658 | 独立元数据文件 | 已批准 |
| PEP 691 | Simple API JSON 格式 | 已批准 |
| PEP 700 | Simple API 扩展字段 | 已批准 |
| PEP 714 | 重命名 dist-info-metadata | 已批准 |
| PEP 740 | Provenance 元数据 | 已批准 |
| PEP 792 | 项目状态标记 | 已批准 |
| PEP 794 | Import-Name / Import-Namespace | 已批准 |
| PEP 753 | 知名 Project-URL 标签 | 已批准 |

---

> **参考链接**:
> - https://packaging.python.org/ — 官方打包指南
> - https://pip.pypa.io/ — pip 文档
> - https://pypi.org/ — Python 包索引
> - https://test.pypi.org/ — 测试包索引
> - https://peps.python.org/ — Python 增强提案
> - https://cibuildwheel.pypa.io/ — 跨平台 wheel 构建
