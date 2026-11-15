import { Link, useLocation } from "react-router-dom";
import SearchBox from "./SearchBox.tsx";
import styles from "./Header.module.css";

export function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="9" cy="15" r="2.2" fill="var(--accent)" fillOpacity="0.35" />
      <circle cx="16" cy="10" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

export default function Header() {
  const { pathname, search } = useLocation();
  const inViewer = pathname.startsWith("/view");
  const searchKey = new URLSearchParams(search);
  const queryKey = `${searchKey.get("target") ?? ""}|${searchKey.get("ra") ?? ""}|${searchKey.get("dec") ?? ""}`;
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand}>
          <Logo />
          <span>Quantum Horizon</span>
        </Link>
        {inViewer ? (
          <div className={styles.search}>
            <SearchBox compact key={queryKey} />
            <Link to="/explore" className={styles.methodsLink}>
              3D
            </Link>
            <Link to="/methods" className={styles.methodsLink}>
              Methods
            </Link>
          </div>
        ) : (
          <nav aria-label="Main" className={styles.nav}>
            <Link to="/#targets">Challenge targets</Link>
            <Link to="/#neighbours">Neighbours</Link>
            <Link to="/explore">Explore in 3D</Link>
            <Link to="/?explore=sky#sky">Sky map</Link>
            <Link to="/#how">How it works</Link>
            <Link to="/methods">Methods and limits</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
