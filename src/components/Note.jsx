import React from "react";
import DeleteIcon from "@material-ui/icons/Delete";

function Note(props) {
  // Delete note handler
  function handleDelete(event) {
    event.preventDefault();
    props.onDelete(props.id);
  }

  // Toggle recommendations handler
  function handleToggle() {
    // Pass the whole note object to the handler if needed
    props.onToggleRecommendations({
      id: props.id,
      title: props.title,
      content: props.content,
    });
  }

  return (
    <div className="note">
      <h1>{props.title}</h1>
      <p>{props.content}</p>

      <div className="note-footer">
        <div className="note-buttons">
        <button onClick={handleDelete}>
          <DeleteIcon />
        </button>

        <button onClick={handleToggle}>
          {props.isExpanded ? "Hide Recommendations" : "Show Recommendations"}
        </button>
        </div>
      </div>

      {/* Recommendations rendered inside the Note component */}
      {props.isExpanded && props.recommendations && (
        <div className="recommendations-wrapper">
          {props.recommendations.length > 0 ? (
            <ul className="recommendations">
              {props.recommendations.map((rec, index) => (
                <li key={index}>
                  <strong>{rec.title}</strong>: {rec.description}
                  {rec.url && (
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: "5px" }}
                    >
                      [link]
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-recommendations">No recommendations found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Note;
