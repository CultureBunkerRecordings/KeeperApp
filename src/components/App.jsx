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


function App() {

  const [user, setUser] = useState(null);

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

  const [notes, setNotes] = useState([]);

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
        <Header isLogin= {!!user}/>
        <main>
          <CreateArea onAdd={addNote} />
          {notes.map((noteItem, index) => {
            return (
              <Note
                key={noteItem.id}
                id={noteItem.id}
                title={noteItem.title}
                content={noteItem.content}
                onDelete={deleteNote}
              />
            );
          })}
        </main>
        <Footer />
      </>
    ) : (
      <Login />
    )}
  </div>
);

}

export default App;
