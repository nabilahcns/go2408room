const BUCKET = 'go2408room-files';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const path = req.query?.path;

    if (!path) {
      return res.status(400).json({
        error: 'Path file tidak ditemukan.'
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !secret) {
      return res.status(500).json({
        error: 'Supabase environment variable belum lengkap.'
      });
    }

    const endpoint =
      `${supabaseUrl}/storage/v1/object/sign/` +
      `${BUCKET}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: secret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expiresIn: 3600
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.message ||
          data.error ||
          'Gagal membuat signed URL.'
      });
    }

    const signed =
      data.signedURL ||
      data.signedUrl ||
      data.url;

    if (!signed) {
      return res.status(500).json({
        error: 'Signed URL tidak ditemukan.'
      });
    }

    const url = signed.startsWith('http')
      ? signed
      : `${supabaseUrl}/storage/v1${signed}`;

    return res.redirect(302, url);

  } catch (error) {
    console.error('FILE ERROR:', error);

    return res.status(500).json({
      error: error.message ||
        'Gagal membuka file.'
    });
  }
}
