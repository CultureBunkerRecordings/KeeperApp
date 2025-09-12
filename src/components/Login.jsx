// src/components/Login.js
import React, { useState } from "react";
import { auth } from "../firebase";
import Header from "./Header";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // toggle between login/signup

  const handleAuth = async () => {
    try {
      if (isLogin) {
        // Log in existing user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Sign up new user
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login">
    <Header />
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleAuth}>{isLogin ? "Login" : "Sign Up"}</button>
      <p>
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <span
          style={{ cursor: "pointer", color: "blue" }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Sign Up" : "Login"}
        </span>
      </p>
    </div>
  );
}
