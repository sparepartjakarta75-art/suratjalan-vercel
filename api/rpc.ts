/**
 * Vercel Serverless Function — endpoint RPC tunggal.
 * Semua panggilan client dipetakan ke POST /api/rpc.
 *
 * Handler dibuat anti-crash: setiap jalur (termasuk inisialisasi
 * Supabase & serialisasi respons) wajib membalas JSON. Body yang
 * bukan JSON ditegakkan lewat pre-serialisasi + send, sehingga
 * client tidak pernah menerima teks platform "A server error…".
 */
import { initSupabase } from '../server/sheets';
import { handleRpc, RpcError } from '../server/index';

type VercelReq = any;
type VercelRes = any;

function safeJson(res: VercelRes, status: number, obj: any): void {
  let body = '';
  try {
    body = JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch (e: any) {
    body = JSON.stringify({ error: 'Gagal membuat respons: ' + (e?.message || e) });
  }
  if (!res.headersSent) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
  }
  try {
    res.end(body);
  } catch {
    // abaikan — tidak ada respons lain yang bisa dikirim
  }
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      safeJson(res, 500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di environment.' });
      return;
    }

    try {
      initSupabase(url, key);
    } catch (e: any) {
      safeJson(res, 500, { error: 'Gagal inisialisasi Supabase: ' + (e?.message || e) });
      return;
    }

    if (req.method === 'GET') {
      safeJson(res, 200, { ok: true, service: 'suratjalan-vercel' });
      return;
    }

    if (req.method !== 'POST') {
      safeJson(res, 405, { error: 'Method tidak diizinkan.' });
      return;
    }

    let body: any = req.body;
    if (!body || typeof body !== 'object') {
      try {
        body = JSON.parse(req.body || '{}');
      } catch {
        safeJson(res, 400, { error: 'Body harus JSON.' });
        return;
      }
    }

    const fn: string = body.fn || '';
    const args: any[] = Array.isArray(body.args) ? body.args : [];
    const authHeader: string = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const result = await handleRpc(fn, args, token);
    safeJson(res, 200, { result });
  } catch (err: any) {
    const msg = err?.message || String(err) || 'Terjadi kesalahan.';
    const isAuth = err instanceof RpcError && /sesi|login/i.test(msg);
    safeJson(res, isAuth ? 401 : 400, { error: msg });
  }
}