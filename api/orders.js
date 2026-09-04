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

      if (row.some(x => String(x).trim() !== "")) {
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

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
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

    if (rows.length < 2) {
      return res.status(200).json({
        orders: []
      });
    }

    /*
      FORMAT SHEET KAMU:

      0 = NAMA
      1 = LIST BARANG
      2 = NEGARA
      3 = GRUP ORDER
      4 = KODE
      5 = UPDATE
      6 = PAYMENT (EMS /AC TAX)
      7 = TOTAL
      8 = PAYMENT DUE
      9 = DETAIL
    */

    const orders = rows
      .slice(1)
      .map(row => ({
        name: clean(row[0]),
        item: clean(row[1]),
        country: clean(row[2]),
        group: clean(row[3]),
        code: clean(row[4]),
        update: clean(row[5]),
        payment: clean(row[6]),
        total: clean(row[7]),
        paymentDue: clean(row[8]),
        detail: clean(row[9])
      }))
      .filter(order =>
        order.name ||
        order.item ||
        order.code
      );

    const search = req.query?.name;

    if (search) {
      const keyword = normalize(search);

      const results = orders.filter(order =>
        normalize(order.name).includes(keyword)
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
