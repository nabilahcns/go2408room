import crypto from "crypto";

const TABLE = "payment_submissions";

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

function isAdmin(req) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/admin_session=([^;]+)/);

  return verifyToken(match ? match[1] : null);
}

async function supabase(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!base || !key) {
    throw new Error(
      "Supabase environment variable belum lengkap."
    );
  }

  const response = await fetch(
    `${base}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
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
      "Supabase request gagal."
    );
  }

  return data;
}

export default async function handler(req, res) {
  try {

    /*
     * CUSTOMER
     * Mengambil status pembayaran
     */
    if (req.method === "GET") {

      const batchId = req.query?.batch_id;
      const customerIndex = req.query?.customer_index;

      if (!batchId || customerIndex === undefined) {
        return res.status(400).json({
          error: "Batch ID dan customer index wajib diisi."
        });
      }

      const rows = await supabase(
        `${TABLE}?select=*&batch_id=eq.${encodeURIComponent(batchId)}&customer_index=eq.${encodeURIComponent(customerIndex)}&order=created_at.desc&limit=1`,
        {
          method: "GET"
        }
      );

      return res.status(200).json({
        payment: rows?.[0] || null
      });
    }


    /*
     * CUSTOMER
     * Upload / submit bukti pembayaran
     */
    if (req.method === "POST") {

      let body = req.body;

      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const {
        batch_id,
        customer_index,
        customer_name,
        amount,
        proof
      } = body || {};

      if (
        !batch_id ||
        customer_index === undefined ||
        !customer_name ||
        !proof
      ) {
        return res.status(400).json({
          error: "Data pembayaran belum lengkap."
        });
      }

      const row = {
        batch_id: Number(batch_id),
        customer_index: Number(customer_index),
        customer_name: String(customer_name),
        amount: Number(amount || 0),
        proof: String(proof),
        status: "pending",
        admin_note: "",
        created_at: new Date().toISOString(),
        verified_at: null
      };

      /*
       * Hapus submission pending sebelumnya
       * untuk customer yang sama
       */
      await supabase(
        `${TABLE}?batch_id=eq.${encodeURIComponent(batch_id)}&customer_index=eq.${encodeURIComponent(customer_index)}&status=eq.pending`,
        {
          method: "DELETE"
        }
      );

      await supabase(TABLE, {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify(row)
      });

      return res.status(200).json({
        success: true,
        status: "pending"
      });
    }


    /*
     * ADMIN
     * Mengambil semua pembayaran
     */
    if (req.method === "PUT") {

      if (!isAdmin(req)) {
        return res.status(401).json({
          error: "Unauthorized. Silakan login sebagai admin."
        });
      }

      let body = req.body;

      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const {
        id,
        status,
        admin_note
      } = body || {};

      if (!id || !status) {
        return res.status(400).json({
          error: "ID dan status wajib diisi."
        });
      }

      if (
        !["pending", "approved", "rejected"].includes(status)
      ) {
        return res.status(400).json({
          error: "Status pembayaran tidak valid."
        });
      }

      const updateData = {
        status,
        admin_note: admin_note || "",
        verified_at:
          status === "pending"
            ? null
            : new Date().toISOString()
      };

      await supabase(
        `${TABLE}?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=minimal"
          },
          body: JSON.stringify(updateData)
        }
      );

      return res.status(200).json({
        success: true,
        status
      });
    }


    /*
     * ADMIN
     * Melihat semua pembayaran
     */
    if (req.method === "PATCH") {

      if (!isAdmin(req)) {
        return res.status(401).json({
          error: "Unauthorized. Silakan login sebagai admin."
        });
      }

      const rows = await supabase(
        `${TABLE}?select=*&order=created_at.desc`,
        {
          method: "GET"
        }
      );

      return res.status(200).json({
        payments: rows || []
      });
    }


    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (error) {

    console.error(
      "PAYMENT PROOF API ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Terjadi kesalahan pada sistem pembayaran."
    });
  }
}
