// src/pages/ErrorPage.jsx
import { useRouteError, Link } from "react-router-dom";
import "./ErrorPage.css"; // Create this CSS file

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="error-container">
      <div className="error-content">
        <h1 className="error-title">404 - Page Not Found</h1>
        <p className="error-message">
          {error.statusText ||
            error.message ||
            "The page you're looking for doesn't exist."}
        </p>
        <img
          src="/src/assets/error-illustration.svg"
          alt="Error illustration"
          className="error-image"
        />
        <Link to="/" className="home-link">
          ← Return to Home
        </Link>
      </div>
    </div>
  );
}
