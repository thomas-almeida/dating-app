import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BACKGROUND = "#0d0a0b";
const CORAL = "#ff5a6e";

const MARK = `
  <path fill="${CORAL}" d="M256 440C256 440 64 322 64 182C64 118 114 76 170 76C208 76 238 96 256 124C274 96 304 76 342 76C398 76 448 118 448 182C448 322 256 440 256 440Z"/>
  <rect fill="${BACKGROUND}" x="238" y="146" width="36" height="188" rx="10"/>
  <rect fill="${BACKGROUND}" x="190" y="196" width="132" height="36" rx="10"/>
`;

// A zona segura de um ícone maskable é o círculo central de 80%.
function iconSvg(scale: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${MARK}</g>
</svg>
`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, scale: 0.72 },
  { file: "icon-512.png", size: 512, scale: 0.72 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.56 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.72 },
];

async function run() {
  await mkdir("public/icons", { recursive: true });

  await Promise.all(
    ICONS.map(({ file, size, scale }) =>
      sharp(Buffer.from(iconSvg(scale)))
        .resize(size, size)
        .png()
        .toFile(`public/icons/${file}`),
    ),
  );

  await writeFile("public/icons/icon.svg", iconSvg(0.8));

  console.log(`${ICONS.length + 1} ícones em public/icons`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
