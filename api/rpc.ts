/**
 * Vercel Serverless Function — endpoint RPC tunggal.
 * Semua panggilan client dipetakan ke POST /api/rpc.
 */
import { initSupabase } from '../server/sheets';
import { handleRpc, RpcError } from '../server/index';

type VercelReq = any;
type VercelRes = any;

export default async function handler(req: VercelReq, res: VercelRes) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di environment.' });
    return;
  }
  initSupabase(url, key);

  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'suratjalan-vercel' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method tidak diizinkan.' });
    return;
  }

  let body: any = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = JSON.parse(req.body || '{}');
    } catch {
      res.status(400).json({ error: 'Body harus JSON.' });
      return;
    }
  }

  const fn: string = body.fn || '';
  const args: any[] = Array.isArray(body.args) ? body.args : [];
  const authHeader: string = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const result = await handleRpc(fn, args, token);
    res.status(200).json({ result });
  } catch (err: any) {
    const isAuth = err instanceof RpcError && /sesi|login/i.test(err.message || '');
    res.status(isAuth ? 401 : 400).json({ error: err?.message || 'Terjadi kesalahan.' });
  }
}