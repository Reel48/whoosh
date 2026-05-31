import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Whoosh — The only group chat you'll ever need";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0381ed",
          color: "#000",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Sports · Entertainment · Business
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            maxWidth: 1000,
          }}
        >
          The only group chat you&rsquo;ll ever need.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 36,
            fontWeight: 900,
          }}
        >
          <span>WHOOSH</span>
          <span
            style={{
              background: "#000",
              color: "#f3f3f0",
              padding: "16px 32px",
              borderRadius: 999,
              fontSize: 28,
            }}
          >
            whoosh.business
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
