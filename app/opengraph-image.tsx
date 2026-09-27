import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Shared preview image for links (WhatsApp, Instagram, search). Built at
// build time from the brand files; uses the bundled font, no download (L-011).
export const alt = "Cake 67 · Confeitaria em Campo Grande";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function brandImage(file: string) {
  const data = await readFile(path.join(process.cwd(), "public", "brand", file));
  return `data:image/png;base64,${data.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const [mark, word] = await Promise.all([brandImage("logo-mark.png"), brandImage("logo-word.png")]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#fbf6ef",
          borderBottom: "24px solid #f1c8a8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={146} height={180} alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={word} width={600} height={122} alt="" />
        </div>
        <div style={{ fontSize: 44, color: "#5f6340" }}>Confeitaria em Campo Grande · MS</div>
      </div>
    ),
    size,
  );
}
