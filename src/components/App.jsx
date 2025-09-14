import React, { useState, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Note from "./Note";
import CreateArea from "./CreateArea";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import Login from "./Login";
import { db } from "../firebase"; // your firebase.js path
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";



function App() {

  const [recommendations, setRecommendations] = useState({});

  const [user, setUser] = useState(null);

  const [notes, setNotes] = useState([]);

  const [expandedNotes, setExpandedNotes] = useState({});


  useEffect(() => {
    if (!user) return;

    // Reference to this user's notes subcollection
    const notesRef = collection(db, "users", user.uid, "notes");

    // Real-time listener for notes
    const q = query(notesRef, orderBy("title")); // optional ordering
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotes(notesData);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  async function fetchRecommendations(note) {
  if (!user) return;

  try {
    if (!note.content || !note.content.trim()) return;

    const res = await fetch(
      "https://getrecommendations-nftaixke4a-uc.a.run.app",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note.content }),
      }
    );

    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();

    setRecommendations(prev => ({ ...prev, [note.id]: data }));
  } catch (err) {
    console.error("Error fetching recommendations:", err);
  }
}

  function toggleRecommendations(note) {
    const isExpanded = expandedNotes[note.id];

    // If not expanded and we haven't fetched recommendations yet, fetch them
    if (!isExpanded && !recommendations[note.id]) {
      fetchRecommendations(note);
    }

    // Toggle the expanded state
    setExpandedNotes(prev => ({
      ...prev,
      [note.id]: !prev[note.id]
    }));
  }


  async function deleteNote(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "notes", id));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
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
                  {expandedNotes[noteItem.id] ? "Hide Recommendations" : "Show Recommendations"}
                </button>

                {expandedNotes[noteItem.id] && recommendations[noteItem.id] && (
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
