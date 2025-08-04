// pages/_app.js
import 'leaflet/dist/leaflet.css';
import '../styles/globals.css';
import Script from 'next/script';
import { GlobalProvider } from '../context/GlobalContext';
import '../styles/add-details.css';
import '../styles/combat-selection.css';
import '../styles/index.css';
import '../styles/resource-allocation.css';
import '../styles/select-map.css';
import '../styles/synchronization.module.css';
import "../styles/rtm.smodule.css";


export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Load Leaflet and SQL.js after hydration */}
      <Script
        src="/leaflet/leaflet.js"
        strategy="afterInteractive"
      />
      <Script
        src="/sqljs/sql-wasm.js"
        strategy="afterInteractive"
      />

      <GlobalProvider>
        <Component {...pageProps} />
      </GlobalProvider>
    </>
  );
}
