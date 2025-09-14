// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();

const app = express();

// Allow your frontend domain and localhost
app.use(cors({ origin: ["https://culturebunker-keeper.vercel.app", "http://localhost:3000"] }));
app.use(express.json()); // parse JSON body

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

app.post("/getRecommendations", async (req, res) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content cannot be empty" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1️⃣ Generate embedding
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 2️⃣ Get resources
    const resourcesSnap = await db.collection("resources").get();
    const resources = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3️⃣ Compute similarity
    resources.forEach(r => { r.similarity = cosineSimilarity(noteEmbedding, r.embedding); });

    // 4️⃣ Return top 5
    const top5 = resources.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    res.json(top5);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

exports.getRecommendations = onRequest(app);
