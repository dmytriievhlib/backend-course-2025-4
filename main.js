// main.js
import { Command } from "commander";
import fs from "fs/promises";
import http from "http";
import { XMLBuilder } from "fast-xml-parser"; // ✅ оновлений імпорт

// === Налаштування командного рядка ===
const program = new Command();
program
  .requiredOption("-i, --input <path>", "шлях до вхідного JSON файлу")
  .requiredOption("-h, --host <host>", "адреса сервера")
  .requiredOption("-p, --port <port>", "порт сервера", parseInt);

program.parse(process.argv);
const options = program.opts();

// === Перевірка наявності файлу ===
try {
  await fs.access(options.input);
} catch {
  console.error("Cannot find input file");
  process.exit(1);
}

// === Ініціалізація XML Builder ===
const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: "  ",
});

// === Створення HTTP-сервера ===
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${options.host}:${options.port}`);
    const params = url.searchParams;

    // Асинхронне читання JSON з файлу
    const rawData = await fs.readFile(options.input, "utf-8");
    const lines = rawData.split("\n").filter((l) => l.trim() !== "");
    let flights = lines.map((line) => JSON.parse(line));

    // === Фільтрація за параметрами URL ===
    if (params.has("airtime_min")) {
      const min = parseInt(params.get("airtime_min"));
      flights = flights.filter((f) => f.AIR_TIME && Number(f.AIR_TIME) > min);
    }

    // === Формування структури для XML ===
    const xmlFlights = flights.slice(0, 100).map((f) => {
      const flight = {};
      if (params.get("date") === "true" && f.FL_DATE)
        flight.date = f.FL_DATE;
      flight.air_time = f.AIR_TIME ?? "";
      flight.distance = f.DISTANCE ?? "";
      return flight;
    });

    const xmlData = builder.build({ flights: { flight: xmlFlights } });

    // === Відправка XML-відповіді ===
    res.writeHead(200, { "Content-Type": "application/xml" });
    res.end(xmlData);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

// === Запуск сервера ===
server.listen(options.port, options.host, () => {
  console.log(`✅ Server running at http://${options.host}:${options.port}/`);
  console.log("Приклади запитів:");
  console.log(" - ?date=true");
  console.log(" - ?airtime_min=320");
  console.log(" - ?date=true&airtime_min=340");
});
