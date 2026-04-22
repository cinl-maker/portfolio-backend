/**
 * 求职者个人空间 - Node.js 后端
 * Express + SQLite
 */

import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const DATABASE = process.env.DATABASE || join(__dirname, 'portfolio.db');
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = join(__dirname, 'uploads');

// 确保目录存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(join(UPLOAD_DIR, 'resumes'), { recursive: true });

// 初始化数据库
const db = new Database(DATABASE);
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY,
    name TEXT,
    title TEXT,
    bio TEXT,
    email TEXT,
    phone TEXT,
    github TEXT,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    tech_stack TEXT,
    github_url TEXT,
    demo_url TEXT,
    image TEXT,
    featured INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    file_path TEXT,
    file_type TEXT,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT,
    content TEXT,
    context_type TEXT,
    context_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_path TEXT,
    content TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    user_agent TEXT,
    page TEXT,
    referrer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// 初始化默认数据
const profileCount = db.prepare('SELECT COUNT(*) as c FROM profile').get();
if (profileCount.c === 0) {
  db.prepare(`INSERT INTO profile (id, name, title, bio, email, github) VALUES (1, ?, ?, ?, ?, ?)`).run(
    '张三', '全栈开发工程师', '热爱技术，专注于 Web 开发，喜欢用代码创造价值',
    'zhangsan@example.com', 'https://github.com/zhangsan'
  );
}

const skillsCount = db.prepare('SELECT COUNT(*) as c FROM skills').get();
if (skillsCount.c === 0) {
  const insertSkill = db.prepare('INSERT INTO skills (name, level, category) VALUES (?, ?, ?)');
  const skills = [
    ['Python', 90, 'backend'], ['JavaScript', 85, 'frontend'],
    ['React', 80, 'frontend'], ['Node.js', 85, 'backend'],
    ['PostgreSQL', 80, 'database'], ['Docker', 70, 'devops'],
    ['Git', 85, 'tools'], ['TypeScript', 75, 'frontend']
  ];
  skills.forEach(s => insertSkill.run(...s));
}

const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get();
if (projectCount.c === 0) {
  db.prepare(`INSERT INTO projects (title, description, tech_stack, github_url, featured) VALUES (?, ?, ?, ?, ?)`).run(
    '电商后台管理系统', '基于 React + Node.js 的企业级电商后台，支持商品管理、订单处理、数据分析',
    'React, Node.js, PostgreSQL, Redis', 'https://github.com/example/ecommerce-admin', 1
  );
}

// Express 应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/uploads', express.static(UPLOAD_DIR));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}.${ext}`);
  }
});
const upload = multer({ storage });

// ============ 个人信息 ============
app.get('/api/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  res.json(profile || {});
});

app.put('/api/profile', (req, res) => {
  const { name, title, bio, email, phone, github, avatar } = req.body;
  db.prepare(`UPDATE profile SET name=?, title=?, bio=?, email=?, phone=?, github=?, avatar=? WHERE id=1`)
    .run(name, title, bio, email, phone || '', github, avatar || '');
  res.json({ success: true });
});

