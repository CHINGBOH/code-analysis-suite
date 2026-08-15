# Linux 内核全方位深度调研报告

> **调研日期**: 2026-05-28  
> **内核版本**: Linux 7.1-rc5  
> **源码来源**: torvalds/linux.git (工作目录: `code_analysis_suite/linux/`)  
> **统计工具**: scc + 手工分析  
> **总代码量**: 本地 `scc` 快照约 4,166 万总行；其中核心源码口径约 3,870 万行（C + Header + Assembly + Rust + Device Tree + Docs）

> **事实校验补充（2026-05-29）**: kernel.org 在 2026-05-24 发布的 mainline 标记为 `7.1-rc5`，稳定版为 `7.0.10`（2026-05-23）。本文的源码统计是针对本地 `code_analysis_suite/linux/` 工作树的一次性快照；若本地源码不是同一 tag，代码量和子系统占比需要重新跑 `scc`。来源: https://www.kernel.org/

---

## 目录

1. [内核规模与全景概览](#1-内核规模与全景概览)
2. [整体架构](#2-整体架构)
3. [支持的 CPU 架构](#3-支持的-cpu-架构)
4. [进程管理与调度器](#4-进程管理与调度器)
5. [内存管理子系统](#5-内存管理子系统)
6. [文件系统子系统](#6-文件系统子系统)
7. [网络协议栈](#7-网络协议栈)
8. [设备驱动模型](#8-设备驱动模型)
9. [中断、软中断与工作队列](#9-中断软中断与工作队列)
10. [并发与同步原语](#10-并发与同步原语)
11. [安全子系统](#11-安全子系统)
12. [eBPF 子系统](#12-ebpf-子系统)
13. [Rust 支持](#13-rust-支持)
14. [系统调用接口](#14-系统调用接口)
15. [内核开发注意事项](#15-内核开发注意事项)
16. [调试与性能分析工具](#16-调试与性能分析工具)
17. [内核构建系统](#17-内核构建系统)
18. [关键数据结构速查](#18-关键数据结构速查)

---

## 1. 内核规模与全景概览

### 1.1 代码量统计

基于 Linux 7.1-rc5 源码的 `scc` 统计：

| 语言 | 文件数 | 总行数 | 代码行 | 注释行 | 说明 |
|------|--------|--------|--------|--------|------|
| **C** | 36,680 | 26,084,659 | 19,435,489 | 2,886,425 | 核心实现 |
| **C Header** | 26,654 | 10,617,962 | 8,244,692 | 1,589,075 | 头文件/接口 |
| **Device Tree** | 6,251 | 2,056,253 | 1,690,534 | 90,666 | ARM/嵌入式设备描述 |
| **Assembly** | 1,366 | 381,397 | 288,495 | 50,468 | 启动/底层代码 |
| **Rust** | 349 | 142,973 | 93,729 | 37,387 | 新兴内核语言 |
| **Python** | 390 | 121,464 | 93,741 | 12,703 | 构建/测试脚本 |
| **Shell** | 1,156 | 215,089 | 152,651 | 26,251 | 辅助脚本 |
| **ReST/YAML/JSON** | 10,535 | 2,042,244 | 1,717,227 | — | 文档/配置 |
| **总计** | ~83,381 | ~41,662,041 | ~31,716,558 | — | 全部源码 |

### 1.2 子系统代码分布

| 子系统 | 目录 | 代码行数 | 占比 | 核心文件 |
|--------|------|----------|------|----------|
| **设备驱动** | `drivers/` | ~2,929,119 | ~47% | 22,107 个 .c 文件 |
| **头文件** | `include/linux/` | ~384,876 | ~6% | 2,600+ 个 .h 文件 |
| **内存管理** | `mm/` | ~190,944 | ~3% | page_alloc.c, slub.c, vmalloc.c |
| **调度器** | `kernel/sched/` | ~66,611 | ~1% | fair.c, core.c, rt.c, deadline.c |
| **文件系统** | `fs/` | ~87,407 | ~1.4% | ext4, btrfs, xfs, nfs, overlayfs |
| **网络核心** | `net/core/` | ~90,340 | ~1.5% | skbuff.c, sock.c, dev.c |
| **网络协议** | `net/` | ~462,900 | ~7.5% | tcp, ipv4/6, netfilter, bpf |
| **块设备** | `block/` | ~65,586 | ~1% | blk-mq, elevator |
| **x86 架构** | `arch/x86/` | ~99,040 | ~1.6% | entry, kernel, mm, boot |
| **ARM64** | `arch/arm64/` | ~61,674 | ~1% | 主流移动/服务器架构 |
| **内核核心** | `kernel/` | ~90,378 | ~1.5% | fork, exit, workqueue, irq, rcu |
| **安全** | `security/` | ~10,080 | ~0.2% | LSM, SELinux, AppArmor, Landlock |
| **加密** | `crypto/` | ~95,949 | ~1.5% | API + 算法实现 |
| **io_uring** | `io_uring/` | ~24,220 | ~0.4% | 异步 I/O |
| **eBPF** | `kernel/bpf/` | ~67 个文件 | ~1% | 67 个 .c 文件 |
| **其他** | lib, init, ipc, virt, rust | — | ~25% | — |

### 1.3 关键数字速查

| 指标 | 数值 |
|------|------|
| 支持的 CPU 架构 | **21 种** |
| 文件系统 | **34 种**（含 ext4, btrfs, xfs, nfs, overlayfs, f2fs 等） |
| 网络协议栈 | **67 个协议目录** |
| 驱动类别 | **143 个** |
| 系统调用 (x86_64) | **442 个** |
| 调度类 | **5 个**（Stop/Deadline/RT/Fair/Idle） |
| EXPORT_SYMBOL 导出 | **~39,808 个** |
| 锁实现种类 | **17 种** |
| Kconfig 配置文件 | **1,908 个** |
| Makefile | **3,184 个** |
| 文档页数 | **11,157 页** |
| 内核示例代码 | **156 个** samples |
| 内核工具 | **9,159 个**（perf, bpftool, selftests 等） |

---

## 2. 整体架构

### 2.1 内核空间 vs 用户空间

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Space                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Shell   │  │  Python  │  │  Nginx   │  │  Database (MySQL)  │  │
│  │  (bash)  │  │   App    │  │  Server  │  │                    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘  │
│       │             │             │                   │              │
│  ┌────┴─────────────┴─────────────┴───────────────────┴──────┐      │
│  │              C Library (glibc/musl)                        │      │
│  │  open() read() write() mmap() fork() socket() ioctl()     │      │
│  └────────────────────────┬───────────────────────────────────┘      │
│                           │                                          │
│                    ┌──────┴──────┐                                  │
│                    │ System Call │  (442 个 syscall)                │
│                    └──────┬──────┘                                  │
└───────────────────────────┼────────────────────────────────────────┘
                            │  特权级切换 (Ring 3 → Ring 0)
┌───────────────────────────┼────────────────────────────────────────┐
│                           ▼              Kernel Space                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Virtual File System (VFS)    │  进程管理 (fork, exec)      │    │
│  │  ext4/btrfs/xfs/nfs...        │  调度器 (CFS/RT/Deadline)   │    │
│  └────────────────┬────────────────────────────────────────────┘    │
│                   │                                                  │
│  ┌────────────────┼────────────────┬────────────────────────────┐  │
│  │  内存管理 (mm)  │  网络栈 (net)   │  块设备 (block)            │  │
│  │  Page/Buddy/SLUB│  TCP/IP/Netfilter│  blk-mq/IO Schedulers    │  │
│  └────────────────┴────────────────┴────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  设备驱动框架                                                │   │
│  │  PCI/USB/SATA/NVMe/GPU/网卡/声卡/...                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  硬件抽象层 (HAL)                                            │   │
│  │  x86/ARM64/RISC-V/PowerPC/...                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 内核启动流程

```
1. Bootloader (GRUB2/systemd-boot/UEFI)
   └─ 加载内核镜像 (vmlinuz) + initrd/initramfs

2. 架构相关入口 (arch/x86/boot/ 或 arch/arm64/kernel/head.S)
   └─ 汇编代码设置页表、临时栈、禁用中断

3. start_kernel() [init/main.c: ~850行]
   └─ 内核的 "main()" 函数

4. 初始化子系统（按顺序）:
   ├─ setup_arch()        # 架构初始化
   ├─ mm_init()           # 内存管理初始化
   ├─ sched_init()        # 调度器初始化
   ├─ init_IRQ()          # 中断初始化
   ├─ time_init()         # 时钟初始化
   ├─ console_init()      # 控制台初始化
   ├─ vfs_caches_init()   # VFS 缓存初始化
   ├─ signals_init()      # 信号系统初始化
   ├─ page_alloc_init()   # 页分配器初始化
   ├─ kmem_cache_init()   # SLUB 初始化
   ├─ calibrate_delay()   # BogoMIPS 校准
   └─ rest_init()         # 创建 init 进程 (PID 1)

5. kernel_init() → 运行 /sbin/init (systemd)
```

---

## 3. 支持的 CPU 架构

| 架构 | 目录 | 状态 | 典型用途 |
|------|------|------|----------|
| **x86_64** | `arch/x86/` | 一级支持 | 桌面/服务器/云（绝对主流） |
| **ARM64 (AArch64)** | `arch/arm64/` | 一级支持 | 移动/服务器/云/嵌入式 |
| **ARM (32-bit)** | `arch/arm/` | 维护中 | 旧嵌入式设备 |
| **RISC-V** | `arch/riscv/` | 活跃开发 | 新兴开源架构 |
| **LoongArch** | `arch/loongarch/` | 活跃 | 中国龙芯 |
| **PowerPC (ppc64le)** | `arch/powerpc/` | 维护中 | IBM 服务器 |
| **s390x (IBM Z)** | `arch/s390/` | 维护中 | IBM 大型机 |
| **MIPS** | `arch/mips/` | 维护中 | 路由器/嵌入式 |
| **SPARC** | `arch/sparc/` | 维护中 | Oracle 服务器 |
| **Alpha** | `arch/alpha/` | 维护中 | 历史架构 |
| **Itanium (IA-64)** | 已移除 | — | 历史架构 |
| **ARC/CSKY/Hexagon/m68k/Microblaze/NIOS2/OpenRISC/PA-RISC/SH/Xtensa** | 对应目录 | 维护/小众 | 嵌入式/教学 |
| **UM (User Mode Linux)** | `arch/um/` | 维护中 | 用户空间运行内核（测试） |

---

## 4. 进程管理与调度器

### 4.1 核心数据结构

```c
// include/linux/sched.h
struct task_struct {
    pid_t pid;                    // 进程 ID
    pid_t tgid;                   // 线程组 ID
    volatile long state;          // 状态: TASK_RUNNING/INTERRUPTIBLE/UNINTERRUPTIBLE/STOPPED/ZOMBIE
    struct mm_struct *mm;         // 用户态内存描述符
    struct mm_struct *active_mm;  // 活跃内存描述符
    struct sched_entity se;       // CFS 调度实体
    struct sched_rt_entity rt;    // RT 调度实体
    struct sched_dl_entity dl;    // Deadline 调度实体
    struct list_head tasks;       // 全局任务链表
    cpumask_t cpus_mask;          // 允许的 CPU 掩码
    int prio, static_prio, normal_prio;  // 优先级
    unsigned int policy;          // 调度策略: SCHED_FIFO/RR/NORMAL/BATCH/IDLE/DEADLINE
    struct files_struct *files;   // 打开文件表
    struct signal_struct *signal; // 信号处理
    struct sighand_struct *sighand;
    struct nsproxy *nsproxy;      // 命名空间代理
    cputime_t utime, stime;       // 用户/系统 CPU 时间
    // ... (约 150+ 个字段)
};
```

### 4.2 调度类 (Scheduling Classes)

```c
// kernel/sched/core.c
const struct sched_class * const sched_class_highest = &stop_sched_class;

调度优先级（从高到低）:
1. stop_sched_class      # 停止/迁移任务（最高优先级，核间迁移用）
2. dl_sched_class        # SCHED_DEADLINE (实时 + 截止时间)
3. rt_sched_class        # SCHED_FIFO / SCHED_RR (实时)
4. fair_sched_class      # SCHED_NORMAL / SCHED_BATCH / SCHED_IDLE (CFS, 默认)
5. idle_sched_class      # 空闲任务（每个 CPU 的 idle 线程）
```

| 调度类 | 策略 | 适用场景 | 算法 |
|--------|------|----------|------|
| **Stop** | — | 核间迁移、热插拔 | 无调度，直接抢占 |
| **Deadline** | `SCHED_DEADLINE` | 硬实时（视频编解码、机器人控制） | EDF (最早截止时间优先) + CBS |
| **RT** | `SCHED_FIFO` / `SCHED_RR` | 软实时（音频处理、工业控制） | 优先级队列，FIFO/Round-Robin |
| **Fair (CFS)** | `SCHED_NORMAL` / `SCHED_BATCH` | 通用任务 | 红黑树 + vruntime 虚拟时间 |
| **Idle** | `SCHED_IDLE` | 最低优先级后台任务 | 仅在 CPU 空闲时运行 |

### 4.3 CFS (Completely Fair Scheduler) 核心

```c
// kernel/sched/fair.c
// CFS 使用红黑树管理可运行任务

struct sched_entity {
    struct load_weight load;      // 负载权重
    struct rb_node run_node;      // 红黑树节点
    u64 vruntime;                 // 虚拟运行时间（越小越优先）
    u64 sum_exec_runtime;         // 总执行时间
    u64 prev_sum_exec_runtime;
    u64 nr_migrations;            // 迁移次数
    // ...
};

// 调度时机:
// 1. 时钟中断 (scheduler_tick)
// 2. 系统调用返回 (syscall_exit)
// 3. 中断返回 (irq_exit)
// 4. 显式调用 schedule()
// 5. 阻塞/睡眠时
```

### 4.4 调度器组与带宽控制

```
CPU (cgroups v2)
└─ cpu.weight   (CFS 权重)
└─ cpu.max      (带宽限制: quota/period)
└─ cpu.uclamp.min/max (utilization clamping)
```

---

## 5. 内存管理子系统

### 5.1 内存层次结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户空间视图                                  │
│  虚拟地址空间 (48-bit, 256TB)                                       │
│  ┌────────────┬────────────┬────────────┬────────────┐             │
│  │   Text     │   Data     │   Heap     │   Stack    │             │
│  │  (代码)    │  (数据)    │  (堆)      │  (栈)      │             │
│  └────────────┴────────────┴────────────┴────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       内核空间视图                                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Virtual Memory Area (VMA)  ── struct vm_area_struct        │   │
│  │  每个 mmap()/malloc() 区域对应一个 VMA                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Page Tables (4-level/5-level)                              │   │
│  │  PGD → P4D → PUD → PMD → PTE → Physical Page                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Physical Memory (Page Frame)                               │   │
│  │  struct page (每页 4KB/2MB/1GB)                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 核心数据结构

```c
// include/linux/mm_types.h

struct page {
    // 页框描述符 (64 bytes, 紧凑设计)
    // union 联合体，根据用途复用内存
    union {
        struct {    // 映射页用
            struct list_head lru;
            struct address_space *mapping;
            pgoff_t index;
            unsigned long private;
        };
        struct {    // slab 用
            struct slab *slab;
            void *freelist;
        };
        // ... 其他变体
    };
    atomic_t _refcount;      // 引用计数
    atomic_t _mapcount;      // 映射计数
    unsigned long flags;     // 页标志
    // ...
};

struct mm_struct {
    pgd_t *pgd;              // 页全局目录
    struct vm_area_struct *mmap;  // VMA 链表
    struct rb_root mm_rb;    // VMA 红黑树
    unsigned long start_code, end_code;
    unsigned long start_data, end_data;
    unsigned long start_brk, brk;
    unsigned long start_stack;
    atomic_t mm_users;       // 用户计数
    atomic_t mm_count;       // 引用计数
    // ...
};

struct vm_area_struct {
    unsigned long vm_start, vm_end;  // 虚拟地址范围
    pgprot_t vm_page_prot;   // 页保护标志
    unsigned long vm_flags;  // 标志: VM_READ/WRITE/EXEC/SHARED
    struct mm_struct *vm_mm;
    const struct vm_operations_struct *vm_ops;
    struct file *vm_file;    // 映射的文件
    // ...
};
```

### 5.3 内存分配器层次

| 分配器 | 粒度 | 用途 | 核心函数 | 文件 |
|--------|------|------|----------|------|
| **Buddy System** | 页 (4KB) | 物理页分配 | `alloc_pages()`, `__get_free_pages()` | `mm/page_alloc.c` |
| **SLUB** | 对象 (8B~4KB) | 内核对象缓存 | `kmalloc()`, `kzalloc()`, `kfree()` | `mm/slub.c` |
| **vmalloc** | 连续虚拟地址 | 大内核缓冲区 | `vmalloc()`, `vfree()` | `mm/vmalloc.c` |
| **per-CPU** | per-CPU 变量 | 无锁分配 | `alloc_percpu()`, `this_cpu_ptr()` | `mm/percpu.c` |
| **Page Cache** | 页 | 文件缓存 | `add_to_page_cache()` | `mm/filemap.c` |
| **KASAN** | — | 内存错误检测 | — | `mm/kasan/` |
| **KFENCE** | — | 内存错误检测 | — | `mm/kfence/` |

### 5.4 虚拟内存映射 (VMA) 操作

```c
// 创建 VMA
void *mmap(void *addr, size_t len, int prot, int flags, int fd, off_t offset);

// 内核侧处理路径:
// sys_mmap → ksys_mmap_pgoff → vm_mmap_pgoff → do_mmap

// 缺页异常处理路径:
// do_page_fault → handle_mm_fault → __handle_mm_fault
//   → handle_pte_fault → do_fault/do_anonymous_page/do_swap_page
```

---

## 6. 文件系统子系统

### 6.1 VFS (Virtual File System) 层

```
用户空间
   │ open()/read()/write()/close()
   ▼
┌──────────────────────────────────────────────────────────────┐
│  系统调用层 (fs/open.c, fs/read_write.c)                     │
├──────────────────────────────────────────────────────────────┤
│  VFS 层 (fs/)                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ struct file│  │struct inode│  │ struct     │             │
│  │  (打开文件) │  │  (索引节点) │  │ dentry     │             │
│  └────────────┘  └────────────┘  │ (目录项)    │             │
│                                   └────────────┘             │
├──────────────────────────────────────────────────────────────┤
│  具体文件系统实现                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │  ext4  │ │ btrfs  │ │  xfs   │ │  nfs   │ │ overlay│    │
│  │(日志式)│ │(写时复制)│ │(高性能)│ │(网络)  │ │(联合)  │    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
├──────────────────────────────────────────────────────────────┤
│  Page Cache (mm/filemap.c)                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Buffer Cache / Page Cache                             │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                     │  │
│  │  │page1│ │page2│ │page3│ │page4│ ...                  │  │
│  │  └─────┘ └─────┘ └─────┘ └─────┘                     │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  块设备层 (block/)                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ blk-mq     │  │ I/O Sched  │  │ elevator   │             │
│  │ (多队列)   │  │ (调度器)   │  │ (电梯算法)  │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 支持的文件系统 (34+)

| 文件系统 | 类型 | 特点 | 典型场景 |
|----------|------|------|----------|
| **ext4** | 日志式 | 成熟稳定，默认选择 | 通用文件系统 |
| **btrfs** | 写时复制 | 快照、校验和、RAID | 桌面、NAS |
| **xfs** | 日志式 | 大文件性能优秀 | 数据库、HPC |
| **f2fs** | 日志结构 | 针对 NAND 优化 | SSD/手机 |
| **nfs** | 网络 | V4.2 + pNFS | 网络存储 |
| **ceph** | 分布式 | 统一块/文件/对象 | Ceph 集群 |
| **overlayfs** | 联合挂载 | 上层+下层叠加 | 容器镜像 |
| **erofs** | 只读 | 压缩、去重 | 手机系统分区 |
| **squashfs** | 只读压缩 | 高压缩比 | LiveCD/嵌入式 |
| **ntfs3** | Windows | Paragon 实现 | 双系统兼容 |
| **exfat** | 可移动设备 | 大文件支持 | U 盘/SD 卡 |
| **tmpfs** | 内存 | RAM 存储 | /tmp, /dev/shm |
| **procfs/sysfs/debugfs** | 虚拟 | 内核信息导出 | /proc, /sys |
| **bpf** | 虚拟 | eBPF 持久化 | BPF 程序存储 |
| **9p/virtiofs** | 半虚拟化 | 宿主-虚拟机共享 | QEMU/KVM |

### 6.3 核心 VFS 数据结构

```c
// include/linux/fs.h

struct inode {
    umode_t i_mode;          // 文件类型 + 权限
    uid_t i_uid;             // 所有者 UID
    gid_t i_gid;             // 组 GID
    loff_t i_size;           // 文件大小
    struct timespec64 i_atime, i_mtime, i_ctime;
    blkcnt_t i_blocks;       // 块数
    unsigned long i_ino;     // inode 号
    const struct inode_operations *i_op;
    const struct file_operations *i_fop;
    struct address_space *i_mapping;  // 页缓存映射
    // ...
};

struct file {
    struct path f_path;      // 路径 (dentry + vfsmount)
    struct inode *f_inode;   // inode 指针
    const struct file_operations *f_op;
    atomic_long_t f_count;   // 引用计数
    loff_t f_pos;            // 当前读写位置
    unsigned int f_flags;    // O_RDONLY/O_WRONLY/O_RDWR 等
    struct fown_struct f_owner;
    // ...
};

struct dentry {
    unsigned int d_flags;
    struct hlist_bl_node d_hash;
    struct dentry *d_parent;
    struct qstr d_name;      // 目录项名称
    struct inode *d_inode;   // 关联的 inode
    struct list_head d_lru;
    struct list_head d_subdirs;  // 子目录链表
    // ...
};

// 文件操作回调
struct file_operations {
    struct module *owner;
    loff_t (*llseek)(struct file *, loff_t, int);
    ssize_t (*read)(struct file *, char __user *, size_t, loff_t *);
    ssize_t (*write)(struct file *, const char __user *, size_t, loff_t *);
    int (*open)(struct inode *, struct file *);
    int (*release)(struct inode *, struct file *);
    // ... 20+ 个回调
};
```

---

## 7. 网络协议栈

### 7.1 网络栈分层架构

```
用户空间 (Socket API)
├─ socket(), bind(), listen(), accept(), connect()
├─ send(), recv(), sendto(), recvfrom()
└─ setsockopt(), getsockopt(), ioctl()
   ↓
Socket 层 (net/socket.c)
├─ struct socket (BSD socket)
├─ struct sock (协议无关套接字)
└─ sock->ops->sendmsg()/recvmsg()
   ↓
传输层
├─ TCP (net/ipv4/tcp*.c)
│  ├─ 连接管理: 三次握手/四次挥手
│  ├─ 拥塞控制: CUBIC/BBR/DCTCP
│  ├─ 流量控制: 滑动窗口
│  └─ 可靠性: 重传、ACK、SACK
├─ UDP (net/ipv4/udp.c)
│  └─ 无连接、无状态
└─ SCTP/DCCP/MPTCP (可选)
   ↓
网络层
├─ IPv4 (net/ipv4/ip*.c)
├─ IPv6 (net/ipv6/*.c)
├─ 路由 (net/ipv4/route.c, fib_*)
├─ ARP/NDP (邻居发现)
├─ Netfilter (net/netfilter/)
│  ├─ iptables/nftables (防火墙)
│  ├─ NAT (SNAT/DNAT)
│  ├─ Connection Tracking
│  └─ eBPF/XDP 集成
└─ XDP (eXpress Data Path) - 驱动层包处理
   ↓
链路层 / 设备层
├─ net/core/dev.c (网络设备核心)
├─ struct net_device (网卡抽象)
├─ NAPI (New API) 轮询机制
├─ Qdisc (队列规则: pfifo_fast/fq_codel/HTB)
├─ TC (Traffic Control)
└─ 驱动层: drivers/net/ethernet/
```

### 7.2 核心网络数据结构

```c
// include/linux/skbuff.h
struct sk_buff {
    struct sk_buff *next, *prev;  // sk_buff_head 链表
    struct sock *sk;              // 关联的 socket
    unsigned int len, data_len;   // 数据总长度 / 分页数据长度
    __u16 protocol;               // 三层协议 (ETH_P_IP/IPv6)
    __u16 transport_header;       // 传输层头偏移
    __u16 network_header;         // 网络层头偏移
    __u16 mac_header;             // MAC 头偏移
    unsigned char *head, *data, *tail, *end;  // 数据指针
    struct net_device *dev;       // 输入/输出设备
    // ... (约 60+ 字段)
};

// include/linux/netdevice.h
struct net_device {
    char name[IFNAMSIZ];          // "eth0", "lo"
    unsigned long state;          // 设备状态
    struct net_device_stats stats;
    const struct net_device_ops *netdev_ops;
    const struct ethtool_ops *ethtool_ops;
    unsigned int flags;           // IFF_UP/IFF_BROADCAST/IFF_PROMISC
    unsigned int mtu;             // 最大传输单元
    unsigned short type;          // ARPHRD_ETHER 等
    struct net *nd_net;           // 网络命名空间
    // ... (约 150+ 字段)
};

// include/linux/net.h
struct socket {
    socket_state state;           // SS_CONNECTED/SS_UNCONNECTED
    short type;                   // SOCK_STREAM/DGRAM/RAW
    unsigned long flags;
    struct socket_wq *wq;
    struct file *file;
    struct sock *sk;              // -> 协议层套接字
    const struct proto_ops *ops;  // 协议操作表
};
```

### 7.3 关键网络技术

| 技术 | 说明 | 文件 |
|------|------|------|
| **NAPI** | 混合中断+轮询，高吞吐网卡 | `net/core/dev.c` |
| **XDP** | 驱动层 eBPF 程序直接处理包 | `net/core/dev.c`, `drivers/net/` |
| **TC (Traffic Control)** | QoS 队列调度 | `net/sched/` |
| **Netfilter** | 包过滤框架 | `net/netfilter/` |
| **eBPF Socket Filter** | socket 层 eBPF 过滤 | `kernel/bpf/sockmap.c` |
| **MPTCP** | 多路径 TCP | `net/mptcp/` |
| **WireGuard** | 现代 VPN | `drivers/net/wireguard/` |

---

## 8. 设备驱动模型

### 8.1 驱动模型核心

```
用户空间 (sysfs)
/sys/bus/    → PCI/USB/PCIe/I2C/SPI/Platform
/sys/class/  → net/block/char/sound/...
/sys/devices/→ 设备树

驱动模型核心:
├─ struct bus_type     (总线类型)
├─ struct device       (设备实例)
├─ struct device_driver (驱动程序)
├─ struct device_type  (设备类型)
└─ struct class        (设备类)
```

### 8.2 驱动类别 (143 个)

| 类别 | 典型设备 | 核心文件 |
|------|----------|----------|
| **PCI** | 网卡、GPU、NVMe | `drivers/pci/` |
| **USB** | U 盘、键盘、摄像头 | `drivers/usb/` |
| **NVMe** | SSD | `drivers/nvme/` |
| **SCSI** | 硬盘、磁带 | `drivers/scsi/` |
| **SATA/AHCI** | 传统硬盘 | `drivers/ata/` |
| **GPU/DRM** | 显卡 | `drivers/gpu/drm/` |
| **Network** | 网卡 | `drivers/net/` |
| **Sound (ALSA)** | 声卡 | `sound/` |
| **Input** | 键盘、鼠标、触摸板 | `drivers/input/` |
| **I2C/SPI** | 传感器、EEPROM | `drivers/i2c/`, `drivers/spi/` |
| **GPIO** | LED、按键 | `drivers/gpio/` |
| **RTC** | 实时时钟 | `drivers/rtc/` |
| **Watchdog** | 看门狗 | `drivers/watchdog/` |
| **V4L2** | 摄像头 | `drivers/media/` |
| **HID** | USB/蓝牙输入设备 | `drivers/hid/` |
| **Thermal** | 温度传感器、风扇 | `drivers/thermal/` |
| **Power** | 电池、充电 | `drivers/power/` |
| **ACPI** | 电源管理、设备枚举 | `drivers/acpi/` |
| **Virtio** | 虚拟设备 | `drivers/virtio/` |
| **Xen/KVM** | 虚拟化 | `drivers/xen/`, `virt/kvm/` |
| **Remoteproc/RPMsg** | 协处理器 | `drivers/remoteproc/` |

### 8.3 Platform 驱动 (无总线设备)

```c
// 适用于 SoC 内部设备（无 PCI/USB 等标准总线）

static const struct of_device_id my_of_match[] = {
    { .compatible = "vendor,mydevice", },
    { }
};
MODULE_DEVICE_TABLE(of, my_of_match);

static struct platform_driver my_driver = {
    .probe = my_probe,
    .remove = my_remove,
    .driver = {
        .name = "mydevice",
        .of_match_table = my_of_match,
    },
};
module_platform_driver(my_driver);
```

### 8.4 Device Tree (ARM/嵌入式)

ARM/ARM64/RISC-V 架构使用 **Device Tree** 描述硬件，而不是 BIOS/ACPI。

```dts
// arch/arm64/boot/dts/xxx.dtsi
mydevice@10000000 {
    compatible = "vendor,mydevice";
    reg = <0x10000000 0x1000>;
    interrupts = <GIC_SPI 42 IRQ_TYPE_LEVEL_HIGH>;
    clocks = <&clk_uart>;
    status = "okay";
};
```

---

## 9. 中断、软中断与工作队列

### 9.1 中断处理机制

```
硬件中断发生
   ↓
CPU 切换到中断上下文
   ↓
do_IRQ() [arch/x86/kernel/irq.c]
   ↓
generic_handle_irq() [kernel/irq/irqdesc.c]
   ↓
irq_desc->handle_irq()  (高层处理)
   ↓
handle_edge_irq() / handle_level_irq()
   ↓
irq_desc->action->handler()  (设备驱动注册的处理函数)
   ↓
返回（或唤醒软中断/工作队列）
```

### 9.2 上半部 vs 下半部

| 机制 | 执行上下文 | 特性 | 用途 |
|------|-----------|------|------|
| **Top Half (硬中断)** | 中断上下文 | 快速，关中断，不可睡眠 | 确认中断、读取状态 |
| **SoftIRQ** | 软中断上下文 | 稍慢，不可睡眠 | 网络 RX/TX, 块设备完成, 定时器 |
| **Tasklet** | 软中断上下文 | 同一 tasklet 不会并行 | 替代 SoftIRQ |
| **Workqueue** | 进程上下文 | 可睡眠，可调度 | 复杂处理、I/O 操作 |
| **Threaded IRQ** | 内核线程 | 完全可调度 | 长耗时中断处理 |

```c
// 注册中断
request_irq(unsigned int irq, irq_handler_t handler,
            unsigned long flags, const char *name, void *dev);

// 注册 Threaded IRQ
request_threaded_irq(unsigned int irq, irq_handler_t handler,
                     irq_handler_t thread_fn,
                     unsigned long flags, const char *name, void *dev);

// 工作队列示例
struct work_struct my_work;
INIT_WORK(&my_work, my_work_handler);
schedule_work(&my_work);        // 默认工作队列
queue_work(my_wq, &my_work);   // 自定义工作队列

// 延迟工作
struct delayed_work my_dwork;
schedule_delayed_work(&my_dwork, msecs_to_jiffies(100));
```

---

## 10. 并发与同步原语

### 10.1 锁类型全景

| 锁类型 | 特点 | 用途 | 文件 |
|--------|------|------|------|
| **raw_spinlock_t** | 关抢占+关中断 | 最底层、最短临界区 | `kernel/locking/spinlock.c` |
| **spinlock_t** | raw_spinlock 封装 | 通用自旋锁 | `kernel/locking/spinlock.c` |
| **mutex** | 可睡眠、优先级继承 | 长时间持有 | `kernel/locking/mutex.c` |
| **rwsem** | 读写信号量 | 读多写少 | `kernel/locking/rwsem.c` |
| **seqlock** | 无锁读、写加锁 | 高频读低频写（jiffies） | `include/linux/seqlock.h` |
| **RCU** | 读无锁、写延迟释放 | 读多写极少 | `kernel/rcu/` |
| **percpu** | 每 CPU 变量 | 无锁计数器/缓存 | `include/linux/percpu.h` |
| **atomic_t** | 原子操作 | 简单计数器 | `include/linux/atomic.h` |
| **futex** | 用户空间快速互斥 | glibc mutex/pthread | `kernel/futex/` |
| **rtmutex** | 实时优先级继承 | PREEMPT_RT | `kernel/locking/rtmutex.c` |
| **local_lock** | 禁止抢占+中断 | 每 CPU 数据结构 | `include/linux/local_lock.h` |
| **qrwlock** | 队列式读写锁 | NUMA 友好 | `kernel/locking/qrwlock.c` |
| **qspinlock** | 队列式自旋锁 | MCS 算法 | `kernel/locking/qspinlock.c` |

### 10.2 锁使用规则

```
┌─────────────────────────────────────────────────────────────────────┐
│                     锁选择决策树                                     │
├─────────────────────────────────────────────────────────────────────┤
│ 1. 数据结构是否是 per-CPU 的?                                       │
│    是 → 使用 percpu variables (完全无锁)                            │
│                                                                       │
│ 2. 读多写极少?                                                      │
│    是 → 使用 RCU (读无锁，写延迟释放)                                │
│                                                                       │
│ 3. 高频读低频写?                                                    │
│    是 → 使用 seqlock 或 rwlock                                      │
│                                                                       │
│ 4. 临界区是否可以睡眠?                                              │
│    不可以（中断上下文） → spinlock / raw_spinlock                    │
│    可以（进程上下文）  → mutex / rwsem                               │
│                                                                       │
│ 5. 实时要求?                                                        │
│    是 → rtmutex + PREEMPT_RT                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.3 RCU (Read-Copy-Update)

RCU 是 Linux 内核最核心的并发技术之一。

```c
// 读侧（完全无锁）
rcu_read_lock();
p = rcu_dereference(ptr);  // 解引用指针
// ... 安全读取 p 指向的数据 ...
rcu_read_unlock();

// 写侧
p = kzalloc(sizeof(*p), GFP_KERNEL);
*p = new_data;
rcu_assign_pointer(ptr, p);  // 原子更新指针
synchronize_rcu();             // 等待所有读侧完成
kfree(old_p);                  // 安全释放旧数据

// 或使用 call_rcu 异步释放
call_rcu(&old_p->rcu, free_callback);
```

**RCU 关键特性**:
- 读侧零开销（仅禁止抢占）
- 写侧延迟释放（宽限期 grace period）
- 适用于链表、树、哈希表等数据结构
- 不能持有 spinlock 调用 `synchronize_rcu()`（会死锁）

### 10.4 Lockdep (Lock Dependency Validator)

```
内核自带的死锁检测工具，自动分析锁依赖关系。

CONFIG_LOCKDEP=y          # 启用
CONFIG_LOCKDEP_SMALL=n    # 完整模式
CONFIG_PROVE_LOCKING=y    # 验证锁规则

检测能力:
- 死锁检测 (AB-BA 循环)
- 锁层级违规
- 中断上下文锁使用错误
- 锁与 RCU 的不当组合
```

---

## 11. 安全子系统

### 11.1 LSM (Linux Security Modules)

```
LSM 框架: 可插拔的安全模块

内核支持的安全模块:
├─ SELinux    (RedHat/SUSE/Debian/Fedora)
├─ AppArmor   (Ubuntu/SUSE) ← Ubuntu 默认
├─ Smack      (Samsung Tizen)
├─ TOMOYO     (NEC)
├─ Landlock   (新，非特权沙箱)
├─ IPE        (新，完整性策略执行)
├─ YAMA       (ptrace 限制)
├─ LoadPin    (模块加载限制)
├─ SafeSetID  (setuid 限制)
└─ Lockdown   (内核锁定模式)
```

### 11.2 AppArmor (Ubuntu 默认)

```
AppArmor 配置文件示例:
/etc/apparmor.d/usr.bin.firefox

#include <tunables/global>
/usr/lib/firefox/firefox {
    #include <abstractions/base>
    #include <abstractions/fonts>
    
    capability sys_admin,
    
    /usr/lib/firefox/** r,
    /home/*/.mozilla/** rwk,
    /tmp/** rw,
    
    deny /etc/shadow r,
    deny /proc/*/mem r,
}
```

### 11.3 其他安全机制

| 机制 | 说明 | 用途 |
|------|------|------|
| **Seccomp** | 系统调用过滤 | Chrome/Firefox 沙箱 |
| **Namespaces** | 进程隔离 | 容器 (PID/Net/Mount/UTS/IPC/User/Cgroup/Time) |
| **Capabilities** | 细粒度特权 | CAP_NET_ADMIN, CAP_SYS_ADMIN 等 |
| **Kernel Lockdown** | 内核完整性 | 禁止从用户空间修改内核内存 |
| **IMA/EVM** | 完整性度量 | 文件完整性验证 |
| **Kernel Self Protection** | 内核自我保护 | KASLR, stack protector, CFI |

---

## 12. eBPF 子系统

### 12.1 eBPF 是什么

**eBPF (extended Berkeley Packet Filter)** 是 Linux 内核的可编程虚拟机，允许安全地在内核中运行用户定义的代码。

```
用户空间
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  eBPF 程序 (C/Rust 编写，编译为 eBPF 字节码)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ XDP      │ │ kprobe   │ │ tracepoint│ │ cgroup   │             │
│  │ TC       │ │ uprobe   │ │ fentry    │ │ socket   │             │
│  │ sockops  │ │ kretprobe│ │ raw_tp    │ │ lsm      │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│       └─────────────┴─────────────┴─────────────┘                  │
│                      libbpf / bpftool                             │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│  eBPF 验证器 (kernel/bpf/verifier.c)                               │
│  - 确保程序终止                                                     │
│  - 禁止空指针解引用                                                 │
│  - 禁止越界访问                                                     │
│  - 禁止循环（旧版）/ 受限循环（新版）                               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│  eBPF JIT 编译器                                                    │
│  - x86_64 / ARM64 / RISC-V / s390x / ...                           │
│  - 字节码 → 原生机器码                                               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│  eBPF Maps (内核/用户空间共享数据结构)                               │
│  - BPF_MAP_TYPE_HASH / ARRAY / LRU_HASH / PERCPU_HASH               │
│  - BPF_MAP_TYPE_RINGBUF / QUEUE / STACK                             │
│  - BPF_MAP_TYPE_BLOOM_FILTER                                        │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Hook 点 (67 个 .c 文件)                                            │
│  - 网络: XDP, TC, socket, cgroup_skb                                │
│  - 追踪: kprobe, tracepoint, fentry/fexit                           │
│  - 安全: LSM (MAC), cgroup, sysctl                                  │
│  - 调度: sched_cls, sched_act                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2 eBPF 程序类型

| 类型 | 触发点 | 典型用途 |
|------|--------|----------|
| **XDP** | 网卡驱动 RX | DDoS 防护、负载均衡、包过滤 |
| **TC (Traffic Control)** | 网络层 | QoS、流量整形、监控 |
| **kprobe/kretprobe** | 任意内核函数 | 动态追踪、性能分析 |
| **tracepoint** | 内核静态追踪点 | 系统调用追踪、调度追踪 |
| **fentry/fexit** | 函数入口/出口 | 低开销追踪（替代 kprobe） |
| **cgroup_skb** | cgroup 网络包 | 容器网络策略 |
| **cgroup_sock** | socket 创建 | 容器 socket 控制 |
| **LSM** | 安全钩子 | 自定义安全策略 |
| **BPF iterator** | /proc 虚拟文件 | 内核状态导出 |
| **struct_ops** | TCP 拥塞控制算法 | 自定义 BBR/CUBIC 变体 |

### 12.3 eBPF 开发示例

```c
// hello.bpf.c (eBPF 程序)
#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

SEC("tp/syscalls/sys_enter_openat")
int trace_openat(struct trace_event_raw_sys_enter *ctx)
{
    bpf_printk("openat called: pid=%d\n", bpf_get_current_pid_tgid() >> 32);
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
```

```bash
# 编译
bpftool gen skeleton hello.bpf.o > hello.skel.h
clang -O2 -g -target bpf -c hello.bpf.c -o hello.bpf.o

# 加载
sudo bpftool prog load hello.bpf.o /sys/fs/bpf/hello
sudo bpftool prog trace log
```

---

## 13. Rust 支持

### 13.1 内核 Rust 现状

Linux 6.1+ 引入实验性 Rust 支持，Linux 7.x 持续扩展。

```
rust/
├── kernel/        # Rust 内核抽象层
│   ├── alloc.rs   # 内存分配
│   ├── module.rs  # 模块宏
│   ├── prelude.rs # 常用导入
│   ├── printk.rs  # 内核打印
│   ├── spinlock.rs # 自旋锁
│   ├── mutex.rs   # 互斥锁
│   ├── error.rs   # 错误处理
│   ├── str.rs     # 字符串
│   ├── types.rs   # 类型转换
│   └── ...
├── bindings/      # 自动生成的 C 绑定
├── helpers/       # 内联汇编辅助函数
├── macros/        # 过程宏
└── samples/       # 示例代码
```

### 13.2 Rust 驱动示例

```rust
// rust_sample.rs
use kernel::prelude::*;
use kernel::module;

module! {
    type: RustSample,
    name: b"rust_sample",
    author: b"Your Name",
    description: b"A simple Rust kernel module",
    license: b"GPL",
}

struct RustSample;

impl kernel::Module for RustSample {
    fn init(_module: &'static ThisModule) -> Result<Self> {
        pr_info!("Hello from Rust!\n");
        Ok(RustSample)
    }
}

impl Drop for RustSample {
    fn drop(&mut self) {
        pr_info!("Goodbye from Rust!\n");
    }
}
```

**Rust 在内核中的优势**:
- 内存安全（无 use-after-free, 无 double-free）
- 类型安全
- 零成本抽象
- 更好的错误处理

**限制**:
- 仅支持特定架构（x86_64, ARM64, RISC-V）
- 需要特定 Rust 编译器版本
- 部分 C 宏无法直接翻译
- 生态系统尚在早期

---

## 14. 系统调用接口

### 14.1 x86_64 系统调用 (442 个)

```
# 常用系统调用 (arch/x86/entry/syscalls/syscall_64.tbl)

0   read              # fd, buf, count
1   write             # fd, buf, count
2   open              # pathname, flags, mode
3   close             # fd
4   stat              # pathname, statbuf
5   fstat             # fd, statbuf
9   mmap              # addr, len, prot, flags, fd, off
10  mprotect          # addr, len, prot
11  munmap            # addr, len
12  brk               # addr
16  ioctl             # fd, cmd, arg
21  access            # pathname, mode
22  pipe              # pipefd[2]
24  sched_yield
25  mremap
28  madvise
39  getpid
41  socket            # domain, type, protocol
42  connect           # sockfd, addr, addrlen
43  accept            # sockfd, addr, addrlen
44  sendto            # sockfd, buf, len, flags, addr, addrlen
45  recvfrom          # sockfd, buf, len, flags, addr, addrlen
49  bind              # sockfd, addr, addrlen
50  listen            # sockfd, backlog
56  clone             # flags, stack, ptid, ctid, tls
57  fork
59  execve            # filename, argv, envp
60  exit              # error_code
61  wait4             # pid, wstatus, options, rusage
62  kill              # pid, sig
63  uname             # buf

# 新增/现代系统调用
435 clone3            # 增强版 clone
436 openat2           # 增强版 openat
437 pidfd_getfd       # pidfd 操作
438 process_madvise   # 跨进程 madvise
439 epoll_pwait2      # 增强版 epoll
440 mount_setattr     # mount 属性
441 quotactl_fd       # 配额控制
442 landlock_create_ruleset  # Landlock 沙箱
```

### 14.2 系统调用实现路径

```
用户空间: syscall() 或 glibc 包装
   ↓
arch/x86/entry/entry_64.S  (或 arm64 等效)
   ↓
do_syscall_64() → sys_call_table[NR]  (arch/x86/entry/syscall_64.c)
   ↓
__x64_sys_xxx() 或 sys_xxx()  (kernel/ 或 fs/ 或 net/)
```

---

## 15. 内核开发注意事项

### 15.1 绝对禁止的操作

| ❌ 禁止 | 原因 | 后果 |
|---------|------|------|
| **浮点运算** | 保存/恢复 FPU 寄存器开销大 | 内核 panic/数据损坏 |
| **睡眠于原子上下文** | 中断/自旋锁下不可调度 | 死锁/系统挂起 |
| **访问用户空间指针不检查** | 用户可能传入无效地址 | 安全漏洞/Oops |
| **栈溢出** | 内核栈仅 8KB/16KB | 系统崩溃 |
| **忽略错误返回值** | 资源分配可能失败 | 空指针解引用 |
| **直接调用 printf()** | 用户空间函数不可用 | 编译失败 |
| **使用 C++** | 内核不支持 C++ | 编译失败 |
| **使用浮点库函数** | 没有 libm | 链接失败 |
| **持有锁时调用 schedule()** | 违反锁规则 | 死锁 |
| **RCU 读侧睡眠** | 宽限期无法结束 | 内存泄漏/数据损坏 |

### 15.2 内存管理黄金法则

```
┌─────────────────────────────────────────────────────────────────────┐
│                    内核内存管理铁律                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 1. 分配后必须检查返回值（GFP_ATOMIC 可能失败）                      │
│    p = kmalloc(size, GFP_KERNEL);                                   │
│    if (!p) return -ENOMEM;                                          │
│                                                                      │
│ 2.  kmalloc → kfree 必须成对                                        │
│    kzalloc → 无需初始化                                             │
│    devm_kzalloc → 自动释放（设备卸载时）                            │
│                                                                      │
│ 3.  GFP 标志选择:                                                   │
│    GFP_KERNEL     → 进程上下文，可睡眠（最常用）                     │
│    GFP_ATOMIC     → 中断/自旋锁上下文，不可睡眠（可能失败）          │
│    GFP_NOFS       → 文件系统上下文（防止递归）                       │
│    GFP_NOIO       → 块设备上下文（防止递归 I/O）                     │
│    GFP_USER       → 用户空间内存分配                                │
│    GFP_DMA/GFP_DMA32 → 限制 DMA 地址空间                            │
│                                                                      │
│ 4.  vmalloc → vfree (大块非连续内存)                                │
│     kmalloc → kfree (小对象，优先使用)                               │
│                                                                      │
│ 5.  使用 kmem_cache_* 频繁分配相同大小的对象                         │
│                                                                      │
│ 6.  使用 devm_* 函数自动管理设备相关内存                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.3 并发编程注意事项

```c
// ❌ 错误: 自旋锁中睡眠
spin_lock(&my_lock);
schedule();  // 死锁!
spin_unlock(&my_lock);

// ✅ 正确: 需要睡眠时用 mutex
mutex_lock(&my_mutex);
schedule();  // OK
mutex_unlock(&my_mutex);

// ❌ 错误: 中断上下文中使用 GFP_KERNEL
irq_handler() {
    p = kmalloc(100, GFP_KERNEL);  // 可能睡眠!
}

// ✅ 正确: 中断上下文用 GFP_ATOMIC
irq_handler() {
    p = kmalloc(100, GFP_ATOMIC);  // 不睡眠
}

// ❌ 错误: RCU 读侧睡眠
rcu_read_lock();
schedule();  // 数据损坏!
rcu_read_unlock();

// ✅ 正确: RCU 读侧快速完成
rcu_read_lock();
p = rcu_dereference(ptr);
// 只读访问，不睡眠
rcu_read_unlock();
```

### 15.4 用户空间指针访问

```c
// ❌ 错误: 直接访问用户指针
copy_from_user(kernel_buf, user_ptr, size);  // 不安全!

// ✅ 正确: 始终使用 copy_from_user/copy_to_user
if (copy_from_user(kernel_buf, user_ptr, size))
    return -EFAULT;

// ✅ 正确: 检查用户指针范围
if (!access_ok(user_ptr, size))
    return -EFAULT;

// 安全字符串拷贝
if (strncpy_from_user(kernel_str, user_str, max_len) < 0)
    return -EFAULT;
```

### 15.5 内核打印与调试

```c
// 级别: KERN_EMERG < KERN_ALERT < KERN_CRIT < KERN_ERR < KERN_WARNING < KERN_NOTICE < KERN_INFO < KERN_DEBUG

pr_err("Error: failed to allocate memory\n");
pr_warn("Warning: deprecated API used\n");
pr_info("Device %s initialized\n", dev_name);
pr_debug("Debug: value=%d\n", val);  // CONFIG_DYNAMIC_DEBUG 控制

// 驱动专用打印
dev_err(dev, "Error message\n");
dev_info(dev, "Info message\n");

// 格式化注意事项（用户可控数据需转义）
pr_info("User input: %s\n", user_input);  // ❌ 可能被利用
// 应使用 %pK 隐藏指针，%d 限制整数等
```

### 15.6 错误处理模式

```c
// 标准错误码 (include/uapi/asm-generic/errno-base.h)
#define EPERM        1   /* Operation not permitted */
#define ENOENT       2   /* No such file or directory */
#define ESRCH        3   /* No such process */
#define EINTR        4   /* Interrupted system call */
#define EIO          5   /* I/O error */
#define ENOMEM      12   /* Out of memory */
#define EACCES      13   /* Permission denied */
#define EFAULT      14   /* Bad address */
#define EBUSY       16   /* Device or resource busy */
#define EEXIST      17   /* File exists */
#define EINVAL      22   /* Invalid argument */
#define ENOSPC      28   /* No space left on device */
#define ENOSYS      38   /* Function not implemented */
#define EOPNOTSUPP  95   /* Operation not supported */

// 错误处理惯用法
static int my_function(void)
{
    void *p;
    int ret;
    
    p = kmalloc(100, GFP_KERNEL);
    if (!p)
        return -ENOMEM;
    
    ret = do_something();
    if (ret) {
        kfree(p);
        return ret;  // 透传错误码
    }
    
    kfree(p);
    return 0;
}
```

### 15.7 内核编码风格 (Coding Style)

```c
// Documentation/process/coding-style.rst

// 1. 缩进: Tab = 8 空格
int function(int x)
{
	if (x == 0) {
		return 0;
	}
	return x;
}

// 2. 行长: 80 列（宽松时 100）

// 3. 花括号: K&R 风格（函数换行，控制语句不换行）
void foo(void)
{
	if (condition) {
		do_something();
	} else {
		do_other();
	}
}

// 4. 命名: 局部变量短名，全局变量描述性
static int global_counter;

int calculate(int x, int y)
{
	int result = x + y;
	return result;
}

// 5. 注释: C89 风格 /* ... */
/*
 * This is a multi-line
 * comment.
 */

// 6. typedef 尽量少用（除非 opaque 类型）

// 7. 函数: 静态函数先声明后使用

// 8. goto: 仅用于错误清理
goto out_free;
```

---

## 16. 调试与性能分析工具

### 16.1 内核调试工具

| 工具 | 用途 | 用法 |
|------|------|------|
| **printk / pr_debug** | 打印调试 | `pr_info("value=%d\n", val)` |
| **dynamic debug** | 动态开关打印 | `echo 'file driver.c +p' > /sys/kernel/debug/dynamic_debug/control` |
| **ftrace** | 函数追踪 | `/sys/kernel/debug/tracing/` |
| **tracepoint** | 静态追踪点 | `trace-cmd start -e sched_switch` |
| **kprobe** | 动态探针 | `echo 'p:myprobe do_sys_open' > /sys/kernel/debug/kprobes` |
| **perf** | 性能计数器 | `perf top`, `perf record -g` |
| **eBPF/BCC** | 高级追踪 | `bpftrace -e 'kprobe:do_nanosleep { @[comm] = count(); }'` |
| **kgdb** | GDB 调试内核 | `gdb vmlinux` + 串口连接 |
| **kdb** | 内置调试器 | `SysRq+g` 或 `CONFIG_KDB` |
| **KASAN** | 内存错误检测 | `CONFIG_KASAN=y` |
| **KFENCE** | 内存错误检测（低开销） | `CONFIG_KFENCE=y` |
| **KCSAN** | 数据竞争检测 | `CONFIG_KCSAN=y` |
| **KUnit** | 单元测试框架 | `CONFIG_KUNIT=y` |
| **kmemleak** | 内存泄漏检测 | `CONFIG_DEBUG_KMEMLEAK=y` |
| **lockdep** | 死锁检测 | `CONFIG_LOCKDEP=y` |

### 16.2 ftrace 使用示例

```bash
# 启用函数追踪
cd /sys/kernel/debug/tracing
echo function > current_tracer
echo 1 > tracing_on

# 查看追踪结果
cat trace | head -100

# 过滤特定函数
echo do_nanosleep > set_ftrace_filter

# 查看函数图
echo function_graph > current_tracer
cat trace

# 使用 trace-cmd 工具
trace-cmd record -p function_graph -g do_sys_open sleep 1
trace-cmd report
```

### 16.3 perf 使用示例

```bash
# CPU 性能分析
perf top
perf record -g -- ./myapp
perf report

# 火焰图
perf record -F 99 -a -g -- sleep 30
perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > flame.svg

# 调度分析
perf sched record -- sleep 10
perf sched latency
perf sched map

# 内存分析
perf mem record ./myapp
perf mem report

# eBPF + perf: 统计系统调用
perf stat -e 'syscalls:sys_enter_*' sleep 5
```

### 16.4 BPF/BCC 追踪示例

```bash
# 使用 bpftrace
bpftrace -e 'kprobe:do_nanosleep { @[comm] = count(); }'

# 使用 BCC 工具
/usr/share/bcc/tools/opensnoop      # 跟踪文件打开
/usr/share/bcc/tools/execsnoop      # 跟踪进程执行
/usr/share/bcc/tools/biosnoop       # 跟踪块 I/O
/usr/share/bcc/tools/tcpconnect     # 跟踪 TCP 连接
/usr/share/bcc/tools/runqlat        # 调度延迟
/usr/share/bcc/tools/profile        # CPU 火焰图

# 使用 libbpf + bpftool
bpftool prog list
bpftool prog dump xlated id 123
bpftool map list
bpftool map dump id 456
```

---

## 17. 内核构建系统

### 17.1 Kbuild 架构

```
内核构建系统: Kbuild (Kconfig + Makefile)

关键文件:
├── Makefile              # 顶层 Makefile
├── Kbuild               # 顶层 Kbuild 规则
├── init/Kconfig         # 初始 Kconfig (2,298 行)
├── arch/*/Kconfig       # 架构配置
├── scripts/kconfig/     # Kconfig 解析器 (menuconfig)
├── scripts/Makefile.*   # 通用构建规则
└── .config              # 最终配置 (make 后生成)

配置系统:
Kconfig → menuconfig/xconfig/nconfig → .config → autoconf.h

构建目标:
  make menuconfig   # 图形化配置
  make oldconfig    # 基于旧配置更新
  make localmodconfig  # 仅编译已加载模块
  make -j$(nproc)   # 编译内核
  make modules      # 编译模块
  make modules_install  # 安装模块
  make install      # 安装内核
  make headers_install  # 安装头文件
```

### 17.2 配置选项统计

| 类别 | 选项数 | 说明 |
|------|--------|------|
| 通用设置 | ~200 | 版本、压缩、initrd |
| 处理器类型 | ~150 | x86/ARM64/RISC-V 等 |
| 电源管理 | ~100 | ACPI、睡眠、CPU 频率 |
| 总线 | ~50 | PCI、USB、PCIe |
| 网络 | ~800 | 协议、设备驱动、QoS |
| 设备驱动 | ~15,000 | 各类硬件驱动 |
| 文件系统 | ~300 | ext4/btrfs/nfs 等 |
| 安全 | ~200 | LSM、加密、完整性 |
| 虚拟化 | ~100 | KVM、Xen、VMware |
| 内核调试 | ~200 | KASAN、ftrace、lockdep |
| 总计 | ~**17,000+** | 全部 Kconfig 选项 |

### 17.3 模块开发模板

```c
// hello.c
#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/fs.h>

static int __init hello_init(void)
{
    pr_info("Hello, Kernel!\n");
    return 0;
}

static void __exit hello_exit(void)
{
    pr_info("Goodbye, Kernel!\n");
}

module_init(hello_init);
module_exit(hello_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Your Name");
MODULE_DESCRIPTION("A simple hello module");
MODULE_VERSION("1.0");
```

```makefile
# Makefile
obj-m += hello.o

KDIR ?= /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean
```

```bash
make
sudo insmod hello.ko
sudo rmmod hello
sudo dmesg | tail
```

---

## 18. 关键数据结构速查

### 18.1 核心链表操作

```c
#include <linux/list.h>

struct list_head {
    struct list_head *next, *prev;
};

struct my_struct {
    int data;
    struct list_head list;
};

// 初始化
LIST_HEAD(my_list);
struct my_struct item;
INIT_LIST_HEAD(&item.list);

// 添加
list_add(&item.list, &my_list);          // 头部插入
list_add_tail(&item.list, &my_list);     // 尾部插入

// 删除
list_del(&item.list);
list_del_init(&item.list);

// 遍历
struct my_struct *pos;
list_for_each_entry(pos, &my_list, list) {
    pr_info("data=%d\n", pos->data);
}

// 安全遍历（可删除）
list_for_each_entry_safe(pos, tmp, &my_list, list) {
    list_del(&pos->list);
    kfree(pos);
}
```

### 18.2 红黑树操作

```c
#include <linux/rbtree.h>

struct my_node {
    int key;
    struct rb_node node;
};

struct rb_root my_tree = RB_ROOT;

// 插入
struct rb_node **link = &my_tree.rb_node;
struct rb_node *parent = NULL;
while (*link) {
    parent = *link;
    struct my_node *entry = rb_entry(parent, struct my_node, node);
    if (new_node->key < entry->key)
        link = &parent->rb_left;
    else
        link = &parent->rb_right;
}
rb_link_node(&new_node->node, parent, link);
rb_insert_color(&new_node->node, &my_tree);

// 查找
struct my_node *search(int key)
{
    struct rb_node *node = my_tree.rb_node;
    while (node) {
        struct my_node *data = rb_entry(node, struct my_node, node);
        if (key < data->key)
            node = node->rb_left;
        else if (key > data->key)
            node = node->rb_right;
        else
            return data;
    }
    return NULL;
}

// 遍历
struct my_node *pos;
struct rb_node *node;
for (node = rb_first(&my_tree); node; node = rb_next(node)) {
    pos = rb_entry(node, struct my_node, node);
    pr_info("key=%d\n", pos->key);
}
```

### 18.3 常用 API 速查

| 功能 | API | 头文件 |
|------|-----|--------|
| 内存分配 | `kmalloc/kzalloc/kfree`, `vmalloc/vfree` | `linux/slab.h`, `linux/vmalloc.h` |
| 字符串 | `strcpy/strncpy`, `strcmp/strncmp`, `strlen`, `strcat` | `linux/string.h` |
| 位操作 | `set_bit/clear_bit/test_bit`, `bitmap_*` | `linux/bitops.h` |
| 时间 | `jiffies`, `ktime_get()`, `msleep()`, `udelay()` | `linux/jiffies.h`, `linux/ktime.h` |
| 工作队列 | `schedule_work()`, `queue_delayed_work()` | `linux/workqueue.h` |
| 定时器 | `timer_setup()`, `mod_timer()`, `del_timer_sync()` | `linux/timer.h` |
| 等待队列 | `wait_event()`, `wake_up()` | `linux/wait.h` |
| 完成量 | `init_completion()`, `wait_for_completion()`, `complete()` | `linux/completion.h` |
| 互斥 | `mutex_lock/unlock`, `spin_lock/unlock` | `linux/mutex.h`, `linux/spinlock.h` |
| RCU | `rcu_read_lock/unlock`, `rcu_dereference`, `synchronize_rcu` | `linux/rcupdate.h` |
| 引用计数 | `kref_init/get/put` | `linux/kref.h` |
| 原子操作 | `atomic_inc/dec/read/set` | `linux/atomic.h` |
| percpu | `alloc_percpu()`, `this_cpu_ptr()`, `get_cpu_var()` | `linux/percpu.h` |
| IO 端口 | `inb/outb`, `ioremap()`, `iounmap()` | `linux/io.h` |
| DMA | `dma_alloc_coherent()`, `dma_map_sg()` | `linux/dma-mapping.h` |
| 中断 | `request_irq()`, `free_irq()` | `linux/interrupt.h` |
| 设备注册 | `register_chrdev()`, `alloc_chrdev_region()` | `linux/fs.h` |
| sysfs | `class_create()`, `device_create()` | `linux/device.h` |
| 电源管理 | `pm_runtime_*` | `linux/pm_runtime.h` |
| CPU 热插拔 | `cpuhp_setup_state()` | `linux/cpuhotplug.h` |
| CPU 掩码 | `cpumask_*`, `num_online_cpus()` | `linux/cpumask.h` |
| NUMA | `numa_node_id()`, `node_to_cpumask()` | `linux/topology.h` |
| 固件 | `request_firmware()` | `linux/firmware.h` |
| 设备树 | `of_find_node_by_path()`, `of_property_read_u32()` | `linux/of.h` |
| 模块参数 | `module_param()`, `MODULE_PARM_DESC()` | `linux/moduleparam.h` |
| Kobject | `kobject_init_and_add()`, `sysfs_create_file()` | `linux/kobject.h` |
| debugfs | `debugfs_create_file()`, `debugfs_create_dir()` | `linux/debugfs.h` |
| seq_file | `seq_printf()`, `single_open()` | `linux/seq_file.h` |

---

## 附录：关键参考资源

| 资源 | URL | 说明 |
|------|-----|------|
| Linux Kernel Source | https://git.kernel.org | 官方源码 |
| LWN.net | https://lwn.net/Kernel/ | 内核新闻和分析 |
| Kernel Docs | https://docs.kernel.org/ | 官方文档 |
| Kernel Newbies | https://kernelnewbies.org | 入门指南 |
| eBPF Docs | https://docs.kernel.org/bpf/ | eBPF 文档 |
| Rust for Linux | https://rust-for-linux.com | Rust 内核开发 |
| Linux Cross Reference | https://elixir.bootlin.com/linux/latest/source | 在线代码浏览 |
| syzkaller | https://github.com/google/syzkaller | 内核模糊测试 |
| Kernel Selftests | `tools/testing/selftests/` | 内核自测套件 |
| KUnit | `kernel/kunit/` | 内核单元测试 |
| Checkpatch | `scripts/checkpatch.pl` | 代码风格检查 |
| Sparse | `scripts/coccinelle/` | 静态分析工具 |
| Coccinelle | `scripts/coccinelle/` | 语义补丁引擎 |

---

> **报告生成时间**: 2026-05-28  
> **内核源码版本**: Linux 7.1-rc5  
> **数据来源**: 直接分析 `code_analysis_suite/linux/` 目录源码 + 官方文档  
> **统计工具**: scc (Sloc Cloc and Code)
