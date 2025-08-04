import React, { useState, useEffect, useCallback, memo } from "react";
import "./Dashboard.css";
import "../../index.css";

// Import your own icons or use a library like react-icons
import {
  FiHome, // Home icon
  FiBox, // Box/Products icon
  FiUsers, // Users icon
  FiFileText, // Receipt/Invoice icon
  FiBarChart, // Reports/Analytics icon
  FiSettings, // Settings icon
  FiShoppingCart, // Shopping cart for orders
  FiTruck,
  FiLogOut,
  FiChevronRight,
  FiChevronLeft,
  FiDatabase, // Truck for suppliers
} from "react-icons/fi"; // Feather icons (consistent style)

import { SIGNOUT, GETDOC } from "../../../server";
import { useNavigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import secureLocalStorage from "react-secure-storage";

import PurchaseOrders from "./PurchaseOrders/PurchaseOrders.jsx";

// Create TabLink component outside the main component
const TabLink = memo(
  ({ id, text, icon, activePage, handleNavClick, expanded }) => (
    <li
      onClick={() => handleNavClick(id)}
      className={`nav-item animate__fadeInLeft ${
        activePage === id ? "active" : ""
      }`}
    >
      <div className="nav-link">
        <span className="icon">{icon}</span>
        {expanded && <span className="link-text">{text}</span>}
      </div>
    </li>
  )
);

const Dashboard = ({
  defaultActivePage = "PurchaseOrders",
  onPageChange = () => {},
  navigationItems = [],
  customGreeting,
  showGreeting = true,
  breakpoint = 800,
}) => {
  const [greeting, setGreeting] = useState("");
  const [activePage, setActivePage] = useState(defaultActivePage);
  const [expanded, setExpanded] = useState(true);
  const [width, setWidth] = useState(window.innerWidth);
  const [userPermissions, setUserPermissions] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const User = JSON.parse(secureLocalStorage.getItem("User"));
  const [accessLevel, setAccessLevel] = useState(3);
  const defaultNavigationItems = [
    { id: "PurchaseOrders", text: "ادارة أوامر التوريد", icon: <FiFileText /> },
  ];

  const fetchUserPermissions = useCallback(async () => {
    if (!User?.uid) return;

    try {
      const userData = await GETDOC("users", User.uid);
      setUserPermissions(userData.permissions || []);
      setCanEdit(userData.accessLevel <= 2 ? true : false);
      setAccessLevel(userData.accessLevel || 3);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      setUserPermissions([]);
    } finally {
      setPermissionsLoaded(true);
    }
  }, [User?.uid]);

  // Filter navigation items based on user permissions
  const filteredNavigationItems = defaultNavigationItems.filter((item) =>
    userPermissions.includes(item.id)
  );

  const navItems =
    navigationItems.length > 0 ? navigationItems : filteredNavigationItems;

  // Check if user has permission to access a specific page
  const hasPermission = useCallback(
    (pageId) => {
      return userPermissions.includes(pageId);
    },
    [userPermissions]
  );

  const handleWindowSizeChange = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  const handleNavClick = useCallback(
    (page) => {
      // Only allow navigation if user has permission
      if (hasPermission(page)) {
        setActivePage(page);
      }
    },
    [hasPermission]
  );

  const onLogout = useCallback(async () => {
    SIGNOUT();
    secureLocalStorage.clear();
    localStorage.clear();
    navigate("/");
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);
    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, [handleWindowSizeChange]);

  useEffect(() => {
    if (customGreeting) {
      setGreeting(customGreeting);
    } else {
      const hours = new Date().getHours();
      if (hours < 12) setGreeting("Good morning");
      else if (hours < 18) setGreeting("Good afternoon");
      else setGreeting("Good evening");
    }
  }, [customGreeting]);

  useEffect(() => {
    onPageChange(activePage);
  }, [activePage, onPageChange]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  // Set default active page to first available page with permission
  useEffect(() => {
    if (permissionsLoaded && userPermissions.length > 0) {
      // Check if current active page is allowed
      if (!hasPermission(activePage)) {
        // Set to first available page or default to Invoices if permitted
        const firstAvailablePage = userPermissions.includes("Invoices")
          ? "Invoices"
          : userPermissions[0];
        if (firstAvailablePage) {
          setActivePage(firstAvailablePage);
        }
      }
    }
  }, [permissionsLoaded, userPermissions, activePage, hasPermission]);

  if (width < breakpoint) {
    return (
      <div className="dashboard-mobile-message">
        <h1>Sorry, you must be on a larger screen to view this dashboard</h1>
      </div>
    );
  }

  // Show loading while permissions are being fetched
  if (!permissionsLoaded) {
    return (
      <div className="dashboard-container">
        <div
          className="loading-container"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            fontSize: "18px",
          }}
        >
          جاري تحميل الصلاحيات...
        </div>
      </div>
    );
  }

  // Show message if user has no permissions
  if (userPermissions.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="no-permissions-container">
          <h2>لا توجد صلاحيات</h2>
          <p>لا يوجد لديك صلاحيات للوصول إلى أي صفحة</p>
          <p>يرجى التواصل مع المدير لإعطائك الصلاحيات المناسبة</p>
          <button
            onClick={onLogout}
            className="Button Primary"
            style={{ marginTop: "20px" }}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <div className={`sidebar ${expanded ? "expanded" : "collapsed"}`}>
        {showGreeting && (
          <div className="greeting">
            {expanded && (
              <p className="greeting-text animate__fadeInDown">{greeting}</p>
            )}
          </div>
        )}

        <ul className="nav-list">
          {navItems.map((item) => (
            <TabLink
              key={item.id}
              id={item.id}
              text={item.text}
              icon={item.icon}
              activePage={activePage}
              handleNavClick={handleNavClick}
              expanded={expanded}
            />
          ))}

          <li
            onClick={onLogout}
            className="nav-item logout animate__fadeInLeft"
          >
            <div className="nav-link">
              <span className="icon">
                <FiLogOut />
              </span>
              {expanded && <span className="link-text">Logout</span>}
            </div>
          </li>
        </ul>

        <div
          className="sidebar-toggle animate__fadeInLeft"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <FiChevronRight /> : <FiChevronLeft />}
        </div>
      </div>
      {!loading && (
        <div className="content-area">
          {activePage === "PurchaseOrders" &&
            hasPermission("PurchaseOrders") && (
              <PurchaseOrders canEdit={canEdit} />
            )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
