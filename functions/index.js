// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();

const app = express();

// Allow frontend domains
app.use(cors({ origin: ["https://culturebunker-keeper.vercel.app", "http://localhost:3000"] }));
app.use(express.json());

// Cosine similarity function
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

// Simple keyword extraction
function extractKeywords(text) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 2);
}

app.post("/", async (req, res) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content cannot be empty" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("OPENAI_API_KEY exists?", !!process.env.OPENAI_API_KEY);

    // 1️⃣ Get all resources from Firestore
    const resourcesSnap = await db.collection("resources").get();
    const resources = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2️⃣ Extract keywords from the note
    const keywords = extractKeywords(content);

    // 3️⃣ Filter resources by keywords without modifying title/description
    const filteredResources = resources.filter(r => {
      const combinedText = `${r.title} ${r.description}`.toLowerCase();
      return keywords.some(kw => combinedText.includes(kw));
    });

    console.log(`Filtered from ${resources.length} → ${filteredResources.length} resources`);

    // 4️⃣ Skip embeddings if less than 5 matches
    if (filteredResources.length < 5) {
      console.log("Not enough keyword matches, skipping embeddings.");
      return res.json([]); // Frontend can show a "no results" message
    }

    // 5️⃣ Generate embedding for the user's note
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 6️⃣ Compute cosine similarity for filtered resources
    const scoredResources = filteredResources.map(r => ({
      ...r, // keep full title, description, and URL
      similarity: cosineSimilarity(noteEmbedding, r.embedding),
    }));

    // 7️⃣ Apply similarity threshold and return top 5
const THRESHOLD = 0.40;
const top5 = scoredResources
  .filter(r => r.similarity >= THRESHOLD)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 5);

// Only return title and description
const top5Data = top5.map(r => ({
  title: r.title,
  description: r.description,
  url: r.url
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
