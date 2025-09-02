const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());

// User-Agent验证中间件
const validateUserAgent = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent.toLowerCase().includes('ipmap')) {
    return res.status(403).send('Forbidden');
  }
  next();
};

// 验证IP地址格式
function isValidIP(ip) {
  const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 生成随机User-Agent
function generateRandomUserAgent() {
  const minMajor = 6033;
  const maxMajor = 7103;
  const randomMajor = Math.floor(Math.random() * (maxMajor - minMajor + 1)) + minMajor;
  const randomMinor = Math.floor(Math.random() * 100);
  const chromeVersion = `${randomMajor}.${randomMinor}`;
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.${chromeVersion} Safari/537.36`;
}

// 从HTML中提取威胁等级
function extractThreatLevel(htmlContent) {
  // 主要匹配模式
  const threatLevelRegex = /Estimated threat level for this IP address is\s*<span[^>]*class=['"][^'"]*badge-[^'"]*['"][^>]*>(.*?)<\/span>/i;
  const match = htmlContent.match(threatLevelRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // 备用匹配模式
  const alternativeRegex = /<span[^>]*class=['"][^'"]*badge-[^'"]*['"][^>]*>(Low|Medium|High|Very High|Critical)<\/span>/i;
  const alternativeMatch = htmlContent.match(alternativeRegex);
  
  if (alternativeMatch && alternativeMatch[1]) {
    return alternativeMatch[1].trim();
  }
  
  return null;
}

// 查询DB-IP威胁等级
async function queryDBIP(ip) {
  const userAgent = generateRandomUserAgent();
  const targetUrl = `https://db-ip.com/${ip}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Host': 'db-ip.com',
        'User-Agent': userAgent,
        'Referer': 'https://db-ip.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const htmlContent = await response.text();
    
    if (response.ok) {
      const threatLevel = extractThreatLevel(htmlContent);
      
      if (threatLevel) {
        return {
          success: true,
          threatLevel: threatLevel,
          userAgent: userAgent,
          status: response.status,
          url: targetUrl
        };
      } else {
        return {
          success: false,
          error: 'Threat level not found in response',
          userAgent: userAgent,
          status: response.status,
          url: targetUrl,
          content: htmlContent.substring(0, 1000)
        };
      }
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        userAgent: userAgent,
        status: response.status,
        url: targetUrl,
        content: htmlContent.substring(0, 1000)
      };
    }
    
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

function getFromCache(key) {
  const item = cache.get(key);
  if (item && Date.now() < item.expiry) {
    return item.data;
  }
  if (item) {
    cache.delete(key); // 清除过期数据
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, {
    data: data,
    expiry: Date.now() + CACHE_TTL
  });
}

// 路由定义
// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 主要的DB-IP查询端点
app.get('/', validateUserAgent, async (req, res) => {
  // 如果没有 db-ip 参数，显示服务信息
  const ipParam = req.query['db-ip'];
  if (!ipParam) {
    return res.json({
      service: 'DB-IP Threat Level Service',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      usage: 'GET /?db-ip=<IP_ADDRESS> with User-Agent containing "ipmap"'
    });
  }
  
  // 验证IP格式
  if (!isValidIP(ipParam)) {
    return res.status(400).json({
      input: ipParam,
      error: 'Invalid IP address format',
      message: 'Please provide a valid IPv4 or IPv6 address'
    });
  }
  
  try {
    // 检查缓存
    const cacheKey = `db-ip-${ipParam}`;
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return res.json({
        input: ipParam,
        data: cached.data,
        api_info: {
          source: 'replit-db-ip-service',
          user_agent: req.headers['user-agent'],
          cached: true,
          elapsed_ms: 0
        }
      });
    }
    
    // 查询DB-IP
    const startTime = Date.now();
    const result = await queryDBIP(ipParam);
    const elapsed = Date.now() - startTime;
    
    if (result.success) {
      const responseData = {
        threatLevel: result.threatLevel
      };
      
      // 缓存成功结果
      setCache(cacheKey, {
        data: responseData,
        timestamp: new Date().toISOString()
      });
      
      return res.json({
        input: ipParam,
        data: responseData,
        api_info: {
          source: 'replit-db-ip-service',
          user_agent: req.headers['user-agent'],
          cached: false,
          elapsed_ms: elapsed
        }
      });
    } else {
      return res.status(502).json({
        input: ipParam,
        error: result.error,
        message: 'Failed to extract threat level from DB-IP',
        debug_info: {
          user_agent: result.userAgent,
          response_status: result.status,
          url: result.url,
          response_preview: result.content ? result.content.substring(0, 200) + '...' : null
        }
      });
    }
    
  } catch (error) {
    console.error('DB-IP Service Error:', error);
    return res.status(500).json({
      input: ipParam,
      error: error.message,
      message: 'Internal server error'
    });
  }
});

// 缓存统计端点
app.get('/cache/stats', validateUserAgent, (req, res) => {
  res.json({
    cache_size: cache.size,
    cache_keys: Array.from(cache.keys()),
    ttl_minutes: CACHE_TTL / (60 * 1000)
  });
});

// 清除缓存端点
app.delete('/cache/clear', validateUserAgent, (req, res) => {
  const ip = req.query.ip;
  
  if (ip) {
    const key = `db-ip-${ip}`;
    const deleted = cache.delete(key);
    return res.json({
      message: deleted ? 'Cache cleared for IP' : 'IP not found in cache',
      ip: ip,
      deleted: deleted
    });
  } else {
    cache.clear();
    return res.json({
      message: 'All cache cleared',
      cleared_count: cache.size
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 DB-IP Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Usage: http://localhost:${PORT}/?db-ip=8.8.8.8`);
  console.log(`🔒 Remember: User-Agent must contain "ipmap" keyword`);
});

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now >= item.expiry) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = app;