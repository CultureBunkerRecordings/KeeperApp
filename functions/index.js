const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { onCall } = require("firebase-functions/v2/https");
const OpenAI = require("openai");

admin.initializeApp();
const db = admin.firestore();

// cosine similarity helper
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

exports.getRecommendations = onCall(
  { secrets: ["OPENAI_API_KEY"], enforceAppCheck: true },
  async (data, context) => {

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "false";

    if (!context.auth && !isEmulator) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const content = (data.content || data?.data?.content || "").trim();
    if (!content) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Note content cannot be empty"
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1️⃣ Generate embedding
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
    });
    const noteEmbedding = embeddingRes.data[0].embedding;

    // 2️⃣ Get resources
    const resourcesSnap = await db.collection("resources").get();
    const resources = resourcesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 3️⃣ Compute similarity
    resources.forEach((r) => {
      r.similarity = cosineSimilarity(noteEmbedding, r.embedding);
    });

    // 4️⃣ Return top 5
    return resources
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }
);
