import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Page not found</h1>
      <p><Link to="/">Go home</Link></p>
    </div>
  );
}
