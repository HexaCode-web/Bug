import { Outlet, Link } from "react-router-dom";

export default function App() {
  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/Login">Login</Link>
          </li>
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
