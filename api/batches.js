import crypto from 'crypto';

const TABLE = 'payment_batches';

function verifyToken(token) {
  try {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [encoded, signature] = parts;

    const expected = crypto
      .createHmac('sha256', process.env.AUTH_SECRET)
      .update(encoded)
      .digest('base64url');

    if (signature !== expected) return false;

    const data = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    );

    if (data.exp < Date.now()) return false;

    return data.username === process.env.ADMIN_USERNAME;
  } catch {
    return false;
  }
}

function isAdmin(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/admin_session=([^;]+)/);

  return verifyToken(
    match ? match[1] : null
  );
}

async function supabaseRequest(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    throw new Error(
      'Supabase environment variable belum lengkap.'
    );
  }

  const response = await fetch(
    `${base}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.hint ||
      data?.error ||
      'Supabase request gagal.'
    );
  }

  return data;
}

export default async function handler(req, res) {

  try {

    // CUSTOMER
    // Mengambil semua Payment Batch
    if (req.method === 'GET') {

      const rows = await supabaseRequest(
        `${TABLE}?select=id,service,batch,batch_photo,qris,customers,created_at&order=created_at.desc`,
        {
          method: 'GET'
        }
      );

      return res.status(200).json({
        batches: rows || []
      });
    }


    // ADMIN
    // Menyimpan Payment Batch
    if (req.method === 'POST') {

      if (!isAdmin(req)) {
        return res.status(401).json({
          error: 'Unauthorized. Silakan login sebagai admin.'
        });
      }

      let body = req.body;

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      if (
        !body?.id ||
        !body?.service ||
        !body?.batch
      ) {
        return res.status(400).json({
          error: 'Data batch belum lengkap.'
        });
      }

      const row = {
        id: Number(body.id),
        service: String(body.service),
        batch: String(body.batch),
        batch_photo: body.batchPhoto || '',
        qris: body.qris || '',
        customers: Array.isArray(body.customers)
          ? body.customers
          : [],
        created_at:
          body.createdAt ||
          new Date().toISOString()
      };

      await supabaseRequest(
        TABLE,
        {
          method: 'POST',

          headers: {
            Prefer:
              'resolution=merge-duplicates,return=minimal'
          },

          body: JSON.stringify(row)
        }
      );

      return res.status(200).json({
        success: true
      });
    }


    return res.status(405).json({
      error: 'Method not allowed'
    });

  } catch (error) {

    console.error(
      'BATCH API ERROR:',
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        'Terjadi kesalahan.'
    });
  }
}
