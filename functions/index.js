// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");

const app = express();
app.use(cors({ origin: ["https://id8notes.vercel.app", "http://localhost:3000"] }));
app.use(express.json());





// Trim description to max words
function trimDescription(text, maxWords = 50) {
  if (!text) return "";
  const words = text.split(/\s+/);
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(" ") + "...";
}

app.post("/", async (req, res) => {
  try {

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Initialize Pinecone client
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = "books-index"; // your Pinecone index name
    const pineconeIndex = pinecone.index(indexName);

    const content = (req.body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content cannot be empty" });

    // 1️⃣ Generate embedding for the note content
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 2️⃣ Query Pinecone for top 5 most similar vectors
    const queryResponse = await pineconeIndex.query({
      vector: noteEmbedding,
      topK: 5,
      includeMetadata: true, // get title, description, url, tags
    });

    // 3️⃣ Format results
    const recommendations = (queryResponse.matches || []).map(match => ({
      title: match.metadata.title,
      description: trimDescription(match.metadata.description, 50),
      url: match.metadata.url,
      score: match.score, // similarity score (optional)
    }));

    res.json(recommendations);

  } catch (err) {
    console.error("❌ Error in getRecommendations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

exports.getRecommendations = onRequest(
  { secrets: ["OPENAI_API_KEY", "PINECONE_API_KEY"] },
  app
);
