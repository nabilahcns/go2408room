const crypto = require('crypto');

function sign(value) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
function cookieToken(username) {
  const payload = Buffer.from(JSON.stringify({u: username, exp: Date.now()+1000*60*60*12})).toString('base64url');
  return payload + '.' + sign(payload);
}
function validToken(token) {
  try {
    if (!token) return false;
    const [payload, sig] = token.split('.');
    if (!payload || !sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return false;
    const data = JSON.parse(Buffer.from(payload,'base64url').toString());
    return data.exp > Date.now() && data.u === process.env.ADMIN_USERNAME;
  } catch { return false; }
}
function getCookie(req,name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return match ? decodeURIComponent(match.slice(name.length+1)) : null;
}
module.exports = (req,res) => {
  if (req.method === 'GET') {
    return validToken(getCookie(req,'go2408_admin')) ? res.status(200).json({ok:true}) : res.status(401).json({ok:false});
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie','go2408_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ok:true});
  }
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const ok = body && body.username === process.env.ADMIN_USERNAME && body.password === process.env.ADMIN_PASSWORD;
    if (!ok) return res.status(401).json({ok:false});
    res.setHeader('Set-Cookie', `go2408_admin=${encodeURIComponent(cookieToken(body.username))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
    return res.status(200).json({ok:true});
  }
  return res.status(405).end();
};
