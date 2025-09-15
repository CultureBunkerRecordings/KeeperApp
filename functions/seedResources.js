// seedResources.js
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const OpenAI = require("openai");
require("dotenv").config();

const serviceAccount = require("./serviceAccountKey.json");

console.log("🟢 Running the updated seedResources.js");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function clearResources() {
  const collectionRef = db.collection("resources");
  const batchSize = 50; // reduce from 500 to avoid "Transaction too big"

  async function deleteBatch() {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      return false; // done
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`🗑️ Deleted ${snapshot.size} documents...`);
    return true;
  }

  let rounds = 0;
  while (await deleteBatch()) {
    rounds++;
    console.log(`Round ${rounds} of deletes complete.`);
  }

  console.log("✅ All documents in 'resources' collection deleted.");
}

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

// Seed books into Firestore with tags
async function seedBooks() {
  try {

    await clearResources(); // 🔥 wipe before seeding
    console.log("Seeding new resources...");

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

    let bookMap = new Map();

    // Fetch books per topic
    for (const topic of topics) {
      console.log(`📚 Fetching books about ${topic}...`);
      const books = await fetchBooks(topic, 100);

      for (const book of books) {
        const info = book.volumeInfo || {};
        const title = info.title || "Untitled";
        const description = info.description || info.subtitle || title;
        const url = info.infoLink || "";

        // Use a stable key to detect duplicates (id or title+url)
        const key = book.id || `${title}-${url}`;

        if (!bookMap.has(key)) {
          bookMap.set(key, {
            title,
            description,
            url,
            tags: new Set([topic]),
          });
        } else {
          // Merge tags if book already exists
          bookMap.get(key).tags.add(topic);
        }
      }
    }

    // Convert Map to array and limit to 1000
    let allBooks = Array.from(bookMap.values()).slice(0, 1000);
    console.log(`Fetched and deduplicated ${allBooks.length} books total.`);

    // Batch insertion & embedding
    const BATCH_SIZE = 10;
    for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
      const batch = allBooks.slice(i, i + BATCH_SIZE).map(async (book) => {
        // Create embedding
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: `${book.title}. ${book.description}`,
        });
        const embedding = embeddingRes.data[0].embedding;

        // Store in Firestore
        return db.collection("resources").add({
          title: book.title,
          description: book.description,
          url: book.url,
          embedding,
          tags: Array.from(book.tags), // save tags as array
        });
      });

      await Promise.all(batch);
      console.log(
        `✅ Seeded books ${i + 1} to ${Math.min(
          i + BATCH_SIZE,
          allBooks.length
        )}`
      );
    }

    console.log("🎉 All books seeded successfully!");
    //process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding books:", err);
    process.exit(1);
  }
}

async function embedTagsForBooks() {
  const resourcesSnap = await db.collection("resources").get();

  const batchSize = 10;
  for (let i = 0; i < resourcesSnap.docs.length; i += batchSize) {
    const batch = resourcesSnap.docs.slice(i, i + batchSize).map(async (doc) => {
      const data = doc.data();
      if (!data.tagEmbeddings) {
        // Embed all tags together as a single string
        const tagString = data.tags.join(", ");
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: tagString,
        });
        const tagEmbedding = embeddingRes.data[0].embedding;
        await doc.ref.update({ tagEmbeddings: tagEmbedding });
      }
    });
    await Promise.all(batch);
    console.log(`✅ Embedded tags for books ${i + 1} to ${Math.min(i + batchSize, resourcesSnap.docs.length)}`);
  }
}

(async () => {
  try {
    await seedBooks();          // wait until books are seeded
    await embedTagsForBooks();  // then embed tags
    console.log("🎉 All done!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();