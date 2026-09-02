import crypto from "crypto";

const BUCKET = "go2408room-files";

function verifyToken(token) {
  try {
    if (!token) return false;

    const parts = token.split(".");

    if (parts.length !== 2) return false;

    const [encoded, signature] = parts;

    const expected = crypto
      .createHmac("sha256", process.env.AUTH_SECRET)
      .update(encoded)
      .digest("base64url");

    if (signature !== expected) return false;

    const data = JSON.parse(
      Buffer.from(encoded, "base64url").toString()
    );

    if (data.exp < Date.now()) return false;

    return data.username === process.env.ADMIN_USERNAME;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // =========================
  // CHECK ADMIN LOGIN
  // =========================

  const cookies = req.headers.cookie || "";
  const match = cookies.match(/admin_session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!verifyToken(token)) {
    return res.status(401).json({
      error: "Unauthorized. Silakan login sebagai admin."
    });
  }

  try {
    const { filename } = req.body || {};

    if (!filename) {
      return res.status(400).json({
        error: "Nama file tidak ditemukan."
      });
    }

    // =========================
    // CLEAN FILE NAME
    // =========================

    const safeName = filename
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const path = `${Date.now()}-${safeName}`;

    // =========================
    // CREATE SIGNED UPLOAD URL
    // =========================

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecret) {
      return res.status(500).json({
        error: "Supabase environment variable belum lengkap."
      });
    }

    const endpoint =
      `${supabaseUrl}/storage/v1/object/upload/sign/` +
      `${BUCKET}/${encodeURIComponent(path)}`;

    const response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${supabaseSecret}`,
        "apikey": supabaseSecret,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        upsert: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || data.error || "Gagal membuat upload URL."
      });
    }

    // =========================
    // RETURN SIGNED URL
    // =========================

    const signedUrl = data.signedUrl
      ? data.signedUrl
      : `${supabaseUrl}/storage/v1${data.url}`;

    return res.status(200).json({
      success: true,
      path,
      signedUrl
    });

  } catch (error) {
    console.error("UPLOAD ERROR:", error);

    return res.status(500).json({
      error: error.message || "Upload gagal."
    });
  }
}
