# scienceos

scienceos 是一个面向科研工作的本地 AI 工作台。用户可以围绕一个研究项目持续对话，并通过可切换的研究工作流组织研究问题、数学模型、理论推导、算法实现、实验、论文写作与模拟审稿。

应用运行在用户自己的电脑上，通过浏览器访问。登录、模型调用和余额查询统一使用 scienceos 账号体系，模型服务地址固定为 `https://claw.xiaohu.me/v1`，不需要用户手动填写 API 地址或令牌。

## 支持的平台

- macOS 12 或更高版本
- 常见 64 位 Linux 发行版
- Windows 10/11（PowerShell 5.1 或更高版本）

安装过程需要连接互联网，用于安装 Bun、项目依赖以及访问模型服务。建议至少准备 4 GB 可用磁盘空间和 8 GB 内存。

## macOS / Linux 安装

在项目根目录打开终端：

```bash
chmod +x install.sh start.sh
./install.sh
```

安装完成后启动：

```bash
./start.sh
```

程序会自动打开浏览器。若没有自动打开，请访问终端中显示的本地地址。

## Windows 安装

解压源码后，双击：

```text
install-windows.cmd
```

安装完成后双击：

```text
start-windows.cmd
```

也可以在 PowerShell 中运行：

```powershell
.\install.ps1
.\start.ps1
```

Windows 安装入口会临时放宽当前脚本的执行策略，不会永久修改系统的 PowerShell 策略。

## Bun 安装策略

安装脚本会按以下顺序寻找或安装 Bun：

1. 使用系统中已经安装的 Bun。
2. 如果电脑已安装 Node.js/npm，通过 npm 将 Bun 安装到项目的 `.runtime` 目录，避免依赖 GitHub 下载。
3. 电脑没有 npm 或 npm 安装失败时，使用 Bun 官方安装程序。

如果两种自动安装方式都失败，请先安装 [Bun](https://bun.sh/)，然后重新运行安装脚本。通过 npm 备用安装时，可以先根据所在网络环境配置 npm registry。

## 第一次使用

1. 启动 scienceos，进入独立登录页面。
2. 使用 scienceos 账号和密码登录。
3. 在首页创建项目，或选择已有研究目录。
4. 选择推荐领域包，也可以让系统生成领域包后继续修改。
5. 进入项目后，在“工作流”和“对话”视图之间切换。
6. 切换工作流节点时，当前节点对应的 Agent 和 Skill 会获得更高加载优先级。
7. 阶段成果经过人工检查后，点击“确认完成本阶段”。完成状态会保存在项目中。

## 典型科研流程

scienceos 不限定具体学科。对于运筹优化类研究，可以使用如下流程：

```text
研究方向与问题定义
→ 数学模型生成与校验
→ 数学理论推导与校验
→ 求解算法与代码实现
→ 数值实验与真实案例
→ 论文写作
→ 模拟审稿
→ 根据意见回到前序节点迭代
```

工作流用于组织研究过程，不能替代研究者的专业判断。特别是新理论、证明、模型假设和实验结论，应由研究者人工核验。

## 数据与账号

- 项目文件保存在用户选择的本地研究目录中。
- 登录会话、访问令牌和全局配置保存在当前系统用户的数据目录中，不写入项目源码。
- 密码只用于登录请求，不保存到项目文件。
- 本地服务仅监听 `127.0.0.1`，默认不向局域网公开。
- 退出登录会删除本机保存的 scienceos 登录状态和模型访问令牌。

请勿把 `.science`、`.runtime`、`node_modules`、`.env` 或用户配置目录放入源码分发包。

## 常用启动参数

指定端口：

```bash
./start.sh --port 4444
```

Windows：

```powershell
.\start.ps1 --port 4444
```

直接打开指定研究目录：

```bash
./start.sh /absolute/path/to/project
```

## 常见问题

### 下载 Bun 超时

安装脚本会优先尝试 npm 本地安装。如果电脑没有 npm，可以先安装 Node.js，或者手动安装 Bun 后重新运行脚本。

### 页面显示“Failed to fetch”

确认启动终端仍在运行，并使用终端输出的地址访问。不要关闭启动窗口。如果端口被占用，可以通过 `--port` 指定其他端口。

### 无法登录或读取余额

确认能够访问 `https://claw.xiaohu.me`。模型服务不可用时，本地项目和历史文件仍然保留，但登录和模型对话暂时不可用。

### 修改代码后页面没有更新

重新运行安装脚本生成最新前端资源，然后重启：

```bash
./install.sh
./start.sh
```

## 开发与测试

项目使用 Bun 管理依赖。

```bash
bun install --frozen-lockfile
bun run --cwd frontend/workspace build
cd backend/cli && bun test
```

前端源码位于 `frontend/workspace`，本地服务、Agent、Skill 和科研项目逻辑位于 `backend/cli`。

## 安全说明

scienceos 可以根据用户授权读取和修改项目文件，也可以运行研究代码。权限提示不是操作系统级安全沙箱。处理不可信代码或敏感数据时，建议在独立系统账号、虚拟机或容器中运行，并在执行前检查 Agent 提议的命令。

## 许可证

本项目基于 OpenScience 继续开发，遵循仓库中的 [Apache License 2.0](LICENSE) 及 [NOTICE](NOTICE)。
