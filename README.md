# CampusTrace 🎒

专为校园场景打造的现代化全栈失物招领 Web 应用。基于 **MERN** 技术栈（MongoDB、Express、React、Node.js），连接丢失物品的同学与拾得者 / 管理员，完成从上报、认领到归还的全流程闭环。

---

## ✨ 核心特性

### 学生端
* **上报失物**：提交物品类别、描述、最后出现地点、日期，并支持图片上传。
* **上报拾物**：分享校园内拾得物品信息，帮助物归原主。
* **认领管理**：提交认领申请，附带归属证明与学号核验。
* **个人看板**：集中追踪我的失物、拾物与认领请求。

### 管理端
* **认领审核**：批准、驳回或标记为已归还。
* **运营指标**：实时统计失物报告、进行中认领、已解决事项等。
* **用户管理**：监控校园用户并执行角色与安全策略。

### 体验与设计
* **玻璃拟态 UI**：Outfit 字体、自定义滚动条与动态模糊背景。
* **双主题**：明 / 暗模式一键切换。
* **关于页**：展示应用信息与开发者主页入口。

---

## 🛠️ 技术栈

* **前端**：React (Vite)、React Router v7、Context API（Auth / Theme）、Vanilla CSS
* **后端**：Node.js、Express、MongoDB、Mongoose
* **文件上传**：Multer + 本地磁盘（Docker 默认）/ Cloudinary（可选）
* **安全鉴权**：JWT、角色中间件（`protect` / `isAdmin`）、bcrypt 密码哈希

---

## 📂 项目结构

```text
CampusTrace/
├── client/                 # React SPA (Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── index.css
├── config/                 # 环境校验与数据库连接
├── controllers/            # 业务处理
├── middleware/             # 鉴权与上传
├── models/                 # Mongoose 模型
├── routes/                 # API 路由
├── scripts/                # 启动种子脚本（管理员账号）
├── server.js               # Express 入口
├── Dockerfile              # 多阶段构建（前端打包 + Node 运行）
├── docker-compose.yml      # App + MongoDB 编排
└── package.json
```

---

## 🚀 启动指引（推荐：Docker Desktop 一键启动）

项目已完整容器化。请确保本机已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

### 1. 本地执行编排构建
```bash
# 1. 切换至项目根目录
cd CampusTrace

# 2. 一键编译与拉起服务（后台常驻）
docker-compose up -d --build
```

首次构建会安装依赖、打包前端，并启动 MongoDB 与应用容器，通常需要数分钟。

### 2. 访问应用
构建完成后，直接打开浏览器访问系统主页面：

👉 [http://localhost:731](http://localhost:731)

### 3. 可用的测试凭证
容器启动时会自动注入以下管理员账号（可通过注册面板自行创建学生账号）：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| **管理员** | `admin@campustrace.local` | `123456` |

### 常用运维命令
```bash
# 查看运行状态
docker-compose ps

# 查看应用日志
docker-compose logs -f app

# 停止并移除容器（数据卷保留）
docker-compose down

# 停止并清除数据卷（重置数据库与上传文件）
docker-compose down -v
```

> Docker 模式下默认使用 **本地磁盘** 存储上传图片（`STORAGE_MODE=local`），无需 Cloudinary 账号即可完整体验上传流程。

---

## 💻 本地开发（可选）

若希望在本机直接跑前后端（不使用 Docker）：

### Prerequisites
* [Node.js](https://nodejs.org/)（建议 v18+）
* [MongoDB](https://www.mongodb.com/)（本地或 Atlas）
* （可选）[Cloudinary](https://cloudinary.com/) 账号；若设置 `STORAGE_MODE=local` 则可跳过

### 1. 后端
```bash
npm install
```

复制 `.env.example` 为 `.env` 并填写配置：
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/campustrace
JWT_SECRET=your_jwt_secret_here
STORAGE_MODE=local
CLIENT_URL=http://localhost:5173
```

```bash
npm run dev
```
后端默认运行在 `http://localhost:5000`。

### 2. 前端
```bash
cd client
npm install
npm run dev
```
前端默认运行在 `http://localhost:5173`（已代理 `/api` 到后端）。

---

## 📄 License

本项目基于 **MIT License**。

Copyright (c) 2026 Isula Mihisara (MihisaraNet). All rights reserved.
