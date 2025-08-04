// pages/zmapoverlay.js
import dynamic from "next/dynamic";
import styles  from "../styles/zmapoverlay.module.css";   // must be .module.css
import Link from "next/link";
// Map component lives in components/Map.js
const MapSection = dynamic(() => import("../components/Mapoverlay"), { ssr: false });

export default function ZMapOverlay() {
  return (
    <div className={styles.simulationPage}>
   <Link href="/" className={styles.endSessionButton}>End Session</Link>
      <div className={styles.rightContainer}>
        <div className={styles.mapContainer}>
          <MapSection />   {/* upload panel → map */}
        </div>
      </div>
    </div>
  );
}
