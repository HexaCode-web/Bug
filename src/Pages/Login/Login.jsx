import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import "../../index.css";
import {
  DELETECURRENTUSER,
  DELETEDOC,
  DELETEUSER,
  LOGIN,
  QUERY,
  RESETPASSWORD,
} from "../../../server";
import secureLocalStorage from "react-secure-storage";
import { CreateToast } from "../../main";

const LoginPage = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState({ text: "", type: "" });
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!credentials.email || !credentials.password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      const User = await LOGIN(credentials.email, credentials.password);
      const fetchedUser = await QUERY("users", "ID", "==", User.uid);
      if (fetchedUser[0].deleted) {
        await DELETEDOC("users", User.uid),
          await DELETECURRENTUSER(),
          CreateToast("sorry your account have been deleted", "info");
        return;
      } else {
        secureLocalStorage.setItem("Token", User.stsTokenManager.accessToken);
        secureLocalStorage.setItem("User", JSON.stringify(User));
        localStorage.setItem("isAuthenticated", "true");
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetEmailChange = (e) => {
    setResetEmail(e.target.value);
    // Clear reset message when user starts typing
    if (resetMessage.text) setResetMessage({ text: "", type: "" });
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    // Validate email
    if (!resetEmail || !resetEmail.includes("@")) {
      setResetMessage({
        text: "Please enter a valid email address",
        type: "error",
      });
      return;
    }

    setIsResetting(true);

    try {
      await RESETPASSWORD(resetEmail);
      setResetMessage({
        text: "Password reset email sent. Please check your inbox.",
        type: "success",
      });
      // Auto-close the modal after successful reset
      setTimeout(() => {
        setShowResetModal(false);
        setResetEmail("");
        setResetMessage({ text: "", type: "" });
      }, 3000);
    } catch (err) {
      setResetMessage({
        text: err.message || "Failed to send reset email. Please try again.",
        type: "error",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const openResetModal = () => {
    setShowResetModal(true);
    setResetEmail(credentials.email || ""); // Pre-fill with login email if available
    setResetMessage({ text: "", type: "" });
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetEmail("");
    setResetMessage({ text: "", type: "" });
  };

  return (
    <div className="container">
      <div className="formPanel">
        <div className="formContainer">
          <div className="logoContainer">
            <img src="/Logo.png" alt="Banner" className="logo" />
          </div>

          <h2 className="title">Log in to your account</h2>

          <form className="form" onSubmit={handleSubmit}>
            <div className="inputGroup">
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                className="input"
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email"
                value={credentials.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="inputGroup">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                type="password"
                id="password"
                name="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="forgotPasswordContainer">
              <button
                type="button"
                className="forgotPasswordLink"
                onClick={openResetModal}
              >
                Forgot password?
              </button>
            </div>

            <div className="errorLabel">{error && error}</div>

            <button
              type="submit"
              className={`button ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
            >
              <span className={`buttonText ${isLoading ? "loading" : ""}`}>
                Login
              </span>
              <span className={`spinner ${isLoading ? "loading" : ""}`}></span>
            </button>
          </form>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="resetModalOverlay">
          <div className="resetModalContainer">
            <div className="resetModalHeader">
              <h3>Reset Password</h3>
              <button
                className="resetModalCloseButton"
                onClick={closeResetModal}
              >
                ×
              </button>
            </div>
            <div className="resetModalBody">
              <form onSubmit={handleResetPassword}>
                <div className="inputGroup">
                  <label className="label" htmlFor="resetEmail">
                    Email address
                  </label>
                  <input
                    className="input"
                    type="email"
                    id="resetEmail"
                    value={resetEmail}
                    onChange={handleResetEmailChange}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                {resetMessage.text && (
                  <div className={`resetMessage ${resetMessage.type}`}>
                    {resetMessage.text}
                  </div>
                )}

                <div className="resetModalFooter">
                  <button
                    type="button"
                    className="cancelButton"
                    onClick={closeResetModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`resetButton ${isResetting ? "loading" : ""}`}
                    disabled={isResetting}
                  >
                    <span
                      className={`buttonText ${isResetting ? "loading" : ""}`}
                    >
                      Reset Password
                    </span>
                    <span
                      className={`spinner ${isResetting ? "loading" : ""}`}
                    ></span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
