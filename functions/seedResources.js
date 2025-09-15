// seedResources.js
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const OpenAI = require("openai");
require("dotenv").config();

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to fetch up to maxResults books with pagination
async function fetchBooks(query, maxResults = 100) {
  let allItems = [];
  let startIndex = 0;

  while (allItems.length < maxResults) {
    const batchSize = Math.min(40, maxResults - allItems.length);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      query
    )}&maxResults=${batchSize}&startIndex=${startIndex}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    allItems = allItems.concat(data.items);
    startIndex += data.items.length;
  }

  return allItems;
}

// Seed books into Firestore
async function seedBooks() {
  try {
    const topics = [
      "art",
      "history",
      "philosophy",
      "wildlife",
      "science",
      "food",
      "humanities",
      "pop culture",
      "music",
      "biography",
    ];

    let allBooks = [];

    // Fetch books per topic
    for (const topic of topics) {
      console.log(`📚 Fetching books about ${topic}...`);
      const books = await fetchBooks(topic, 100);
      allBooks = allBooks.concat(books);
    }

    // Limit to 1000 books total
    allBooks = allBooks.slice(0, 1000);
    console.log(`Fetched ${allBooks.length} books total.`);

    // Batch insertion & embedding
    const BATCH_SIZE = 10;
    for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
      const batch = allBooks.slice(i, i + BATCH_SIZE).map(async (book) => {
        const info = book.volumeInfo || {};
        const title = info.title || "Untitled";
        const description = info.description || info.subtitle || title;
        const url = info.infoLink || "";

        // Create embedding
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: `${title}. ${description}`,
        });
        const embedding = embeddingRes.data[0].embedding;

        // Store in Firestore
        return db.collection("resources").add({
          title,
          description,
          url,
          embedding,
        });
      });

      await Promise.all(batch);
      console.log(`✅ Seeded books ${i + 1} to ${Math.min(i + BATCH_SIZE, allBooks.length)}`);
    }

    console.log("🎉 All books seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding books:", err);
    process.exit(1);
  }
}

seedBooks();
