import React, { useState, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Note from "./Note";
import CreateArea from "./CreateArea";
import Login from "./Login";
import { auth } from "../firebase";
import { db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [recommendations, setRecommendations] = useState({});
  const [expandedNotes, setExpandedNotes] = useState({});

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Listen to user's notes in Firestore
  useEffect(() => {
    if (!user) return;

    const notesRef = collection(db, "users", user.uid, "notes");
    const q = query(notesRef, orderBy("title"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotes(notesData);
    });

    return () => unsubscribe();
  }, [user]);

  // Add new note
  async function addNote(newNote) {
    if (!user) return;
    try {
      await addDoc(collection(db, "users", user.uid, "notes"), {
        title: newNote.title,
        content: newNote.content,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("Error adding note:", err);
    }
  }

  // Delete note
  async function deleteNote(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "notes", id));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  }

  // Fetch recommendations from Cloud Run
  async function fetchRecommendations(note) {
    if (!user || !note.content || !note.content.trim()) return;

    // Avoid refetching if already fetched
    if (recommendations[note.id]) return;

    try {
      const res = await fetch(
        "https://getrecommendations-nftaixke4a-uc.a.run.app", // your Cloud Run URL
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: note.content }),
        }
      );

      if (!res.ok) {
        console.error(`Error fetching recommendations: ${res.status}`);
        return;
      }

      const data = await res.json();
      setRecommendations((prev) => ({ ...prev, [note.id]: data }));
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  }

  // Toggle recommendations visibility
  function toggleRecommendations(note) {
    const isExpanded = expandedNotes[note.id];
    if (!isExpanded && !recommendations[note.id]) {
      fetchRecommendations(note);
    }
    setExpandedNotes((prev) => ({
      ...prev,
      [note.id]: !prev[note.id],
    }));
  }

  return (
    <div className="app-wrapper">
      {user ? (
        <>
          <Header isLogin={!!user} />
          <main>
            <CreateArea onAdd={addNote} />
            {notes.map((noteItem) => (
              <div key={noteItem.id}>
                <Note
                  id={noteItem.id}
                  title={noteItem.title}
                  content={noteItem.content}
                  onDelete={deleteNote}
                />

                <button
                  onClick={() => toggleRecommendations(noteItem)}
                  className="toggle-recommendations-btn"
                >
                  {expandedNotes[noteItem.id]
                    ? "Hide Recommendations"
                    : "Show Recommendations"}
                </button>

                {expandedNotes[noteItem.id] &&
                  recommendations[noteItem.id] &&
                  recommendations[noteItem.id].length > 0 && (
                    <ul className="recommendations">
                      {recommendations[noteItem.id].map((rec) => (
                        <li key={rec.id}>
                          <strong>{rec.title}</strong>: {rec.description}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            ))}
          </main>
          <Footer />
        </>
      ) : (
        <>
          <Header />
          <Login />
        </>
      )}
    </div>
  );
}

export default App;
