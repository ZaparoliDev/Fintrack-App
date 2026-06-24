import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definida.');
export const signToken   = (p) => jwt.sign(p, SECRET, { expiresIn:'7d' });
export const verifyToken = (t) => jwt.verify(t, SECRET);
export function getUser(req) {
  const auth = req.headers['authorization']||'';
  if (!auth.startsWith('Bearer ')) return null;
  try { return verifyToken(auth.slice(7)); } catch { return null; }
}
export function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error:'Não autorizado.' }); return null; }
  return user;
}