// ============ 项目 ============
app.get('/api/projects', (req, res) => {
  const { featured } = req.query;
  let sql = 'SELECT * FROM projects ORDER BY created_at DESC';
  if (featured === 'true') sql = 'SELECT * FROM projects WHERE featured=1 ORDER BY created_at DESC';
  const projects = db.prepare(sql).all();
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const { title, description, tech_stack, github_url, demo_url, image, featured } = req.body;
  const result = db.prepare(
    'INSERT INTO projects (title, description, tech_stack, github_url, demo_url, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, description, tech_stack, github_url || '', demo_url || '', image || '', featured ? 1 : 0);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.put('/api/projects/:id', (req, res) => {
  const { title, description, tech_stack, github_url, demo_url, image, featured } = req.body;
  db.prepare(
    'UPDATE projects SET title=?, description=?, tech_stack=?, github_url=?, demo_url=?, image=?, featured=? WHERE id=?'
  ).run(title, description, tech_stack, github_url || '', demo_url || '', image || '', featured ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ 文档 ============
app.get('/api/documents', (req, res) => {
  const docs = db.prepare('SELECT id, title, file_type, summary, created_at FROM documents ORDER BY created_at DESC').all();
  res.json(docs);
});

app.get('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: '文档不存在' });
  res.json(doc);
});

app.post('/api/documents', upload.single('file'), (req, res) => {
  const { title, content } = req.body;
  let file_path = '', file_type = 'text';
  
  if (req.file) {
    file_path = `uploads/${req.file.filename}`;
    file_type = req.file.originalname.split('.').pop();
  }
  
  const result = db.prepare('INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)')
    .run(title, content || '', file_path, file_type);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT file_path FROM documents WHERE id=?').get(req.params.id);
  if (doc?.file_path) {
    try { fs.unlinkSync(doc.file_path); } catch {}
  }
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ 技能 ============
app.get('/api/skills', (req, res) => {
  const skills = db.prepare('SELECT * FROM skills ORDER BY category, level DESC').all();
  res.json(skills);
});

app.post('/api/skills', (req, res) => {
  const { name, level, category } = req.body;
  const result = db.prepare('INSERT INTO skills (name, level, category) VALUES (?, ?, ?)').run(name, level, category);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.delete('/api/skills/:id', (req, res) => {
  db.prepare('DELETE FROM skills WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ 简历 ============
app.get('/api/resumes', (req, res) => {
  const resumes = db.prepare('SELECT * FROM resumes ORDER BY created_at DESC').all();
  res.json(resumes);
});

app.get('/api/resumes/active', (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE is_active=1 ORDER BY created_at DESC LIMIT 1').get();
  res.json(resume || null);
});

app.post('/api/resumes', upload.single('file'), (req, res) => {
  const { title } = req.body;
  db.prepare('UPDATE resumes SET is_active=0').run();
  
  let file_path = '', content = '';
  if (req.file) {
    file_path = `uploads/${req.file.filename}`;
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    if (['md', 'txt'].includes(ext)) {
      content = fs.readFileSync(req.file.path, 'utf-8');
    }
  }
  
  const result = db.prepare('INSERT INTO resumes (title, file_path, content, is_active) VALUES (?, ?, ?, 1)')
    .run(title, file_path, content);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.put('/api/resumes/:id/activate', (req, res) => {
  db.prepare('UPDATE resumes SET is_active=0').run();
  db.prepare('UPDATE resumes SET is_active=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/resumes/:id', (req, res) => {
  const resume = db.prepare('SELECT file_path FROM resumes WHERE id=?').get(req.params.id);
  if (resume?.file_path) {
    try { fs.unlinkSync(resume.file_path); } catch {}
  }
  db.prepare('DELETE FROM resumes WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ============ 访客统计 ============
app.post('/api/visitors', (req, res) => {
  const { page, referrer } = req.body;
  db.prepare('INSERT INTO visitors (ip, user_agent, page, referrer) VALUES (?, ?, ?, ?)')
    .run(req.ip || '', req.get('user-agent') || '', page || '', referrer || '');
  res.json({ success: true });
});

app.get('/api/visitors/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
  const today = db.prepare("SELECT COUNT(*) as c FROM visitors WHERE DATE(created_at) = DATE('now')").get().c;
  const thisWeek = db.prepare("SELECT COUNT(*) as c FROM visitors WHERE created_at >= DATE('now', '-7 days')").get().c;
  const popularPages = db.prepare('SELECT page, COUNT(*) as count FROM visitors GROUP BY page ORDER BY count DESC LIMIT 5').all();
  res.json({ total, today, this_week: thisWeek, popular_pages: popularPages });
});

// ============ AI 对话 (模拟) ============
app.post('/api/chat', (req, res) => {
  const { message, context_type, context_id } = req.body;
  
  // 保存用户消息
  db.prepare('INSERT INTO conversations (role, content, context_type, context_id) VALUES (?, ?, ?, ?)')
    .run('user', message, context_type, context_id);
  
  let contextText = '';
  if (context_type === 'project' && context_id) {
    const project = db.prepare('SELECT * FROM projects WHERE id=?').get(context_id);
    if (project) {
      contextText = `项目信息：\n标题: ${project.title}\n描述: ${project.description}\n技术栈: ${project.tech_stack}`;
    }
  } else if (context_type === 'document' && context_id) {
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(context_id);
    if (doc) {
      contextText = `文档信息：\n标题: ${doc.title}\n内容: ${doc.content}`;
    }
  }
  
  // 模拟 AI 回复
  let response = `您好！我是您的 AI 助手。\n\n我可以帮您：\n- 📝 总结项目经历\n- 📄 分析文档内容\n- 💡 提供技术建议\n\n请问有什么可以帮您的？`;
  
  if (message.includes('总结') || message.includes('summarize')) {
    if (contextText) {
      response = `好的，我来为您总结：\n\n${contextText}\n\n📌 **关键亮点**:\n- 项目采用主流技术栈\n- 代码结构清晰，易于维护\n- 具有良好的扩展性\n\n💡 **建议**: 可以补充具体的性能指标和用户反馈数据。`;
    } else {
      response = '请先选择一个项目或文档，然后我才能帮您进行总结分析。';
    }
  } else if (message.includes('技术')) {
    if (contextText) {
      response = `根据项目信息，技术栈分析如下：\n\n${contextText}\n\n🔧 **技术建议**: 整体技术选型合理，可以考虑引入微服务架构提升系统灵活性。`;
    } else {
      response = '我可以帮您分析技术栈，请先选择一个项目。';
    }
  }
  
  db.prepare('INSERT INTO conversations (role, content, context_type, context_id) VALUES (?, ?, ?, ?)')
    .run('assistant', response, context_type, context_id);
  
  res.json({ response, success: true });
});

app.get('/api/conversations', (req, res) => {
  const { context_type, context_id } = req.query;
  let rows;
  if (context_type && context_id) {
    rows = db.prepare('SELECT * FROM conversations WHERE context_type=? AND context_id=? ORDER BY created_at ASC')
      .all(context_type, context_id);
  } else {
    rows = db.prepare('SELECT * FROM conversations ORDER BY created_at DESC LIMIT 50').all();
  }
  res.json(rows);
});

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动 - 监听所有网络接口
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API: http://0.0.0.0:${PORT}/api`);
});
