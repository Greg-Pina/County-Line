import MapShell from '../src/components/MapShell';

export default function HomePage() {
  return (
    <main className="page">
      <header className="topbar">
        <h1>County Line</h1>
        <p>U.S. geographies + public data overlays</p>
      </header>
      <section className="mapWrap">
        <MapShell />
      </section>
    </main>
  );
}
