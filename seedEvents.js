import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function seed() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "caresphere");
    const eventsCollection = db.collection("events");

    const filePath = path.join(__dirname, "data", "events.json");
    const rawData = fs.readFileSync(filePath, "utf-8");
    const events = JSON.parse(rawData);

    await eventsCollection.deleteMany({});
    const result = await eventsCollection.insertMany(events);

    console.log(`✅ Success: ${result.insertedCount} upcoming events seeded into MongoDB!`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await client.close();
  }
}

seed();