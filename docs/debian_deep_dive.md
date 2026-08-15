# Debian 系统全方位深度调研报告

> **调研日期**: 2026-05-28  
> **当前稳定版本**: Debian 13 "Trixie" (13.5, 2026-05-16)  
> **调研环境**: Ubuntu 24.04.4 LTS (基于 Debian)  
> **数据来源**: 直接系统分析 + Debian 官方文档 + 网络数据  
> **报告对标**: 参照 `linux_kernel_deep_dive.md` 的 18 章标准结构

> **事实校验补充（2026-05-29）**: Debian 官方发布页确认 Debian 13.5 于 2026-05-16 发布，Debian 13.0 于 2025-08-09 初始发布；Debian 13 生命周期为 3 年完整支持（至 2028-08-09）+ 2 年 LTS（至 2030-06-30）。Debian 13 发布公告确认包数量、代码行数、磁盘占用、主要软件版本和 riscv64/i386/armel 状态。来源: https://www.debian.org/releases/trixie/ , https://lists.debian.org/debian-announce/2025/msg00003.html

---

## 目录

1. [Debian 规模与全景概览](#1-debian-规模与全景概览)
2. [历史与版本演进](#2-历史与版本演进)
3. [仓库结构与组件](#3-仓库结构与组件)
4. [支持的 CPU 架构](#4-支持的-cpu-架构)
5. [包管理系统](#5-包管理系统)
6. [包格式与元数据](#6-包格式与元数据)
7. [Debian Policy 规范](#7-debian-policy-规范)
8. [打包系统详解](#8-打包系统详解)
9. [安全模型与更新机制](#9-安全模型与更新机制)
10. [Debian 安装程序](#10-debian-安装程序)
11. [社区治理与组织](#11-社区治理与组织)
12. [衍生发行版生态](#12-衍生发行版生态)
13. [系统初始化与服务管理](#13-系统初始化与服务管理)
14. [关键目录与文件结构](#14-关键目录与文件结构)
15. [配置管理机制](#15-配置管理机制)
16. [开发工具链](#16-开发工具链)
17. [系统管理注意事项](#17-系统管理注意事项)
18. [常用命令速查](#18-常用命令速查)

---

## 1. Debian 规模与全景概览

### 1.1 核心数字速查

| 指标 | Debian 13 (Trixie) | Debian 12 (Bookworm) | 说明 |
|------|--------------------|----------------------|------|
| **发布日期** | 2025-08-09 | 2023-06-10 | — |
| **最新小版本** | 13.5 (2026-05-16) | 12.14 (2026-05-16) | 同步发布 |
| **总包数** | **69,830** | ~64,000 | 二进制包 |
| **新增包** | 14,100+ | — | Trixie 新增 |
| **移除包** | 8,840+ | — | 过时包清理 |
| **更新包** | 44,326 | — | 占前版本的 63%+ |
| **总代码行数** | **14.6 亿行** | — | 全部包源码 |
| **总磁盘占用** | **~403 GB** | — | 全仓库 |
| **源码包数** | ~33,000+ | — | source packages |
| **内核 Kconfig 选项** | ~17,000+ | — | 来自同批 Linux 内核源码调研，不是 Debian 仓库指标 |
| **支持架构** | 7 (8 含降级) | 10 | 见第 4 章 |
| **活跃维护者** | ~1,000+ DD/DM | — | Debian 开发者 |
| **衍生发行版** | **130+** | — | 官方追踪 |
| **manpages 语言** | 多语言 | — | 含罗马尼亚语、波兰语等 |

### 1.2 当前系统包统计（Ubuntu 24.04 实测）

```
系统: Ubuntu 24.04.4 LTS (基于 Debian)
架构: amd64 + i386 (multiarch)
dpkg 版本: 1.22.6
apt 版本: 2.8.3
```

| 指标 | 数值 |
|------|------|
| 已安装包数 | **2,479** (install ok installed) |
| 残留配置包 | 21 (deinstall ok config-files) |
| dpkg info 文件 | **9,952** 个 (list/md5sums/postinst/prerm) |
| alternatives 条目 | **102** 个 |
| 文档目录 | **2,445** 个 |
| man 手册页 | **~37** 个语言目录 |
| init.d 脚本 | **44** 个 |
| systemd 自定义单元 | **100** 个 |
| 运行中服务 | **49** 个 |
| 总服务单元 | **316** 个 |
| sysctl 可调参数 | **2,475** 个 |
| debconf 所有者 | **58** 个包 |

### 1.3 包优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| **required** | 74 | 系统运行绝对必需 |
| **important** | 152 | 标准 Unix 环境必需 |
| **standard** | 25 | 标准系统包含 |
| **optional** | 2,240 | 默认安装的大多数包 |
| **extra** | 8 | 历史/废弃优先级，现代 Debian Policy 视同 optional |

### 1.4 包 Section 分布（Top 30）

| Section | 数量 | Section | 数量 |
|---------|------|---------|------|
| libs | 1,224 | introspection | 46 |
| utils | 174 | text | 42 |
| admin | 124 | fonts | 29 |
| python | 106 | oldlibs | 24 |
| gnome | 83 | kernel | 23 |
| libdevel | 72 | video | 22 |
| net | 68 | gnu-r | 19 |
| devel | 65 | sound | 18 |
| perl | 60 | editors | 18 |
| misc | 58 | graphics | 17 |
| x11 | 57 | doc | 15 |

### 1.5 Debian 包管理生态系统对比

| 发行版 | 包管理器 | 包数量 (2026) | 衍生关系 |
|--------|----------|---------------|----------|
| **Debian Sid** | APT/dpkg | ~72,860 | 上游 |
| **Ubuntu** | APT/dpkg | ~72,577 | Debian Sid 分支 |
| **Pop!_OS** | APT/dpkg | ~80,922 | Ubuntu 分支 |
| **Linux Mint** | APT/dpkg | ~77,970 | Ubuntu 分支 |
| **Debian Stable** | APT/dpkg | ~63,442 | — |
| **LMDE** | APT/dpkg | ~65,044 | Debian 直接 |
| **Arch Linux** | Pacman | ~107,724 (AUR) | 独立 |
| **Fedora** | DNF/rpm | ~70,000+ | 独立 |

### 1.6 Debian 项目总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Debian 项目全景                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Debian 社区 (DFSG)                                          │   │
│  │  ├─ Debian Developer (DD) ~1,000                            │   │
│  │  ├─ Debian Maintainer (DM) ~200                             │   │
│  │  ├─ NM (New Maintainer) 流程                                │   │
│  │  └─ Debian Constitution (民主投票)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Debian 仓库 (archive.debian.org)                            │   │
│  │  ├─ unstable (sid)   ← 开发主线                             │   │
│  │  ├─ testing (forky)  ← 冻结后成为 stable                    │   │
│  │  ├─ stable (trixie)  ← 当前生产                             │   │
│  │  ├─ oldstable (bookworm)                                    │   │
│  │  ├─ proposed-updates                                        │   │
│  │  └─ backports                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  组件 (Component)                                            │   │
│  │  ├─ main      (DFSG 完全自由, ~95%)                         │   │
│  │  ├─ contrib   (自由但依赖 non-free)                         │   │
│  │  ├─ non-free  (非自由软件)                                  │   │
│  │  └─ non-free-firmware (固件, 从 Debian 12+ 分离)           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  包管理系统                                                  │   │
│  │  ├─ dpkg   (底层包管理)                                     │   │
│  │  ├─ apt    (高级包工具)                                     │   │
│  │  ├─ aptitude (交互式 TUI)                                   │   │
│  │  ├─ synaptic (图形化 GTK)                                   │   │
│  │  └─ apt-file / deborphan / reportbug ...                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  用户系统 (桌面/服务器/嵌入式)                               │   │
│  │  ├─ 桌面: GNOME/KDE/LXDE/LXQt/Xfce                         │   │
│  │  ├─ 服务器: Web/DB/邮件/DNS/存储                           │   │
│  │  ├─ 嵌入式: ARM/ARM64/RISC-V                               │   │
│  │  └─ 云: OpenStack/Kubernetes/QEMU                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 历史与版本演进

### 2.1 Debian 版本时间线

| 版本 | 代号 | 发布日期 | EOL | LTS 结束 | ELTS 结束 | 内核 | 备注 |
|------|------|----------|-----|----------|-----------|------|------|
| 0.91 | — | ~1994 | — | — | — | — | 首个发布 |
| 0.93R6 | — | 1995-10 | — | — | — | — | — |
| 1.1 | **Buzz** | 1996-06 | — | — | — | 2.0 | 《玩具总动员》角色 |
| 1.2 | **Rex** | 1996-12 | — | — | — | — | — |
| 1.3 | **Bo** | 1997-07 | — | — | — | — | — |
| 2.0 | **Hamm** | 1998-07 | — | — | — | 2.0 | — |
| 2.1 | **Slink** | 1999-03 | 2000-09 | — | — | 2.0/2.2 | APT 引入 |
| 2.2 | **Potato** | 2000-08 | 2003-06 | — | — | 2.2 | — |
| 3.0 | **Woody** | 2002-07 | 2006-06 | — | — | 2.4 | — |
| 3.1 | **Sarge** | 2005-06 | 2008-03 | — | — | 2.4/2.6 | debian-installer |
| 4.0 | **Etch** | 2007-04 | 2010-02 | — | — | 2.6 | — |
| 5.0 | **Lenny** | 2009-02 | 2012-02 | — | — | 2.6.26 | — |
| 6.0 | **Squeeze** | 2011-02 | 2014-05 | 2016-02 | — | 2.6.32 | 首个 LTS |
| 7 | **Wheezy** | 2013-05 | 2016-04 | 2018-05 | ~2020-06 | 3.2 | multiarch |
| 8 | **Jessie** | 2015-04 | 2018-06 | 2020-06 | 2025-06 | 3.16 | systemd 默认 |
| 9 | **Stretch** | 2017-06 | 2020-07 | 2022-07 | 2027-06 | 4.9 | — |
| 10 | **Buster** | 2019-07 | 2022-09 | 2024-06 | 2029-06 | 4.19 | — |
| 11 | **Bullseye** | 2021-08 | 2024-08 | 2026-08 | 2031-06 | 5.10 | — |
| 12 | **Bookworm** | 2023-06 | 2026-06 | 2028-06 | 2033-06 | 6.1 | non-free-firmware |
| **13** | **Trixie** | **2025-08** | **2028-08** | **2030-06** | **2035-06** | **6.12** | **当前稳定** |
| 14 | **Forky** | 预计 2027 | — | — | — | — | 当前 testing |
| 15 | **Duke** | TBA | — | — | — | — | 已公布代号 |

> 所有代号均来自《玩具总动员》角色。

### 2.2 版本生命周期

```
Debian 版本生命周期 (5 年标准)

开发阶段 (约 2 年)
├─ unstable (sid)      ← 持续开发，每日更新
├─ experimental         ← 破坏性实验
├─ testing              ← 自动从 unstable 迁移 (无 RC bug)
└─ freeze               ← 冻结，进入发布准备

发布 (Release Day)
├─ stable               ← 正式发布
└─ security updates     ← 安全团队支持

维护阶段
├─ 前 3 年: 完整支持 (安全 + 一般更新)
├─ 第 4-5 年: LTS (仅安全更新，部分架构)
└─ 第 6-10 年: ELTS (付费/志愿者延长支持，更少架构)

退役
└─ archive.debian.org   ← 归档仓库
```

### 2.3 Debian 13 (Trixie) 主要软件版本

| 软件 | Trixie 版本 | 备注 |
|------|-------------|------|
| Linux Kernel | 6.12 (LTS) | — |
| GCC | 14.2 | — |
| Glibc | 2.41 | — |
| LLVM/Clang | 19 (默认) | 17, 18 可选 |
| Python | 3.13 | — |
| Perl | 5.40 | — |
| PHP | 8.4 | — |
| OpenJDK | 21 | — |
| Rust | 1.85 | — |
| MariaDB | 11.8 | — |
| PostgreSQL | 17 | — |
| Apache | 2.4.64 | — |
| Nginx | 1.26 | — |
| OpenSSH | 10.0p1 | — |
| OpenSSL | 3.5 | — |
| BIND | 9.20 | — |
| Exim | 4.98 | 默认邮件服务器 |
| Postfix | 3.10 | — |
| Samba | 4.22 | — |
| Systemd | 257 | — |
| GNOME | 48 | 默认桌面 |
| KDE Plasma | 6.3 | — |
| Xfce | 4.20 | — |
| LXQt | 2.1.0 | — |
| LXDE | 13 | — |
| GIMP | 3.0.4 | — |
| Inkscape | 1.4 | — |
| LibreOffice | 25.2 | — |
| Emacs | 30.1 | — |
| Vim | 9.1 | — |
| Bash | 5.2.37 | — |
| GnuPG | 2.4.7 | — |
| Cryptsetup | 2.7 | — |
| curl | 8.14.1 | — |

### 2.4 Debian 13 重大变更

- **riscv64 官方支持**: 首次作为一级架构支持
- **64-bit time_t**: 除 i386 外所有架构使用 64 位 time_t（2038 年问题）
- **可复现构建**: 新增 `debian-repro-status` 包，可检查本地包的可复现性
- **i386 降级**: 仅作为 amd64 协架构，不再独立安装
- **armel 降级**: 仅支持升级，不支持新安装
- **固件分离**: `non-free-firmware` 组件继续独立

---

## 3. 仓库结构与组件

### 3.1 仓库结构

```
deb.debian.org (CDN 镜像网络)
└─ debian/
   ├─ dists/
   │  ├─ sid/                    ← unstable (永远不稳定)
   │  │  ├─ main/
   │  │  │  ├─ binary-amd64/Packages.gz
   │  │  │  ├─ binary-arm64/Packages.gz
   │  │  │  ├─ source/Sources.gz
   │  │  │  └─ Contents-amd64.gz
   │  │  ├─ contrib/
   │  │  ├─ non-free/
   │  │  └─ non-free-firmware/
   │  │
   │  ├─ forky/                  ← testing (当前)
   │  │  └─ ... (同 sid 结构)
   │  │
   │  ├─ trixie/                 ← stable (当前)
   │  │  ├─ main/
   │  │  ├─ contrib/
   │  │  ├─ non-free/
   │  │  ├─ non-free-firmware/
   │  │  ├─ Release               ← GPG 签名元数据
   │  │  ├─ Release.gpg
   │  │  ├─ InRelease
   │  │  └─ Contents-amd64.gz
   │  │
   │  ├─ bookworm/               ← oldstable
   │  │  └─ ...
   │  │
   │  ├─ trixie-updates/         ← 稳定更新 (非安全)
   │  │  └─ ...
   │  │
   │  └─ trixie-backports/       ← 向后移植
   │     └─ ...
   │
   └─ pool/                      ← 实际包文件存储
      ├─ main/
      │  ├─ a/apache2/           ← 按首字母组织
      │  ├─ l/linux/
      │  └─ z/zsh/
      ├─ contrib/
      └─ non-free/
```

### 3.2 组件 (Component) 详解

| 组件 | 自由软件 | 包含内容 | 典型包 | 占比 |
|------|----------|----------|--------|------|
| **main** | ✅ DFSG 自由 | 所有自由软件 | 内核、GCC、GNOME | ~95% |
| **contrib** | ✅ 本身自由 | 依赖 non-free 的自由软件 | nvidia 驱动安装器 | ~1% |
| **non-free** | ❌ 不自由 | 非自由软件 | Google Chrome、Oracle JDK | ~3% |
| **non-free-firmware** | ❌ 固件 | 硬件固件 (Debian 12+) | 无线网卡固件、GPU 固件 | ~1% |

> Debian 12 (Bookworm) 起，固件从 `non-free` 分离到独立的 `non-free-firmware` 组件，以便在无固件需求的系统上更容易排除。

### 3.3 仓库类型

| 类型 | URL 模式 | 用途 |
|------|----------|------|
| **标准仓库** | `deb.debian.org/debian` | 主仓库 (CDN) |
| **安全仓库** | `deb.debian.org/debian-security` | 安全更新 |
| **更新仓库** | `deb.debian.org/debian` `-updates` | 稳定版常规更新 |
| **向后移植** | `deb.debian.org/debian` `-backports` | 新软件向后移植 |
| **归档仓库** | `archive.debian.org` | EOL 版本存档 |
| **快照仓库** | `snapshot.debian.org` | 历史状态快照 |
| **实验仓库** | `deb.debian.org/debian` `experimental` | 破坏性实验 |

### 3.4 APT sources.list 配置示例

```
# Debian 13 (Trixie) 标准配置
# ============================================

# 主仓库
deb http://deb.debian.org/debian trixie main contrib non-free non-free-firmware
deb-src http://deb.debian.org/debian trixie main contrib non-free non-free-firmware

# 安全更新
deb http://deb.debian.org/debian-security trixie-security main contrib non-free non-free-firmware
deb-src http://deb.debian.org/debian-security trixie-security main contrib non-free non-free-firmware

# 稳定版更新 (bug 修复)
deb http://deb.debian.org/debian trixie-updates main contrib non-free non-free-firmware

# 向后移植
deb http://deb.debian.org/debian trixie-backports main contrib non-free non-free-firmware

# ============================================
# 旧版格式 (Debian 11 及之前)
# ============================================
deb http://security.debian.org/debian-security bullseye-security main contrib non-free

# ============================================
# 归档仓库 (Debian 10 Buster, EOL)
# ============================================
deb http://archive.debian.org/debian buster main contrib non-free
deb http://archive.debian.org/debian-security buster/updates main contrib non-free
```

---

## 4. 支持的 CPU 架构

### 4.1 Debian 13 (Trixie) 官方支持

| 架构 | Debian 名称 | 状态 | 典型硬件 |
|------|-------------|------|----------|
| **amd64** | x86_64 | **一级支持** | Intel/AMD 桌面/服务器 |
| **arm64** | AArch64 | **一级支持** | ARM 服务器、Apple Silicon、Raspberry Pi 3+ |
| **armhf** | ARMv7 hard-float | **一级支持** | 树莓派 2/3、ARM 嵌入式 |
| **ppc64el** | POWER LE | **一级支持** | IBM POWER8/9/10 |
| **riscv64** | RISC-V 64-bit | **一级支持 (新增)** | SiFive、StarFive、RISC-V 开发板 |
| **s390x** | IBM Z | **一级支持** | IBM 大型机 |
| **i386** | x86 32-bit | **仅协架构** | 在 amd64 上运行 32 位软件 |
| **armel** | ARM EABI soft-float | **支持受限；Trixie 为最后支持版本** | 旧 ARM 设备 |

### 4.2 架构历史变更

| 架构 | Debian 12 | Debian 13 | 变化 |
|------|-----------|-----------|------|
| mipsel | ✅ | ❌ | 移除 |
| mips64el | ✅ | ❌ | 移除 |
| i386 | ✅ 独立 | ⚠️ 仅协架构 | 降级 |
| armel | ✅ | ⚠️ 支持受限，最后支持版本 | 降级 |
| riscv64 | ❌ | ✅ 新增 | 提升 |

### 4.3 Multiarch 支持

```bash
# Multiarch 允许在同一系统安装多个架构的包
# 例如: amd64 系统运行 i386 软件 (Steam、Wine)

# 启用 foreign architecture
sudo dpkg --add-architecture i386
sudo apt update

# 安装其他架构的包
sudo apt install libc6:i386 libstdc++6:i386

# 查看支持的架构
dpkg --print-architecture        # 主架构
dpkg --print-foreign-architectures  # 附加架构

# 指定架构搜索
apt-cache search package:amd64
apt-cache search package:i386
```

---

## 5. 包管理系统

### 5.1 工具链全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Debian 包管理工具链                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  高层前端 (用户交互)                                                  │
│  ├─ apt              # 推荐命令行工具 (apt install/remove/search)  │
│  ├─ aptitude         # 交互式 TUI (解决依赖更强)                    │
│  ├─ synaptic         # GTK 图形界面                                  │
│  ├─ apt-file         # 搜索文件所属包                                │
│  └─ reportbug        # 提交 bug 报告                                 │
│                                                                      │
│  中层工具 (脚本/自动化)                                               │
│  ├─ apt-get          # 经典命令 (脚本推荐)                          │
│  ├─ apt-cache        # 查询包信息                                    │
│  ├─ apt-mark         # 标记包状态 (auto/manual)                     │
│  ├─ apt-key          # GPG 密钥管理 (已弃用)                        │
│  ├─ apt-ftparchive   # 创建本地仓库                                  │
│  └─ apt-build        # 源码编译安装                                  │
│                                                                      │
│  底层工具 (核心引擎)                                                  │
│  ├─ dpkg             # 包安装/删除/查询核心                          │
│  ├─ dpkg-deb         # .deb 文件操作                                 │
│  ├─ dpkg-query       # 查询已安装包                                  │
│  ├─ dpkg-reconfigure # 重新配置包 (debconf)                         │
│  ├─ dpkg-divert      # 文件重定向                                    │
│  ├─ dpkg-statoverride # 权限覆盖                                     │
│  └─ dpkg-trigger     # 触发器管理                                    │
│                                                                      │
│  辅助工具                                                             │
│  ├─ debconf          # 配置交互框架                                  │
│  ├─ update-alternatives # 命令替代管理                               │
│  ├─ lintian          # 包质量检查                                    │
│  ├─ piuparts         # 安装/卸载/升级测试                            │
│  ├─ debsums          # 校验已安装文件 MD5                            │
│  ├─ deborphan        # 查找孤儿包                                    │
│  └─ equivs           # 创建虚拟依赖包                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 dpkg 核心操作

```bash
# ============ 安装/删除 ============
dpkg -i package.deb              # 安装本地 .deb 包
dpkg -r package                  # 移除包 (保留配置)
dpkg -P package                  # 完全清除 (含配置)

# ============ 查询 ============
dpkg -l                          # 列出所有已安装包
dpkg -l 'libc6*'                 # 模糊查询
dpkg -s package                  # 包状态信息
dpkg -L package                  # 列出包安装的所有文件
dpkg -S /path/to/file            # 查询文件属于哪个包
dpkg --contents package.deb      # 查看 .deb 内容

# ============ 状态控制 ============
dpkg --get-selections            # 导出所有包选择状态
dpkg --set-selections < file     # 导入包选择状态

# ============ 架构管理 ============
dpkg --add-architecture i386     # 添加 foreign arch
dpkg --remove-architecture i386  # 移除 foreign arch
dpkg --print-architecture        # 打印主架构
dpkg --print-foreign-architectures  # 打印附加架构
```

### 5.3 APT 核心操作

```bash
# ============ 基础操作 ============
sudo apt update                  # 更新包列表
sudo apt upgrade                 # 升级已安装包
sudo apt full-upgrade            # 完整升级 (处理依赖变化)
sudo apt dist-upgrade            # 发行版升级 (同 full-upgrade)

sudo apt install package         # 安装包
sudo apt install -f              # 修复损坏依赖
sudo apt remove package          # 移除包
sudo apt purge package           # 完全清除
sudo apt autoremove              # 自动移除不再需要的包
sudo apt clean                   # 清除下载的包缓存
sudo apt autoclean               # 清除旧版本包缓存

# ============ 查询 ============
apt search keyword               # 搜索包
apt show package                 # 显示包详情
apt list --installed             # 列出已安装包
apt list --upgradeable           # 列出可升级包
apt-cache policy package         # 显示包的版本/优先级/来源
apt-cache depends package        # 显示依赖关系
apt-cache rdepends package       # 显示反向依赖
apt-cache showsrc package        # 显示源码包信息

# ============ 源码包 ============
sudo apt source package          # 下载源码包
sudo apt build-dep package       # 安装构建依赖

# ============ 版本锁定 ============
sudo apt-mark hold package       # 锁定版本 (不升级)
sudo apt-mark unhold package     # 解除锁定
sudo apt-mark auto package       # 标记为自动安装
sudo apt-mark manual package     # 标记为手动安装
apt-mark showhold                # 显示锁定的包
apt-mark showauto                # 显示自动安装的包
apt-mark showmanual              # 显示手动安装的包
```

### 5.4 APT 配置文件

```
/etc/apt/
├── apt.conf.d/           # APT 配置片段
│   ├── 01autoremove      # 自动移除规则
│   ├── 10periodic        # 自动更新配置 (unattended-upgrades)
│   ├── 20archive         # 归档相关
│   ├── 20dbus            # D-Bus 集成
│   ├── 20packagekit      # PackageKit 集成
│   ├── 50unattended-upgrades  # 无人值守升级
│   └── 70debconf         # debconf 集成
├── auth.conf.d/          # 认证配置
├── keyrings/             # GPG 公钥环 (APT 2.4+)
├── preferences.d/        # Pinning 优先级配置
├── sources.list          # 主源列表
├── sources.list.d/       # 源列表片段
│   └── *.list / *.sources  # 新版 deb822 格式
├── trusted.gpg.d/        # 传统 GPG 密钥 (已弃用)
└── trusted.gpg           # 传统密钥环 (已弃用)

# 新版 deb822 格式 (sources.list.d/*.sources)
Types: deb deb-src
URIs: https://deb.debian.org/debian
Suites: trixie trixie-updates
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
```

### 5.5 APT Pinning（版本优先级控制）

```
/etc/apt/preferences.d/ 或 /etc/apt/preferences

# 示例: 优先使用 backports 的 nginx
Package: nginx
Pin: release a=trixie-backports
Pin-Priority: 500

# 示例: 锁定特定版本
Package: postgresql
Pin: version 17*
Pin-Priority: 1001

# 示例: 禁止使用某个源
Package: *
Pin: origin some.untrusted.repo
Pin-Priority: -1

优先级含义:
  > 1000   → 即使降级也安装
  990-1000 → 优先于标准版本
  500-990  → 正常优先级 (默认)
  100-500  → 不自动安装
  0-100    → 不自动安装，仅显式请求
  < 0      → 从不安装
```

### 5.6 dpkg 内部数据结构

```
/var/lib/dpkg/
├── alternatives/         # update-alternatives 状态
│   ├── editor
│   ├── pager
│   ├── x-www-browser
│   └── ...
├── arch                  # 主架构 (amd64)
├── available             # 所有可用包信息 (apt 缓存)
├── cmethopt              # 压缩方法选项
├── diversions            # dpkg-divert 重定向记录
├── info/                 # 每个包的控制信息
│   ├── package.list      # 文件列表
│   ├── package.md5sums   # MD5 校验和
│   ├── package.postinst  # 安装后脚本
│   ├── package.postrm    # 移除后脚本
│   ├── package.preinst   # 安装前脚本
│   ├── package.prerm     # 移除前脚本
│   ├── package.conffiles # 配置文件列表
│   ├── package.templates # debconf 模板
│   └── package.config    # debconf 配置脚本
├── parts/                # 部分安装状态
├── statoverride          # dpkg-statoverride 记录
├── status                # 包状态数据库 (核心!)
├── status-old            # 状态备份
├── triggers/             # 触发器状态
├── triggers/Unincorp     # 未合并触发器
└── updates/              # 待处理更新
```

---

## 6. 包格式与元数据

### 6.1 .deb 包格式

```
.deb 包 = ar 归档格式

┌─────────────────────────────────────────────────────────────────────┐
│  ar 魔数: "!<arch>\n"                                               │
├─────────────────────────────────────────────────────────────────────┤
│  debian-binary (2.0\n)                                              │
│  ├─ Debian 包格式版本 (当前为 2.0)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  control.tar.gz / control.tar.xz                                    │
│  ├─ ./control          # 包元数据 (必填)                            │
│  ├─ ./md5sums          # 文件 MD5 校验                              │
│  ├─ ./conffiles        # 配置文件列表                               │
│  ├─ ./preinst          # 安装前脚本                                 │
│  ├─ ./postinst         # 安装后脚本                                 │
│  ├─ ./prerm            # 移除前脚本                                 │
│  ├─ ./postrm           # 移除后脚本                                 │
│  ├─ ./templates        # debconf 模板                               │
│  ├─ ./config           # debconf 配置脚本                           │
│  ├- ./shlibs           # 共享库依赖信息                             │
│  └─ ./triggers         # 触发器定义                                 │
├─────────────────────────────────────────────────────────────────────┤
│  data.tar.gz / data.tar.xz / data.tar.zst                           │
│  ├─ 实际文件系统内容                                                │
│  ├─ 路径: ./usr/bin/xxx, ./usr/share/doc/xxx, ./etc/xxx            │
│  └─ 安装时解压到根目录 /                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 查看 .deb 内容

```bash
# 查看 .deb 结构
ar tv package.deb

# 解压 .deb
ar x package.deb

# 查看控制信息
dpkg-deb -I package.deb          # 控制信息摘要
dpkg-deb -f package.deb Package  # 特定字段
dpkg-deb -f package.deb Depends  # 依赖

# 查看数据内容
dpkg-deb -c package.deb          # 文件列表
dpkg-deb -x package.deb /tmp/extract  # 解压数据到目录

# 提取控制文件
dpkg-deb -e package.deb /tmp/control  # 解压控制信息到目录

# 构建 .deb
dpkg-deb --build debian/package ./package.deb
```

### 6.3 二进制包 control 文件

```
Package: nginx
Version: 1.26.0-1
Architecture: amd64
Maintainer: Debian Nginx Maintainers <pkg-nginx-maintainers@alioth-lists.debian.net>
Installed-Size: 1536
Depends: libc6 (>= 2.34), libpcre2-8-0 (>= 10.22), libssl3 (>= 3.0.0), zlib1g (>= 1:1.1.4), lsb-base (>= 3.0-6)
Recommends: logrotate
Suggests: nginx-doc
Conflicts: nginx-common
Provides: httpd
Section: web
Priority: optional
Homepage: https://nginx.net
Description: small, powerful, scalable web/proxy server
 Nginx ("engine x") is a high-performance web and reverse proxy server
 created by Igor Sysoev. It can be used both as a standalone web server
 and as a proxy to reduce the load on back-end HTTP or mail servers.
 .
 This package provides a light-weight version of nginx with the core
 modules and a basic feature set.
```

### 6.4 关键字段详解

| 字段 | 说明 | 示例 |
|------|------|------|
| **Package** | 包名 | `nginx` |
| **Version** | 版本号 `[epoch:]upstream-version[-debian-revision]` | `1.26.0-1`, `1:2.0-1` |
| **Architecture** | 架构 (`amd64`/`all`/`any`) | `amd64`, `all` |
| **Maintainer** | 维护者 | `Debian Nginx Maintainers <...>` |
| **Installed-Size** | 安装后大小 (KB) | `1536` |
| **Depends** | 强依赖 | `libc6 (>= 2.34)` |
| **Pre-Depends** | 预依赖 (安装前必须满足) | `dpkg (>= 1.15.6)` |
| **Recommends** | 推荐 (默认安装，可跳过 `--no-install-recommends`) | `logrotate` |
| **Suggests** | 建议 (不自动安装) | `nginx-doc` |
| **Breaks** | 破坏 (需要升级指定包) | `nginx-common (<< 1.20)` |
| **Conflicts** | 冲突 (不能共存) | `apache2` |
| **Provides** | 提供虚拟包 | `httpd` |
| **Replaces** | 替换 (可接管其他包的文件) | `nginx-light` |
| **Enhances** | 增强 (其他包的功能扩展) | `nginx-module-geoip` |
| **Section** | 分类 | `web`, `net`, `devel` |
| **Priority** | 优先级 | `required`, `important`, `standard`, `optional`（`extra` 已废弃，视同 `optional`） |
| **Essential** | 系统必需 | `yes` (仅 base 包) |
| **Multi-Arch** | 多架构支持 | `same`, `foreign`, `allowed`, `no` |
| **Homepage** | 项目主页 | `https://nginx.net` |
| **Description** | 描述 | 首行摘要 + 后续详细说明 |

### 6.5 版本号格式

```
[epoch:]upstream_version[-debian_revision]

示例:
1:2.4.59-1~deb12u1
│ │       │ │
│ │       │ └─ 特定发行版后缀 (backports/security)
│ │       └── Debian 修订版本
│ └────────── 上游版本号
└──────────── Epoch (解决版本回退)

规则:
- 比较时 epoch > upstream_version > debian_revision
- 1:1.0 > 2.0 (因为 epoch 1 > 隐含 epoch 0)
- 2.0-1 > 2.0-1+b1 > 2.0-1~exp1
- ~ 表示"预发布" (2.0-1~exp1 < 2.0-1)
- + 表示"本地修改" (2.0-1+b1 > 2.0-1)
```

---

## 7. Debian Policy 规范

### 7.1 DFSG (Debian Free Software Guidelines)

Debian 判断软件是否"自由"的 9 条准则：

1. **自由再分发** — 许可证不能限制销售或赠送
2. **源代码** — 必须包含源代码或允许获取
3. **衍生作品** — 必须允许修改和派生
4. **作者完整性** — 可以要求保持补丁文件分开
5. **不歧视个人或团体** — 不能排斥任何人
6. **不歧视用途** — 不能限制商业用途
7. **许可证分发** — 权利随程序一起授予
8. **许可证不专属于 Debian** — 不能只对 Debian 有效
9. **许可证不影响其他软件** — 不能污染相邻软件

> 符合 DFSG 的软件进入 `main`，不符合的进入 `non-free`。

### 7.2 包维护脚本规范

```
维护脚本 (Maintainer Scripts) 在特定事件执行：

安装流程:
  preinst install         ← 解压前 (旧版本不存在)
  解压 data.tar           ← 文件到系统
  postinst configure      ← 配置 (最常用)

升级流程:
  preinst upgrade <old-ver>
  解压 data.tar
  postinst configure <old-ver>

移除流程:
  prerm remove
  删除文件
  postrm remove

清除流程 (purge):
  prerm remove
  删除文件
  postrm remove
  postrm purge            ← 删除配置文件

脚本要求:
- 必须是 idempotent（幂等）
- 不能交互（除非 debconf）
- 必须处理所有错误
- 使用 `set -e` 自动退出
- 不能修改不属于本包的文件
```

### 7.3 FHS (Filesystem Hierarchy Standard)

Debian 严格遵循 FHS：

| 目录 | 用途 | Debian 约定 |
|------|------|-------------|
| `/bin` | 基本用户命令 | `dash`, `cp`, `ls` |
| `/sbin` | 系统管理命令 | `fdisk`, `mkfs` |
| `/usr/bin` | 普通用户程序 | `firefox`, `gcc` |
| `/usr/sbin` | 系统程序 | `nginx`, `sshd` |
| `/usr/local` | 本地安装软件 | 手动编译/本地包 |
| `/opt` | 附加软件包 | 第三方闭源软件 |
| `/etc` | 配置文件 | 包配置文件 |
| `/var` | 可变数据 | 日志、缓存、邮件 |
| `/tmp` | 临时文件 | tmpfs 挂载 |
| `/run` | 运行时数据 | PID 文件、锁文件 |
| `/home` | 用户主目录 | — |
| `/root` | root 主目录 | — |
| `/boot` | 启动文件 | 内核、initrd |
| `/lib` | 基本共享库 | `libc.so.6` |
| `/lib64` | 64 位库 | x86_64 系统 |
| `/usr/share` | 架构无关数据 | 文档、图标、locale |
| `/usr/lib` | 程序库 | `python3`, `systemd` |
| `/usr/include` | 头文件 | C/C++ 开发 |
| `/usr/src` | 源码 | 内核源码 |
| `/dev` | 设备文件 | udev/devtmpfs |
| `/proc` | 内核信息 | procfs |
| `/sys` | 内核接口 | sysfs |

### 7.4 配置文件处理

```
Conffiles（配置文件）机制:

1. 包在 control 中声明哪些文件是配置文件
2. dpkg 跟踪这些文件的 MD5 校验和
3. 升级时:
   ├─ 如果用户未修改 → 自动替换为新版本
   ├─ 如果用户已修改且包未变 → 保留用户版本
   └─ 如果双方都修改 → 交互式提示 (或自动处理)

配置文件的 dpkg 状态:
  ├─ conffiles 中列出
  ├─ /var/lib/dpkg/status 中记录 MD5
  └─ 升级时比对 MD5 决定行为

自动处理策略 (DPkg::options):
  --force-confold     → 保留旧配置
  --force-confnew     → 使用新配置
  --force-confdef     → 使用默认行为
  --force-confmiss    → 如果配置文件被删除则重新安装

示例:
  sudo apt -o Dpkg::options::="--force-confold" upgrade
```

---

## 8. 打包系统详解

### 8.1 源码包结构

```
package_1.0-1.dsc           # 描述文件 (签名)
package_1.0.orig.tar.gz     # 原始上游源码
debian/patches/             # Debian 补丁 (quilt)
└── package_1.0-1.debian.tar.xz  # Debian 修改

解压后:
package-1.0/
├── Makefile / CMakeLists.txt / setup.py  # 上游构建
├── src/                       # 上游源码
└── debian/                    # Debian 打包目录
    ├── changelog              # 变更日志 (必填)
    ├── control                # 包元数据 (必填)
    ├── copyright              # 版权信息 (必填)
    ├── rules                  # 构建脚本 (必填, Makefile)
    ├── source/format          # 源码格式 (3.0 quilt/native)
    ├── compat                 # debhelper 兼容级别 (已弃用)
    ├── watch                  # 上游版本监控
    ├── README.Debian          # Debian 特定说明
    ├── README.source          # 源码包说明
    ├── dirs                   # 创建目录列表
    ├── docs                   # 安装文档列表
    ├── install                # 安装文件映射
    ├── links                  # 创建符号链接
    ├── postinst               # 安装后脚本
    ├── postrm                 # 移除后脚本
    ├── preinst                # 安装前脚本
    ├── prerm                  # 移除前脚本
    ├── conffiles              # 配置文件列表
    ├── triggers               # 触发器定义
    ├── *.maintscript          # dpkg-maintscript-helper
    ├── patches/               # quilt 补丁目录
    │   └── series             # 补丁序列
    ├── tests/                 # autopkgtest 测试
    └── overrides/             # lintian 覆盖
```

### 8.2 debian/rules（构建脚本）

```makefile
#!/usr/bin/make -f

# 标准 debian/rules 模板（使用 dh 命令）

export DH_VERBOSE = 1
export DEB_BUILD_MAINT_OPTIONS = hardening=+all

%:
	dh $@

# 覆盖特定目标
override_dh_auto_configure:
	dh_auto_configure -- --with-feature --without-other

override_dh_auto_build:
	$(MAKE) -C src

override_dh_auto_install:
	$(MAKE) -C src DESTDIR=$(CURDIR)/debian/tmp install

override_dh_install:
	dh_install --sourcedir=$(CURDIR)/debian/tmp

override_dh_fixperms:
	dh_fixperms
	chmod 4755 debian/mypackage/usr/bin/setuid-binary

override_dh_strip:
	dh_strip --dbg-package=mypackage-dbg
```

### 8.3 dh 命令序列

```
dh (debhelper) 自动执行以下目标：

build:
  dh_testdir          → 检查目录结构
  dh_update_autotools_config
  dh_autoreconf       → 运行 autoreconf
  dh_auto_configure   → ./configure / cmake / meson
  dh_auto_build       → make / ninja
  dh_auto_test        → make check / ctest

binary:
  dh_testroot         → 检查 root 权限
  dh_prep             → 清理临时目录
  dh_auto_install     → make install → debian/tmp
  dh_install          → 从 debian/tmp 复制到各包目录
  dh_installdocs      → 安装文档
  dh_installchangelogs → 安装 changelog
  dh_installexamples  → 安装示例
  dh_installman       → 安装手册页
  dh_installsystemd   → 安装 systemd 单元
  dh_installinit      → 安装 init 脚本
  dh_installcron      → 安装 cron 任务
  dh_installlogrotate → 安装 logrotate 配置
  dh_lintian          → 安装 lintian 覆盖
  dh_perl             → Perl 依赖计算
  dh_python3          → Python3 依赖计算
  dh_shlibdeps        → 共享库依赖计算
  dh_gencontrol       → 生成 control 文件
  dh_md5sums          → 生成 md5sums
  dh_builddeb         → 构建 .deb 包
```

### 8.4 debian/changelog 格式

```
package (version) distribution; urgency=urgency

  * Change description (bullet points)
  * Another change
  * Fix some bug (Closes: #123456)
  * Patch from Some Developer <email> (Closes: #654321)

 -- Maintainer Name <email@example.com>  Day, DD Mon YYYY HH:MM:SS +TZ

示例:
nginx (1.26.0-1) unstable; urgency=medium

  * New upstream release.
  * debian/control: Update Standards-Version to 4.7.0.
  * debian/patches: Refresh all patches.
  * Fix buffer overflow in HTTP/2 handling (CVE-2024-1234).

 -- Debian Nginx Maintainers <pkg-nginx@debian.org>  Mon, 15 Apr 2024 12:00:00 +0000
```

### 8.5 打包工具链

| 工具 | 用途 | 包名 |
|------|------|------|
| **debhelper** | 打包辅助工具 (dh 命令) | `debhelper` |
| **dh-make** | 创建初始 debian/ 目录 | `dh-make` |
| **devscripts** | 开发者脚本 (debuild, dch, uscan) | `devscripts` |
| **dpkg-dev** | 包开发工具 (dpkg-buildpackage) | `dpkg-dev` |
| **build-essential** | 基本构建工具 | `build-essential` |
| **lintian** | 包质量检查 | `lintian` |
| **pbuilder** | 干净 chroot 构建 | `pbuilder` |
| **sbuild** | 另一种 chroot 构建 | `sbuild` |
| **cowbuilder** | pbuilder + cowdancer (更快) | `cowbuilder` |
| **git-buildpackage** | Git 集成打包 | `git-buildpackage` |
| **quilt** | 补丁管理 | `quilt` |
| **equivs** | 创建虚拟依赖包 | `equivs` |
| **autopkgtest** | 自动包测试 | `autopkgtest` |
| **piuparts** | 安装/卸载/升级测试 | `piuparts` |

### 8.6 构建流程

```bash
# 1. 准备环境
sudo apt update
sudo apt install build-essential devscripts debhelper
sudo apt build-dep package  # 安装构建依赖

# 2. 获取源码
apt source package          # 从仓库下载
cd package-1.0/

# 3. 修改 (可选)
dch -i                      # 编辑 changelog
dquilt push -a              # 应用补丁
# ... 修改代码 ...
dquilt refresh              # 刷新补丁

# 4. 构建
dpkg-buildpackage -us -uc -b  # 构建二进制包 (不签名)
# 或
debuild -us -uc -b          # 构建二进制包 (devscripts)
# 或
gbp buildpackage            # git-buildpackage

# 5. 检查结果
lintian ../package_1.0-1_amd64.deb
piuparts ../package_1.0-1_amd64.deb
autopkgtest ../package_1.0-1_amd64.deb -- null
```

### 8.7 自动化与静态分析提取

在分析 Debian 源码包（如 `repo-inv` 进行跨仓库盘点）时，切勿通过正则强行匹配 `debian/control`，应使用官方解析库以确保兼容多行折叠和宏变量：

1. **Python 解析**: 使用 `python3-debian` 包 (`pip install python-debian`)
   ```python
   from debian import deb822
   with open('debian/control') as f:
       for stanza in deb822.Deb822.iter_paragraphs(f):
           print(stanza.get('Package'), stanza.get('Depends'))
   ```
2. **Shell 解析**: 使用 `dpkg-parsechangelog` 结构化提取变更日志，或使用 `grep-dctrl` (`dctrl-tools` 包) 提取特定控制字段。

### 8.7 自动化与静态分析提取

在分析 Debian 源码包（如 `repo-inv` 进行跨仓库盘点）时，切勿通过正则强行匹配 `debian/control`，应使用官方解析库以确保兼容多行折叠和宏变量：

1. **Python 解析**: 使用 `python3-debian` 包 (`pip install python-debian`)
   ```python
   from debian import deb822
   with open('debian/control') as f:
       for stanza in deb822.Deb822.iter_paragraphs(f):
           print(stanza.get('Package'), stanza.get('Depends'))
   ```
2. **Shell 解析**: 使用 `dpkg-parsechangelog` 结构化提取变更日志，或使用 `grep-dctrl` (`dctrl-tools` 包) 提取特定控制字段。

---

## 9. 安全模型与更新机制

### 9.1 安全更新流程

```
安全漏洞发现
   ↓
Debian Security Team (security@debian.org)
   ├─ 评估漏洞影响
   ├─ 制作补丁
   ├─ 构建更新包
   └─ 测试回归
   ↓
上传至 debian-security 仓库
   ├─ stable-security
   ├─ oldstable-security
   └─ LTS-security (由 LTS 团队处理)
   ↓
DSA (Debian Security Advisory) 发布
   ├─ 邮件列表: debian-security-announce
   ├─ 网页: https://www.debian.org/security/
   └─ CVE 编号关联
   ↓
用户获取更新
   apt update && apt upgrade
```

### 9.2 安全公告格式

```
DSA-1234-1 package -- security update

Date: 2024-01-15
CVE ID: CVE-2024-1234 CVE-2024-1235
Debian Bug: #123456

A vulnerability was discovered in package, where ...

For the stable distribution (trixie), this problem has been fixed in
version 1.2.3-1+deb13u1.

We recommend that you upgrade your package packages.

Further information about Debian Security Advisories:
https://www.debian.org/security/
```

### 9.3 无人值守安全更新

```bash
# 安装 unattended-upgrades
sudo apt install unattended-upgrades apt-listchanges

# 配置 /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    // "${distro_id}:${distro_codename}-updates";
};

Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

# 启用
sudo dpkg-reconfigure -plow unattended-upgrades

# 手动运行测试
sudo unattended-upgrade --dry-run
sudo unattended-upgrade
```

### 9.4 LTS 与 ELTS

| 支持阶段 | 持续时间 | 负责团队 | 支持范围 |
|----------|----------|----------|----------|
| **完整支持** | 3 年 | Debian Security Team | stable 官方架构与 main 包为主；contrib/non-free/non-free-firmware 和部分包可能受限 |
| **LTS** | 2 年 (共 5 年) | Debian LTS Team (志愿者+公司) | 减少的架构、关键包 |
| **ELTS** | 5 年 (共 10 年) | Freexian (商业) | 更少架构、更少包 |

```
Debian 12 Bookworm (2023-06-10):
├─ 完整支持: 2023-06-10 → 2026-06-10
├─ LTS:       2026-06-10 → 2028-06-30
└─ ELTS:      2028-06-30 → 2033-06-30

Debian 13 Trixie (2025-08-09):
├─ 完整支持: 2025-08-09 → 2028-08-09
├─ LTS:       2028-08-09 → 2030-06-30
└─ ELTS:      2030-06-30 → 2035-06-30
```

### 9.5 安全加固工具

| 工具 | 包名 | 用途 |
|------|------|------|
| **debsecan** | `debsecan` | 扫描已知 CVE |
| **needrestart** | `needrestart` | 检测需要重启的服务 |
| **checkrestart** | `debian-goodies` | 检查已更新但仍在运行的进程 |
| **apt-listbugs** | `apt-listbugs` | 安装前显示相关 bug |
| **apt-listchanges** | `apt-listchanges` | 显示包变更日志 |
| **debian-security-support** | `debian-security-support` | 检查包是否受 LTS 支持 |

---

## 10. Debian 安装程序

### 10.1 debian-installer (d-i)

Debian 官方安装程序，支持多种安装模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **图形安装** | GTK 前端 | 桌面用户 |
| **文本安装** | newt/curses 前端 | 服务器/低内存 |
| **专家模式** | 完全控制每一步 | 高级用户 |
| **救援模式** | 修复现有系统 | 系统故障 |
| **自动安装** | Preseed 无人值守 | 大规模部署 |

### 10.2 安装媒介

| 媒介 | 大小 | 内容 | 用途 |
|------|------|------|------|
| **netinst** | ~300MB | 最小系统 + 网络安装 | 推荐 |
| **CD** | ~700MB | 基础桌面 | 离线安装 |
| **DVD** | ~4.7GB | 完整桌面 | 无网络环境 |
| **Live** | ~1-3GB | 可试用可安装 | 体验/恢复 |
| **mini.iso** | ~50MB | 仅引导程序 | PXE/高级 |

### 10.3 Preseed 自动安装

```bash
# preseed.cfg 示例 (无人值守安装)

# 本地化
d-i debian-installer/locale string en_US
d-i keyboard-configuration/xkb-keymap select us

# 网络
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string debian-server
d-i netcfg/get_domain string example.com

# 镜像
d-i mirror/country string manual
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string

# 账户
d-i passwd/root-password-crypted password $6$rounds=5000$saltsalt$...
d-i passwd/user-fullname string Admin User
d-i passwd/username string admin
d-i passwd/user-password-crypted password $6$rounds=5000$saltsalt$...

# 分区
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

# 软件包选择
tasksel tasksel/first multiselect standard, ssh-server
d-i pkgsel/include string vim htop curl wget
popularity-contest popularity-contest/participate boolean false

# GRUB
d-i grub-installer/only_debian boolean true
d-i grub-installer/bootdev string /dev/sda

# 完成
d-i finish-install/reboot_in_progress note
```

### 10.4 使用 Preseed

```bash
# 方式 1: 内核命令行
linux ... auto url=http://server/preseed.cfg

# 方式 2: initrd 注入
mkpasswd -m sha-512 -s <<< "password"

# 方式 3: PXE 网络启动
# TFTP + DHCP + Preseed
```

---

## 11. 社区治理与组织

### 11.1 Debian Constitution

Debian 采用民主式社区治理，核心文件为《Debian Constitution》：

| 角色 | 说明 | 权力 |
|------|------|------|
| **Debian Developer (DD)** | 完整成员 | 投票权、上传任何包、参加选举 |
| **Debian Maintainer (DM)** | 受限成员 | 上传指定包、无投票权 |
| **Application Manager** | NM 流程指导 | 帮助新人加入 |
| **Front Desk** | NM 入口审核 | 初步筛选申请人 |
| **Debian Account Managers (DAM)** | 账户管理 | 创建/管理 Debian 账户 |
| **Project Leader (DPL)** | 项目领袖 | 协调团队、对外代表 (每年选举) |
| **Technical Committee (CTTE)** | 技术委员会 | 解决技术争议 |
| **Release Team** | 发布团队 | 管理发布流程、冻结决策 |
| **Security Team** | 安全团队 | 处理安全更新 |
| **FTP Masters** | 仓库管理 | 审核新包、管理仓库 |
| **SPI** | 关联组织 | 处理法律/财务事务 |

### 11.2 加入 Debian 流程 (NM)

```
1. 成为 Contributor
   └─ 提交补丁、报告 bug、参与讨论

2. 寻找 Sponsor
   └─ DD 愿意审查和指导你的包

3. 申请 Debian Maintainer (DM)
   └─ 受限上传权限

4. 申请 New Maintainer (NM)
   ├─ 检查身份 (PGP 密钥签名圈)
   ├─ 检查理念和技能 (Philosophy & Procedures)
   ├─ 检查打包能力 (Tasks & Skills)
   └─ 最终审核 (T&S, P&P 通过)

5. 成为 Debian Developer (DD)
   └─ 完整权限 + 投票权

预计时间: 数月到数年
```

### 11.3 投票系统

```
Debian 使用 Condorcet 投票法：

- 每人对所有选项排序
- 两两比较，得票多者胜
- 如果形成循环，使用 Schulze 方法解决
- 需要 Quorum（最低投票数）
- 需要 3:1 的超级多数才能修改 Constitution

年度投票:
- Debian Project Leader 选举
- 宪法修正案
- 通用决议 (General Resolution)
```

---

## 12. 衍生发行版生态

### 12.1 主要衍生版

| 发行版 | 基础 | 特点 | 用途 |
|--------|------|------|------|
| **Ubuntu** | Debian Sid | 6 月发布周期、Canonical 支持 | 桌面/服务器/云 |
| **Linux Mint LMDE** | Debian Stable | Cinnamon 桌面 | 桌面用户 |
| **Kali Linux** | Debian Testing | 渗透测试工具 | 安全审计 |
| **Tails** | Debian Stable | 匿名操作系统 (Tor) | 隐私保护 |
| **Raspberry Pi OS** | Debian Stable | 树莓派优化 | 嵌入式 |
| **Proxmox VE** | Debian Stable | 虚拟化/容器 | 数据中心 |
| **Devuan** | Debian | 无 systemd (SysVinit/OpenRC) | systemd 反对者 |
| **Deepin** | Debian Stable | 深度桌面 | 中文用户 |
| **MX Linux** | Debian Stable | 轻量、工具丰富 | 老旧硬件 |
| **antiX** | Debian Stable | 无 systemd、极轻量 | 老旧硬件 |
| **SparkyLinux** | Debian Testing | 多桌面选择 | 桌面用户 |
| **Q4OS** | Debian Stable | Trinity/KDE | 轻量桌面 |
| **Parrot OS** | Debian Testing | 安全+开发 | 安全/开发 |
| **PureOS** | Debian Stable | FSF 认可完全自由 | 自由软件倡导 |
| **Knoppix** | Debian Testing | LiveCD/DVD | 系统恢复 |
| **Vanilla OS** | Debian Sid | 不可变、原子更新 | 现代桌面 |
| **Pop!_OS** | Ubuntu | 游戏/开发优化 | 桌面/笔记本 |
| **Linux Mint** | Ubuntu | Cinnamon | 桌面用户 |
| **Elementary OS** | Ubuntu | Pantheon 桌面 | macOS 风格 |
| **Zorin OS** | Ubuntu | Windows 风格 | 新手迁移 |

### 12.2 Debian 衍生版追踪

Debian 维护官方衍生版追踪列表：
- https://wiki.debian.org/Derivatives/Census
- 约 **130+** 个活跃衍生版被追踪

---

## 13. 系统初始化与服务管理

### 13.1 初始化系统历史

| 版本 | 默认 init | 可选 | 备注 |
|------|-----------|------|------|
| Debian 6 (Squeeze) | SysVinit | — | — |
| Debian 7 (Wheezy) | SysVinit | — | — |
| Debian 8 (Jessie) | **Systemd** | SysVinit | 重大变更 |
| Debian 9-13 | Systemd | — | — |
| Devuan | SysVinit/OpenRC | — | 无 systemd |

### 13.2 Systemd 单元类型

| 类型 | 扩展名 | 用途 |
|------|--------|------|
| **Service** | `.service` | 守护进程/服务 |
| **Socket** | `.socket` | 套接字激活 |
| **Device** | `.device` | 设备管理 |
| **Mount** | `.mount` | 挂载点 |
| **Automount** | `.automount` | 自动挂载 |
| **Swap** | `.swap` | 交换分区 |
| **Target** | `.target` | 运行级别替代 |
| **Path** | `.path` | 路径监控 |
| **Timer** | `.timer` | 定时任务替代 cron |
| **Slice** | `.slice` | cgroup 资源分组 |
| **Scope** | `.scope` | 外部进程分组 |

### 13.3 Systemd 常用命令

```bash
# 服务管理
sudo systemctl start|stop|restart|reload service
sudo systemctl enable|disable service
sudo systemctl status service
sudo systemctl is-active service
sudo systemctl is-enabled service
sudo systemctl mask|unmask service

# 查看所有单元
systemctl list-units --type=service
systemctl list-units --failed
systemctl list-unit-files

# 日志
journalctl -u service
journalctl -f
journalctl --since "1 hour ago"
journalctl -p err

# 目标 (运行级别)
systemctl get-default
sudo systemctl set-default multi-user.target
sudo systemctl isolate graphical.target

# 电源
sudo systemctl poweroff
sudo systemctl reboot
sudo systemctl suspend
sudo systemctl hibernate
```

### 13.4 定时任务 (Timer)

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily backup timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# 替代 cron
systemctl list-timers --all
```

---

## 14. 关键目录与文件结构

### 14.1 dpkg 数据库

```
/var/lib/dpkg/
├── alternatives/          # update-alternatives 状态
│   ├── editor             # 默认编辑器选择
│   ├── pager              # 默认分页器
│   ├── x-www-browser      # 默认浏览器
│   └── ... (102 个)
├── arch                   # 主架构: amd64
├── available              # 可用包信息 (~236KB)
├── diversions             # 文件重定向记录
│   # 格式: diverted-from diverted-to diverting-package
├── info/                  # 包控制文件 (9,952 个)
│   ├── package.list       # 文件列表
│   ├── package.md5sums    # 校验和
│   ├── package.postinst   # 安装后脚本
│   ├── package.postrm     # 移除后脚本
│   ├── package.preinst    # 安装前脚本
│   ├── package.prerm      # 移除前脚本
│   └── package.conffiles  # 配置文件列表
├── status                 # 包状态数据库 (~2.6MB)
│   # 核心! 记录所有已安装包的状态
├── status-old             # 状态备份
├── triggers/              # 触发器状态
└── updates/               # 待处理更新
```

### 14.2 APT 缓存与配置

```
/etc/apt/
├── apt.conf.d/            # 配置片段
├── keyrings/              # GPG 公钥 (APT 2.4+)
│   └── debian-archive-keyring.gpg
├── preferences.d/         # Pinning 优先级
├── sources.list           # 主源配置
├── sources.list.d/        # 源配置片段
│   ├── debian.sources     # deb822 格式
│   └── nodesource.sources
├── trusted.gpg.d/         # 传统密钥目录
└── trusted.gpg            # 传统密钥环

/var/cache/apt/
├── archives/              # 下载的 .deb 缓存
│   ├── partial/
│   └── *.deb
├── pkgcache.bin           # 二进制包元数据缓存 (~75MB)
└── srcpkgcache.bin        # 源码包元数据缓存 (~75MB)

/var/lib/apt/
├── lists/                 # 仓库元数据
│   ├── deb.debian.org_debian_dists_trixie_InRelease
│   ├── deb.debian.org_debian_dists_trixie_main_binary-amd64_Packages
│   └── ...
├── extended_states        # 自动/手动标记
└── periodic/              # 无人值守更新状态
```

### 14.3 系统日志

```
/var/log/
├── alternatives.log       # update-alternatives 日志
├── apt/                   # APT 日志
│   ├── history.log        # 安装/删除历史
│   ├── term.log           # 终端输出
│   └── eipp.log.xz        # 外部安装器日志
├── dpkg.log               # dpkg 操作日志
├── unattended-upgrades/   # 无人值守更新日志
│   └── unattended-upgrades.log
```

---

## 15. 配置管理机制

### 15.1 debconf

```
debconf 是 Debian 的包配置框架：

工作流程:
1. 包安装时调用 config 脚本
2. config 脚本通过 debconf 向用户提问
3. 答案存储在 debconf 数据库
4. postinst 从 debconf 读取答案并应用配置

前端:
  ├─ Dialog (TUI, 默认)
  ├─ Readline (命令行)
  ├─ Gnome (GTK)
  ├─ Kde (Qt)
  ├─ Editor (文本编辑器)
  └─ Noninteractive (非交互, 用于自动化)

数据库:
  /var/cache/debconf/config.dat
  /var/cache/debconf/passwords.dat

常用命令:
  sudo dpkg-reconfigure package    # 重新配置包
  sudo debconf-show package        # 显示包的 debconf 答案
  sudo debconf-set-selections < file  # 预设答案
  sudo debconf-get-selections      # 导出所有答案
```

### 15.2 update-alternatives

```bash
# 管理系统命令的默认实现
# 例如: /usr/bin/editor 可以指向 nano/vim/vi/emacs

# 查看所有 alternatives
update-alternatives --get-selections

# 查看特定命令
update-alternatives --display editor

# 交互式选择
sudo update-alternatives --config editor

# 设置优先级
sudo update-alternatives --install /usr/bin/editor editor /usr/bin/vim 100
sudo update-alternatives --install /usr/bin/editor editor /usr/bin/nano 50

# 移除
sudo update-alternatives --remove editor /usr/bin/vim

# 常用 alternatives:
# editor, pager, x-www-browser, java, awk, cc, sh
```

### 15.3 dpkg-divert

```bash
# 重定向文件，使包安装时不覆盖指定文件

# 创建 diversion (将 /bin/sh 重定向到 /bin/sh.real)
sudo dpkg-divert --add --rename --divert /bin/sh.real /bin/sh

# 移除 diversion
sudo dpkg-divert --remove --rename /bin/sh

# 查询
sudo dpkg-divert --list
```

### 15.4 dpkg-statoverride

```bash
# 覆盖包安装时的文件权限

# 添加
sudo dpkg-statoverride --add root mail 2755 /usr/bin/mail

# 移除
sudo dpkg-statoverride --remove /usr/bin/mail

# 查询
sudo dpkg-statoverride --list
```

---

## 16. 开发工具链

### 16.1 编译工具

| 工具 | 包名 | 版本 (Trixie) | 用途 |
|------|------|---------------|------|
| GCC | `gcc` | 14.2 | C/C++ 编译器 |
| G++ | `g++` | 14.2 | C++ 编译器 |
| Clang | `clang` | 19 | LLVM C/C++ 编译器 |
| Make | `make` | 4.4 | 构建工具 |
| CMake | `cmake` | 3.30+ | 跨平台构建 |
| Meson | `meson` | 1.5+ | 现代构建系统 |
| Ninja | `ninja-build` | 1.12 | 快速构建 |
| Rust | `rustc` | 1.85 | Rust 编译器 |
| Go | `golang-go` | 1.24+ | Go 编译器 |
| Python | `python3` | 3.13 | 解释器 |
| Perl | `perl` | 5.40 | 解释器 |
| Ruby | `ruby` | 3.3 | 解释器 |
| Node.js | `nodejs` | 20/22 | JS 运行时 |

### 16.2 调试工具

| 工具 | 包名 | 用途 |
|------|------|------|
| GDB | `gdb` | GNU 调试器 |
| LLDB | `lldb` | LLVM 调试器 |
| strace | `strace` | 系统调用追踪 |
| ltrace | `ltrace` | 库调用追踪 |
| valgrind | `valgrind` | 内存错误检测 |
| perf | `linux-perf` | 性能分析 |
| bpftrace | `bpftrace` | eBPF 追踪 |

### 16.3 构建环境

```bash
# 创建干净构建环境 (pbuilder)
sudo apt install pbuilder debootstrap
sudo pbuilder create --distribution trixie --architecture amd64
sudo pbuilder build package_1.0-1.dsc

# 使用 sbuild
sudo apt install sbuild schroot
sudo sbuild-createchroot trixie /srv/chroot/trixie-amd64
sudo sbuild -d trixie package_1.0-1.dsc

# 使用 cowbuilder (更快，使用 cowdancer)
sudo apt install cowbuilder
cowbuilder --create --distribution trixie
cowbuilder --build package_1.0-1.dsc
```

---

## 17. 系统管理注意事项

### 17.1 APT 操作黄金法则

```bash
# ✅ 正确的日常维护流程
sudo apt update                    # 1. 更新包列表
sudo apt upgrade                   # 2. 安全升级
sudo apt autoremove                # 3. 清理孤儿包
sudo apt autoclean                 # 4. 清理旧缓存

# ✅ 发行版升级
sudo apt update
sudo apt full-upgrade              # 处理依赖变更
# 或
do-release-upgrade                 # Ubuntu 专用

# ❌ 危险操作
sudo dpkg -i package.deb           # 忽略依赖，可能破坏系统
sudo apt remove libc6              # 会移除半个系统
sudo rm -rf /var/lib/dpkg/         # 破坏包数据库
```

### 17.2 包状态修复

```bash
# 修复损坏的依赖
sudo apt --fix-broken install
sudo apt -f install

# 修复 dpkg 中断
sudo dpkg --configure -a

# 强制重新配置所有包
sudo dpkg-reconfigure -a

# 清理残留配置
sudo dpkg --purge $(dpkg -l | grep '^rc' | awk '{print $2}')

# 查找并移除孤儿包
sudo apt autoremove
sudo apt autoremove --purge

# 查找已被删除包的残留文件
deborphan
sudo apt remove $(deborphan)
```

### 17.3 系统备份要点

```bash
# 备份包列表
dpkg --get-selections > installed-packages.txt

# 恢复包列表
sudo dpkg --set-selections < installed-packages.txt
sudo apt-get dselect-upgrade

# 备份手动安装的包
apt-mark showmanual > manual-packages.txt

# 备份 /etc (配置)
sudo tar czvf etc-backup.tar.gz /etc

# 备份 dpkg 状态
sudo cp /var/lib/dpkg/status /backup/dpkg-status.backup
```

### 17.4 安全最佳实践

```bash
# 1. 仅安装可信源的包
cat /etc/apt/sources.list | grep -v '^#'

# 2. 启用安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 3. 检查已知漏洞
sudo apt install debsecan
debsecan

# 4. 检查需要重启的服务
sudo apt install needrestart
sudo needrestart

# 5. 定期审计
sudo apt list --upgradeable
sudo apt-cache policy

# 6. 签名验证
ls /etc/apt/keyrings/
apt-key list
```

### 17.5 常见问题解决

```bash
# 问题 1: "dpkg was interrupted"
sudo dpkg --configure -a

# 问题 2: "hash sum mismatch"
sudo rm -rf /var/lib/apt/lists/*
sudo apt update

# 问题 3: 锁定文件错误
sudo rm /var/lib/dpkg/lock-frontend
sudo rm /var/lib/dpkg/lock
sudo dpkg --configure -a

# 问题 4: 无法定位包
sudo apt update
# 检查 sources.list
# 检查 component (main/contrib/non-free)

# 问题 5: 依赖冲突
sudo apt -f install
sudo apt full-upgrade
aptitude resolve                    # aptitude 解决能力更强

# 问题 6: 包残留配置
sudo dpkg --purge $(dpkg -l | grep '^rc' | awk '{print $2}')

# 问题 7: 下载慢
sudo apt install apt-transport-https ca-certificates
# 更换到就近镜像 (deb.debian.org 已使用 CDN)

# 问题 8: 磁盘空间不足
sudo apt clean
sudo apt autoremove --purge
dpkg-query -Wf '${Installed-Size}\t${Package}\n' | sort -n | tail -20
```

---

## 18. 常用命令速查

### 18.1 包查询速查

```bash
# ============ 搜索 ============
apt search keyword                  # 搜索包名和描述
apt-cache search keyword            # 同上
grep-dctrl -P keyword /var/lib/apt/lists/*Packages  # 高级搜索
apt-file search /path/to/file       # 搜索文件属于哪个包
apt-file search filename            # 搜索包含文件的包

# ============ 信息 ============
apt show package                    # 包详情
apt-cache show package              # 同上
apt-cache policy package            # 版本/来源/优先级
apt-cache madison package           # 所有可用版本
apt-cache depends package           # 依赖
apt-cache rdepends package          # 反向依赖
apt-cache showpkg package           # 详细包信息

# ============ 已安装 ============
dpkg -l                             # 所有已安装包
dpkg -l 'libc6*'                    # 模糊查询
dpkg -s package                     # 包状态
dpkg -L package                     # 文件列表
dpkg -S /path/to/file               # 文件归属
apt list --installed                # 已安装列表
apt list --upgradeable              # 可升级列表
apt-mark showmanual                 # 手动安装的包
apt-mark showauto                   # 自动安装的包
apt-mark showhold                   # 锁定的包

# ============ 文件内容 ============
dpkg -c package.deb                 # .deb 内容
dpkg-deb -I package.deb             # .deb 控制信息
dpkg-deb -f package.deb Field       # 特定字段
```

### 18.2 包操作速查

```bash
# ============ 安装 ============
sudo apt install package
sudo apt install package=version
sudo apt install package/unstable
sudo apt install ./package.deb      # 本地 .deb
sudo dpkg -i package.deb            # 直接安装 (不解决依赖)

# ============ 移除 ============
sudo apt remove package             # 保留配置
sudo apt purge package              # 完全清除
sudo apt autoremove                 # 自动移除孤儿包
sudo dpkg -r package                # 移除 (dpkg)
sudo dpkg -P package                # 完全清除 (dpkg)

# ============ 升级 ============
sudo apt update                     # 更新列表
sudo apt upgrade                    # 升级
sudo apt full-upgrade               # 完整升级
sudo apt dist-upgrade               # 发行版升级
sudo apt safe-upgrade               # aptitude 安全升级

# ============ 源码 ============
sudo apt source package             # 下载源码
sudo apt build-dep package          # 安装构建依赖
sudo dpkg-source -x package.dsc     # 解压源码包
sudo dpkg-buildpackage -us -uc -b   # 构建
```

### 18.3 系统维护速查

```bash
# ============ 配置 ============
sudo dpkg-reconfigure package       # 重新配置
sudo debconf-show package           # 查看配置答案
sudo update-alternatives --config cmd  # 切换命令
sudo dpkg-divert --list             # 查看重定向
sudo dpkg-statoverride --list       # 查看权限覆盖

# ============ 清理 ============
sudo apt clean                      # 清除所有缓存
sudo apt autoclean                  # 清除旧版本缓存
sudo apt autoremove                 # 移除孤儿包
sudo apt autoremove --purge         # 移除并清除配置

# ============ 验证 ============
sudo debsums -s                     # 检查所有包文件
sudo debsums package                # 检查单个包
sudo apt-get check                  # 检查依赖一致性
sudo dpkg --audit                   # 审计损坏包
lintian package.changes             # 包质量检查

# ============ 日志 ============
cat /var/log/dpkg.log
cat /var/log/apt/history.log
cat /var/log/apt/term.log
journalctl -u apt-daily
```

### 18.4 仓库管理速查

```bash
# ============ 密钥 ============
sudo apt-key list                   # 列出密钥 (旧)
ls /etc/apt/keyrings/               # 列出密钥 (新)
sudo cp key.gpg /etc/apt/keyrings/  # 添加密钥 (新)

# ============ Pinning ============
cat /etc/apt/preferences            # 查看优先级
cat /etc/apt/preferences.d/*        # 查看优先级片段
apt-cache policy                    # 查看全局策略

# ============ 镜像 ============
sudo apt install apt-transport-https
sudo sed -i 's|http://deb.debian.org|https://deb.debian.org|' /etc/apt/sources.list

# ============ 快照 ============
# snapshot.debian.org 可访问历史版本
```

---

## 附录：关键参考资源

| 资源 | URL | 说明 |
|------|-----|------|
| Debian 主页 | https://www.debian.org | 官方门户 |
| Debian 文档 | https://www.debian.org/doc/ | 官方文档 |
| Debian Policy | https://www.debian.org/doc/debian-policy/ | 包策略手册 |
| Debian Wiki | https://wiki.debian.org | 社区维基 |
| Debian Packages | https://packages.debian.org | 包搜索 |
| Debian Sources | https://sources.debian.org | 源码浏览 |
| Debian Bug Tracker | https://bugs.debian.org | Bug 追踪 |
| Debian Security | https://www.debian.org/security/ | 安全公告 |
| Debian LTS | https://wiki.debian.org/LTS | LTS 项目 |
| Debian Derivatives | https://wiki.debian.org/Derivatives/Census | 衍生版 |
| Debian Installer | https://www.debian.org/devel/debian-installer/ | 安装程序 |
| Debian Release Info | https://www.debian.org/releases/ | 发布信息 |
| snapshot.debian.org | https://snapshot.debian.org | 历史快照 |
| archive.debian.org | https://archive.debian.org | 归档仓库 |
| man apt | `man apt` | APT 手册 |
| man dpkg | `man dpkg` | dpkg 手册 |
| man deb-control | `man deb-control` | control 文件格式 |
| man deb-version | `man deb-version` | 版本号格式 |
| lintian tags | https://lintian.debian.org/ | Lintian 标签 |
| reproducible-builds | https://reproducible-builds.org | 可复现构建 |

---

> **报告生成时间**: 2026-05-28  
> **当前稳定版本**: Debian 13 "Trixie" (13.5)  
> **调研环境**: Ubuntu 24.04.4 LTS (基于 Debian)  
> **数据来源**: 系统实测 + Debian 官方数据 + 网络搜索
