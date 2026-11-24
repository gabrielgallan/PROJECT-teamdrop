const http = require('http');
const PORT = process.env.PORT || 4500;
const key = 'teamdrop-files:data';
const id = n => `019ab000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const author = { name: 'Pessoa da equipe', email: 'pessoa@example.test', avatarUrl: null };
const server = http.createServer(async (req, res) => {
  const chunks = [];
  const received = new Promise(resolve => { req.on('data', chunk => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks))); });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  let data = await pm.state.get(key);
  if (!data) {
    data = { counter: 13, files: Array.from({length:13}, (_, i) => ({ id:id(13-i), teamId:'team-a', name:`Arquivo ${13-i}.txt`, mimeType:'text/plain', size:7, createdAt:new Date(Date.UTC(2026,10,23,12,i)).toISOString(), author, content:Buffer.from('fixture').toString('base64') })) };
    await pm.state.set(key, data);
  }
  if (req.method === 'POST' && url.pathname === '/__test/reset') { await pm.state.set(key, null); return json(200, {}); }
  const team = /^\/api\/teams\/([^/]+)\/files$/.exec(url.pathname);
  if (team) {
    if (req.headers.authorization !== 'Bearer fixture-jwt') return json(401, {code:'INVALID_ACCESS_TOKEN'});
    if (req.method === 'GET') {
      const cursor = url.searchParams.get('cursor');
      const limit = Number(url.searchParams.get('limit') || 10);
      const files = data.files.filter(file => file.teamId === team[1] && (!cursor || file.id < cursor)).sort((a,b) => b.id.localeCompare(a.id));
      const page = files.slice(0, limit).map(({content, teamId, ...file}) => file);
      return json(200, {files:page, nextCursor:files.length > limit ? page.at(-1).id : null});
    }
    if (req.method === 'POST') {
      if (!String(req.headers['content-type']).startsWith('multipart/form-data; boundary=')) return json(400, {message:'multipart file required'});
      const body = await received;
      const text = body.toString('utf8');
      const name = /name="file"; filename="([^"]+)"/.exec(text)?.[1];
      const mimeType = /Content-Type: ([^\r\n]+)/i.exec(text)?.[1];
      if (!name || !text.includes('fixture upload')) return json(400, {message:'file field/content missing'});
      const file = {id:id(++data.counter), teamId:team[1], name, mimeType, size:14, createdAt:new Date().toISOString(), author, content:Buffer.from('fixture upload').toString('base64')};
      data.files.push(file); await pm.state.set(key, data);
      const {content, teamId, author:unused, ...publicFile} = file;
      return json(201, {file:publicFile});
    }
  }
  const publicFile = /^\/api\/files\/([^/]+)\/(url|download)$/.exec(url.pathname);
  if (publicFile && req.method === 'GET') {
    if (req.headers.authorization) return json(400, {message:'public file routes should not receive credentials'});
    const file = data.files.find(file => file.id === publicFile[1]);
    if (!file) return json(404, {message:'File not found'});
    if (publicFile[2] === 'url') return json(200, {url:`https://storage.example.test/${file.id}?expires=${Date.now()+300000}`});
    res.writeHead(302, {Location:`http://127.0.0.1:${PORT}/blob/${file.id}`}); return res.end();
  }
  if (req.method === 'GET' && url.pathname.startsWith('/blob/')) {
    const file = data.files.find(file => '/blob/'+file.id === url.pathname);
    if (!file) return json(404, {});
    res.writeHead(200, {'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.name}"`});
    return res.end(Buffer.from(file.content, 'base64'));
  }
  if (req.method === 'GET' && url.pathname === '/api/teams') return json(200, {teams:[{id:'team-a',name:'Equipe de produto',slug:'produto',role:'owner'},{id:'team-b',name:'Engenharia',slug:'engenharia',role:'member'}]});
  return json(501, {message:'Outside this simulation contract'});
});
server.listen(PORT);
