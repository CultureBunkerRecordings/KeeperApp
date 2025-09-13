// seedResources.js
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const OpenAI = require("openai");




// 🔑 Load environment variables (make sure OPENAI_API_KEY is set locally!)
require("dotenv").config();

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();


// OpenAI init
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to fetch books from Google Books API
async function fetchBooks(query, maxResults = 10) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
    query
  )}&maxResults=${maxResults}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items || [];
}

// Main seeding function
async function seedBooks() {
  try {
    const topics = ["javascript", "history", "philosophy", "psychology", "science"];
    let allBooks = [];

    // Fetch ~10 per topic
    for (const topic of topics) {
      console.log(`📚 Fetching books about ${topic}...`);
      const books = await fetchBooks(topic, 10);
      allBooks = allBooks.concat(books);
    }

    // Limit to 50
    allBooks = allBooks.slice(0, 50);

    for (const book of allBooks) {
      const info = book.volumeInfo;
      const title = info.title || "Untitled";
      const description = info.description || info.subtitle || title;
      const url = info.infoLink || "";

      // Create embedding
      console.log(`🧠 Embedding: ${title}`);
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: description,
      });

      const embedding = embeddingRes.data[0].embedding;

      // Store in Firestore
      await db.collection("resources").add({
        title,
        description,
        url,
        embedding,
      });
    }

    console.log("✅ Done! 50 books seeded into Firestore.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding books:", err);
    process.exit(1);
  }
}

seedBooks();
