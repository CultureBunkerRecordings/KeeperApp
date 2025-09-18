// seedResources.js
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");
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

// ✅ Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = "books-index"; // must match the index you created in Pinecone

async function clearResources() {
  const collectionRef = db.collection("resources");
  const batchSize = 20;

  async function deleteBatch() {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      return false;
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

// Fetch up to maxResults books with pagination
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

// Seed books into Pinecone (and Firestore for metadata)
async function seedBooks() {
  try {
    await clearResources(); // wipe Firestore first
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

    for (const topic of topics) {
      console.log(`📚 Fetching books about ${topic}...`);
      const books = await fetchBooks(topic, 100);

      for (const book of books) {
        const info = book.volumeInfo || {};
        const title = info.title || "Untitled";
        const description = info.description || info.subtitle || title;
        const url = info.infoLink || "";

        const key = book.id || `${title}-${url}`;

        if (!bookMap.has(key)) {
          bookMap.set(key, {
            id: key,
            title,
            description,
            url,
            tags: new Set([topic]),
          });
        } else {
          bookMap.get(key).tags.add(topic);
        }
      }
    }

    let allBooks = Array.from(bookMap.values()).slice(0, 1000);
    console.log(`Fetched and deduplicated ${allBooks.length} books total.`);

    const pineconeIndex = pinecone.index(indexName);
    const BATCH_SIZE = 10;

    for (let i = 0; i < allBooks.length; i += BATCH_SIZE) {
      const batch = allBooks.slice(i, i + BATCH_SIZE);

      const vectors = await Promise.all(
        batch.map(async (book) => {
          const embeddingRes = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: `${book.title}. ${book.description}`,
          });
          const embedding = embeddingRes.data[0].embedding;

          // Save metadata in Firestore (without embedding)
          await db.collection("resources").doc(book.id).set({
            title: book.title,
            description: book.description,
            url: book.url,
            tags: Array.from(book.tags),
          });

          return {
            id: book.id,
            values: embedding,
            metadata: {
              title: book.title,
              description: book.description,
              url: book.url,
              tags: Array.from(book.tags),
            },
          };
        })
      );

      await pineconeIndex.upsert(vectors);

      console.log(
        `✅ Seeded books ${i + 1} to ${Math.min(i + BATCH_SIZE, allBooks.length)}`
      );
    }

    console.log("🎉 All books seeded successfully into Firestore + Pinecone!");
  } catch (err) {
    console.error("❌ Error seeding books:", err);
    process.exit(1);
  }
}

(async () => {
  try {
    await seedBooks();
    console.log("🎉 All done!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
