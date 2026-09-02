import crypto from "crypto";

function makeToken(username) {
  const data = JSON.stringify({
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000
  });

  const encoded = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.AUTH_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  try {
    const [encoded, signature] = token.split(".");

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

export default function handler(req, res) {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/admin_session=([^;]+)/);
  const token = match ? match[1] : null;

  // Check login
  if (req.method === "GET") {
    if (token && verifyToken(token)) {
      return res.status(200).json({ authenticated: true });
    }

    return res.status(401).json({ authenticated: false });
  }

  // Login
  if (req.method === "POST") {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const { username, password } = body || {};

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const newToken = makeToken(username);

    res.setHeader(
      "Set-Cookie",
      `admin_session=${newToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );

    return res.status(200).json({ authenticated: true });
  }

  // Logout
  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      "admin_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );

    return res.status(200).json({ loggedOut: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
