const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1FTVHM7QCfFWOnMIbO56eEBOjpH3uSQBd/export?format=csv&gid=734773841";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;

      row.push(cell);
      cell = "";

      if (row.some(x => x.trim() !== "")) {
        rows.push(row);
      }

      row = [];
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function cleanHeader(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export default async function handler(req, res) {
  try {
    const response = await fetch(SHEET_URL);

    if (!response.ok) {
      return res.status(500).json({
        error: "Google Sheets tidak bisa dibaca."
      });
    }

    const csv = await response.text();
    const rows = parseCSV(csv);

    if (!rows.length) {
      return res.status(200).json({
        orders: []
      });
    }

    // Header Google Sheet
    const headers = rows[0].map(header => String(header || "").trim());

    // Buat mapping nama header
    const headerMap = {};

    headers.forEach((header, index) => {
      headerMap[cleanHeader(header)] = index;
    });

    // Cari kolom berdasarkan nama
    const nameIndex = headerMap["nama"];

    const itemIndex = headerMap["list barang"];

    const countryIndex = headerMap["negara"];

    const groupIndex = headerMap["grup order"];

    const codeIndex = headerMap["kode"];

    const paymentIndex = headers.findIndex(header =>
      cleanHeader(header).includes("update payment")
    );

    const totalIndex = headerMap["total payment due"];

    const detailIndex = headerMap["detail"];

    const orders = rows.slice(1).map(row => ({
      name:
        nameIndex !== undefined
          ? String(row[nameIndex] || "").trim()
          : "",

      item:
        itemIndex !== undefined
          ? String(row[itemIndex] || "").trim()
          : "",

      country:
        countryIndex !== undefined
          ? String(row[countryIndex] || "").trim()
          : "",

      group:
        groupIndex !== undefined
          ? String(row[groupIndex] || "").trim()
          : "",

      code:
        codeIndex !== undefined
          ? String(row[codeIndex] || "").trim()
          : "",

      update:
        paymentIndex !== -1
          ? String(row[paymentIndex] || "").trim()
          : "",

      total:
        totalIndex !== undefined
          ? String(row[totalIndex] || "").trim()
          : "",

      detail:
        detailIndex !== undefined
          ? String(row[detailIndex] || "").trim()
          : ""
    }));

    // Kalau ada pencarian nama
    const search = req.query?.name;

    if (search) {
      const keyword = String(search)
        .trim()
        .toLowerCase();

      const results = orders.filter(order =>
        order.name
          .toLowerCase()
          .includes(keyword)
      );

      return res.status(200).json({
        orders: results
      });
    }

    return res.status(200).json({
      orders
    });

  } catch (error) {
    console.error("ORDERS API ERROR:", error);

    return res.status(500).json({
      error: error.message || "Terjadi kesalahan."
    });
  }
}
