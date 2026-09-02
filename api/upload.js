import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { filename, fileBase64, contentType } = req.body || {};

    if (!filename || !fileBase64) {
      return res.status(400).json({ error: "File tidak ditemukan" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const fileBuffer = Buffer.from(fileBase64, "base64");

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("go2408room-files")
      .upload(path, fileBuffer, {
        contentType: contentType || "application/octet-stream",
        upsert: false
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      path
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Upload gagal"
    });
  }
}
