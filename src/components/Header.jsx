import React from "react";
import HighlightIcon from "@material-ui/icons/Highlight";
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import { auth } from "../firebase"; // adjust path if needed
import { signOut } from "firebase/auth";
import { ExitToApp } from "@material-ui/icons";


function Header() {

  function handleLogout() {
  signOut(auth)
    .then(() => {
      console.log("User logged out");
      // Firebase onAuthStateChanged listener in App.js will automatically update UI
    })
    .catch((error) => {
      console.error("Error logging out:", error);
    });
}


  return (
    <header>
      <h1>
        {" "}
        <HighlightIcon />
        Keeper
      </h1>
      <button onClick={handleLogout}><ExitToApp /></button>
    </header>
  );
}

export default Header;
