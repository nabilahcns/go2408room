const GOOGLE_SHEET_ID =
  "1FTVHM7QCfFWOnMIbO56eEBOjpH3uSQBd";

const SHEET_GID =
  "734773841";


function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}


function clean(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .trim();
}


function normalizeName(name) {
  return clean(name)
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function parseCSV(csv) {

  const lines =
    csv
      .split("\n")
      .filter(line => line.trim() !== "");

  if (lines.length < 2) {
    return [];
  }

  const headers =
    parseCSVLine(lines[0])
      .map(clean);

  const rows = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {

    const values =
      parseCSVLine(lines[i]);

    const row = {};

    headers.forEach(
      (header, index) => {
        row[header] =
          clean(values[index]);
      }
    );

    rows.push(row);
  }

  return rows;
}


function rupiah(value) {

  const number =
    Number(
      String(value)
        .replace(/[^\d]/g, "")
    );

  if (!number) {
    return "Rp0";
  }

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);
}


export default async function handler(
  req,
  res
) {

  try {

    if (req.method !== "GET") {

      return res.status(405).json({
        error:
          "Method not allowed"
      });

    }


    const search =
      clean(
        req.query?.name || ""
      );


    /*
     * Google Sheets CSV endpoint
     */
    const url =
      `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;


    const response =
      await fetch(url);


    if (!response.ok) {

      throw new Error(
        "Google Sheets tidak bisa diakses."
      );

    }


    const csv =
      await response.text();


    const rows =
      parseCSV(csv);


    /*
     * Nama kolom sesuai Excel kamu
     */
    const nameColumn =
      "NAMA";

    const itemColumn =
      "LIST BARANG";

    const countryColumn =
      "NEGARA";

    const groupColumn =
      "GRUP ORDER";

    const codeColumn =
      "KODE";

    const updateColumn =
      "UPDATE PAYMENT\n(EMS /AC TAX)";

    const totalColumn =
      "TOTAL PAYMENT DUE";

    const detailColumn =
      "DETAIL";


    /*
     * Kalau nama kosong,
     * return semua data.
     *
     * Tapi untuk customer,
     * sebaiknya search nama.
     */
    let filtered = rows;


    if (search) {

      const keyword =
        normalizeName(search);

      filtered =
        rows.filter(row => {

          const name =
            normalizeName(
              row[nameColumn]
            );

          return (
            name.includes(keyword)
          );

        });

    }


    const result =
      filtered.map(
        (row, index) => ({

          id: index,

          name:
            row[nameColumn] || "",

          item:
            row[itemColumn] || "",

          country:
            row[countryColumn] || "",

          group:
            row[groupColumn] || "",

          code:
            row[codeColumn] || "",

          update:
            row[updateColumn] || "",

          total:
            row[totalColumn] || "0",

          totalFormatted:
            rupiah(
              row[totalColumn]
            ),

          detail:
            row[detailColumn] || ""

        })
      );


    return res.status(200).json({

      success: true,

      count:
        result.length,

      orders:
        result

    });


  } catch (error) {

    console.error(
      "ORDERS API ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Gagal membaca Google Sheets."

    });

  }

}
