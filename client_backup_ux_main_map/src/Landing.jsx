import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing narrow">
      <section className="hero card">
        <h1 className="hero-title">Find zoning & land development answers fast</h1>
        <p className="hero-sub">Type an address or Parcel ID above. Or jump into Map View to select properties on the map.</p>
        <div className="hero-actions">
          <Link to="/explore" className="btn-primary">Map View</Link>
        </div>
      </section>

      <section className="tiles">
        <Link to="/districts" className="tile card">
          <div className="tile-title">Zoning Districts</div>
          <div className="tile-sub">Allowed uses, intents, and standards</div>
        </Link>

        <Link to="/regulations" className="tile card">
          <div className="tile-title">Regulations</div>
          <div className="tile-sub">Setbacks, heights, coverage, notes</div>
        </Link>

        <Link to="/projects" className="tile card">
          <div className="tile-title">Projects</div>
          <div className="tile-sub">Track submittals & review status (login required)</div>
        </Link>
      </section>
    </div>
  );
}
