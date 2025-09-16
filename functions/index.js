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

// Shuffle array
function shuffleArray(array) {
  return array.sort(() => 0.5 - Math.random());
}

// Compute similarity for batch
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

    // 1️⃣ Generate embedding for the note content once
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 2️⃣ Fetch a limited set of resources (avoid loading everything)
    const resourcesSnap = await db.collection("resources").limit(1000).get();
    const resources = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Fetched ${resources.length} resources from Firestore`);

    // 3️⃣ Filter by semantic tag similarity
    const TAG_THRESHOLD = 0.4;
    const tagFilteredResources = resources.filter(r => {
      if (!r.tagEmbeddings) return false;
      const sim = cosineSimilarity(noteEmbedding, r.tagEmbeddings);
      return sim >= TAG_THRESHOLD;
    });

    console.log(`Tag-filtered resources: ${tagFilteredResources.length}`);

    if (tagFilteredResources.length < 5) {
      return res.json([]); // not enough results
    }

    // 4️⃣ Randomly sample up to 500 docs for content similarity
    const batch = shuffleArray(tagFilteredResources).slice(0, 500);

    // 5️⃣ Compute content similarity in chunks
    const BATCH_SIZE = 100;
    let topResults = [];
    const CONTENT_THRESHOLD = 0.3;

    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const subBatch = batch.slice(i, i + BATCH_SIZE);
      const scoredBatch = computeBatchSimilarity(subBatch, noteEmbedding);

      topResults.push(...scoredBatch.filter(r => r.similarity >= CONTENT_THRESHOLD));
    }

    // 6️⃣ Sort and take top 5
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
    console.error("❌ Error in recommendations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

exports.getRecommendations = onRequest(
  { secrets: ["OPENAI_API_KEY"] },
  app
);
