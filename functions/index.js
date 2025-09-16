// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: ["https://culturebunker-keeper.vercel.app", "http://localhost:3000"] }));
app.use(express.json());

// Cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

// Trim description to max words
function trimDescription(text, maxWords = 50) {
  if (!text) return "";
  const words = text.split(/\s+/);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(" ") + "...";
}

// Extract keywords
function extractKeywords(text) {
  return text.toLowerCase().split(/\W+/).filter(word => word.length > 2);
}

// Shuffle array
function shuffleArray(array) {
  return array.sort(() => 0.5 - Math.random());
}

// Batch cosine similarity computation
function computeBatchSimilarity(batch, noteEmbedding) {
  return batch.map(r => ({
    ...r,
    similarity: cosineSimilarity(noteEmbedding, r.embedding),
  }));
}

app.post("/", async (req, res) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content cannot be empty" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1️⃣ Extract keywords from note
    const keywords = extractKeywords(content);
    if (keywords.length === 0) return res.json([]);

    // 2️⃣ Use Firestore array-contains-any to prefilter by tags
    const MAX_TAGS_QUERY = 10; // Firestore limit for array-contains-any
    const matchingTags = keywords.slice(0, MAX_TAGS_QUERY);

    const tagFilteredSnap = await db.collection("resources")
      .where("tags", "array-contains-any", matchingTags)
      .limit(1000) // limit to reduce memory usage
      .get();

    const tagFilteredResources = tagFilteredSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Prefiltered by tags: ${tagFilteredResources.length} resources`);

    if (tagFilteredResources.length < 5) return res.json([]);

    // 3️⃣ Generate embedding for the note content
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 4️⃣ Compute content similarity in batches
    const BATCH_SIZE = 100;
    let topResults = [];

    const threshold = 0.3;

    for (let i = 0; i < tagFilteredResources.length; i += BATCH_SIZE) {
      const batch = tagFilteredResources.slice(i, i + BATCH_SIZE);
      const scoredBatch = computeBatchSimilarity(batch, noteEmbedding);

      // Keep only above threshold
      topResults.push(...scoredBatch.filter(r => r.similarity >= threshold));
    }

    // 5️⃣ Sort by similarity and take top 5
    const top5 = topResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const top5Data = top5.map(r => ({
      title: r.title,
      description: trimDescription(r.description, 50),
      url: r.url,
    }));

    res.json(top5Data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

exports.getRecommendations = onRequest(
  { secrets: ["OPENAI_API_KEY"] },
  app
);
