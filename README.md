# Replit DB-IP 威胁等级服务

这是一个运行在 Replit 平台上的 Express.js 服务，用于替代 Cloudflare Workers 的 DB-IP Worker 功能。

## 功能特性

- 🚀 **高性能**: Express.js + Node.js 运行时
- 🔒 **访问控制**: User-Agent 必须包含 "ipmap" 关键字
- ⚡ **内存缓存**: 30分钟 TTL 的查询结果缓存
- 🔄 **无限制访问**: 支持高频率请求，利用IP变化避免限制
- 🎯 **智能解析**: 从 DB-IP.com 提取威胁等级信息
- 📊 **监控统计**: 缓存统计和健康检查端点

## 部署到 Replit

### 1. 创建 Replit 项目

1. 访问 [Replit.com](https://replit.com)
2. 点击 "Create Repl"
3. 选择 "Node.js" 模板
4. 项目名称: `db-ip-threat-service`
5. 将此目录的所有文件上传到 Replit 项目中

### 2. 安装依赖

在 Replit Shell 中运行：
```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

### 4. 部署公开访问

1. 在 Replit 项目中点击 "Run" 按钮
2. 服务将自动获得一个公开URL，格式类似：
   `https://db-ip-threat-service.your-username.repl.co`

## API 接口

### 1. 主要查询接口

**GET** `/?db-ip={IP地址}`

**必须的请求头:**
```
User-Agent: 包含 "ipmap" 关键字的任意字符串
```

**示例请求:**
```bash
curl -H "User-Agent: ipmap-client/1.0" \
  "https://your-replit-url.repl.co/?db-ip=8.8.8.8"
```

**响应示例:**
```json
{
  "input": "8.8.8.8",
  "data": {
    "threatLevel": "Low"
  },
  "api_info": {
    "source": "replit-db-ip-service",
    "user_agent": "ipmap-client/1.0",
    "cached": false,
    "elapsed_ms": 1245
  }
}
```

### 2. 健康检查

**GET** `/health`

```bash
curl "https://your-replit-url.repl.co/health"
```

### 3. 缓存统计

**GET** `/cache/stats`

```bash
curl -H "User-Agent: ipmap-admin/1.0" \
  "https://your-replit-url.repl.co/cache/stats"
```

### 4. 清除缓存

**DELETE** `/cache/clear?ip={IP地址}`

```bash
# 清除特定IP的缓存
curl -X DELETE -H "User-Agent: ipmap-admin/1.0" \
  "https://your-replit-url.repl.co/cache/clear?ip=8.8.8.8"

# 清除所有缓存
curl -X DELETE -H "User-Agent: ipmap-admin/1.0" \
  "https://your-replit-url.repl.co/cache/clear"
```

## 集成到现有系统

### 更新 test-all-workers.sh

在测试脚本中添加 Replit 服务：

```bash
# 替换原来的 db-ip-worker 测试
echo "📡 测试 Replit DB-IP Service ... "
REPLIT_URL="https://your-replit-url.repl.co"
response=$(curl -s -w "%{http_code}" -H "User-Agent: $USER_AGENT" -o /tmp/replit_response "$REPLIT_URL?db-ip=$TEST_IP")
```

### 更新客户端代码

在您的客户端应用中，将 DB-IP Worker URL 替换为 Replit 服务 URL：

```javascript
// 原来的 Cloudflare Worker
const oldUrl = "https://db-ip-worker.live20450000.workers.dev?db-ip=";

// 新的 Replit 服务
const newUrl = "https://your-replit-url.repl.co/?db-ip=";
```

## 优势对比

| 特性 | Cloudflare Workers | Replit 服务 |
|------|-------------------|-------------|
| **IP限制问题** | ❌ 被DB-IP.com限制 | ✅ IP定期变化，自动绕过限制 |
| **部署成本** | 免费 | 免费 |
| **全球分布** | ✅ 边缘网络 | ❌ 单一区域 |
| **冷启动** | < 100ms | ~500ms |
| **维护成本** | 低 | 低 |
| **缓存机制** | KV存储 | 内存缓存 |
| **监控能力** | 基本 | 详细 |

## 监控和维护

### 1. 日志查看

在 Replit Console 中查看实时日志：
- 请求日志
- 错误信息
- 缓存统计

### 2. 性能优化

- **缓存TTL调整**: 修改 `CACHE_TTL` 常量
- **并发控制**: Node.js 自动处理并发请求
- **IP轮换优势**: 每次重启获得新IP，避免访问限制

### 3. 故障排除

常见问题和解决方案：

1. **服务无响应**
   - 检查 Replit 项目是否正在运行
   - 查看 Console 中的错误日志

2. **429 错误仍然出现**
   - 可能是 DB-IP.com 对新IP的临时限制
   - 等待一段时间后重试

3. **缓存问题**
   - 使用 `/cache/clear` 接口清除缓存
   - 检查内存使用情况

## 安全注意事项

- ✅ User-Agent 验证已启用
- ✅ CORS 已启用
- ✅ 输入验证已实现
- 🔄 IP定期变化，自然防护DDoS
- ⚠️ 建议添加API密钥认证（可选）

---

## 部署步骤总结

1. **创建 Replit 项目** - 选择 Node.js 模板
2. **上传项目文件** - 将所有文件复制到项目中
3. **安装依赖** - 运行 `npm install`
4. **启动服务** - 点击 "Run" 按钮
5. **获取URL** - 复制生成的公开访问URL
6. **更新配置** - 在其他服务中替换DB-IP Worker URL
7. **测试验证** - 使用正确的User-Agent进行测试

完成后，您将拥有一个稳定、高性能的 DB-IP 威胁等级查询服务，完全绕过 Cloudflare Workers 的IP限制问题！