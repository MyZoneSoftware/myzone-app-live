import { BrowserRouter, Routes, Route } from "react-router-dom";
import TopBar from "./TopBar.jsx";
import Landing from "./Landing.jsx";
import Explore from "./Explore.jsx";
import Districts from "./Districts.jsx";
import Regulations from "./Regulations.jsx";
import Projects from "./Projects.jsx";
import Login from "./Login.jsx";
import NotFound from "./NotFound.jsx";
import RequireAuth from "./RequireAuth.jsx";
import ToastHost from "./Toast.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <div className="main">
          <TopBar />

          {/* results dock root */}
          <div id="results-root" className="results-dock"></div>

          <div className="container">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/districts" element={<Districts />} />
              <Route path="/regulations" element={<Regulations />} />
              <Route path="/projects" element={
                <RequireAuth>
                  <Projects />
                </RequireAuth>
              } />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>

          <footer style={{ padding:"8px 16px", fontSize:12, color:"#6b7280", borderTop:"1px solid var(--border)", background:"#fff" }}>
            © {new Date().getFullYear()} MyZone
          </footer>

          {/* global toast host */}
          <ToastHost />
        </div>
      </div>
    </BrowserRouter>
  );
}
