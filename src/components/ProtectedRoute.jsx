// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import secureLocalStorage from "react-secure-storage";

export default function ProtectedRoute({ children }) {
  if (!secureLocalStorage.getItem("Token")) {
    return <Navigate to="/" replace />;
  }

  return children;
}
