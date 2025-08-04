import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Preload Leaflet JS to prioritize loading */}
          <link
            rel="preload"
            href="/leaflet/leaflet.js"
            as="script"
            crossOrigin=""
          />
          {/* Preload SQL.js for WebAssembly */}
          <link
            rel="preload"
            href="/sqljs/sql-wasm.js"
            as="script"
            crossOrigin=""
          />
          {/* Preload sql-wasm.wasm to ensure WebAssembly is ready */}
          <link
            rel="preload"
            href="/sqljs/sql-wasm.wasm"
            as="fetch"
            crossOrigin=""
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
