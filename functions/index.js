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

app.post("/", async (req, res) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content cannot be empty" });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1️⃣ Fetch all resources (lightweight fields + tagEmbeddings)
    const resourcesSnap = await db.collection("resources").get();
    const resources = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2️⃣ Extract keywords from the note
    const keywords = extractKeywords(content);

    // 3️⃣ Embed keywords/tags for filtering
    const tagString = keywords.join(" "); // combine keywords into a string
    const tagEmbeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: tagString,
    });
    const noteTagEmbedding = tagEmbeddingRes.data[0].embedding;

    // 4️⃣ Filter by tag similarity first
    const TAG_THRESHOLD = 0.6;
    const tagFilteredResources = resources.filter(r => {
      if (!r.tagEmbeddings) return false;
      const sim = cosineSimilarity(noteTagEmbedding, r.tagEmbeddings);
      return sim >= TAG_THRESHOLD;
    });

    console.log(`Filtered by tags: ${tagFilteredResources.length} resources`);

    if (tagFilteredResources.length < 5) return res.json([]);

    // 5️⃣ Take a random batch for content similarity
    const batch = shuffleArray(tagFilteredResources).slice(0, 500);

    // 6️⃣ Generate embedding for the content
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 7️⃣ Compute content similarity
    const scoredResources = batch.map(r => ({
      ...r,
      similarity: cosineSimilarity(noteEmbedding, r.embedding),
    }));

    // 8️⃣ Filter by content similarity threshold, sort, slice top 5
    const CONTENT_THRESHOLD = 0.5;
    const top5 = scoredResources
      .filter(r => r.similarity >= CONTENT_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // 9️⃣ Return only title and trimmed description
    const top5Data = top5.map(r => ({
      title: r.title,
      description: trimDescription(r.description, 50),
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
