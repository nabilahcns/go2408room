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

function normalize(value) {
  return String(value || "")
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

    const headers = rows[0].map(h =>
      String(h)
        .replace(/\r/g, "")
        .replace(/\n/g, " ")
        .trim()
    );

    const data = rows.slice(1).map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });

      return obj;
    });

    const nameColumn = headers.find(
      h => normalize(h) === "nama"
    );

    const itemColumn = headers.find(
      h => normalize(h) === "list barang"
    );

    const countryColumn = headers.find(
      h => normalize(h) === "negara"
    );

    const groupColumn = headers.find(
      h => normalize(h) === "grup order"
    );

    const codeColumn = headers.find(
      h => normalize(h) === "kode"
    );

    const paymentColumn = headers.find(
      h =>
        normalize(h).includes("update payment") &&
        normalize(h).includes("ems")
    );

    const totalColumn = headers.find(
      h => normalize(h) === "total payment due"
    );

    const detailColumn = headers.find(
      h => normalize(h) === "detail"
    );

    const orders = data.map(row => ({
      name: nameColumn ? row[nameColumn] : "",
      item: itemColumn ? row[itemColumn] : "",
      country: countryColumn ? row[countryColumn] : "",
      group: groupColumn ? row[groupColumn] : "",
      code: codeColumn ? row[codeColumn] : "",
      update: paymentColumn ? row[paymentColumn] : "",
      total: totalColumn ? row[totalColumn] : "",
      detail: detailColumn ? row[detailColumn] : ""
    }));

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
    console.error(error);

    return res.status(500).json({
      error: error.message || "Terjadi kesalahan."
    });
  }
}
