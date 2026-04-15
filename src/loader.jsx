import React from "react";
import "src/loader.css"; // We'll style it

export default function Loader() {
  return (
    <div className="loader-overlay">
      <div className="loader-spinner"></div>
      <p>Loading...</p>
    </div>
  );
}
