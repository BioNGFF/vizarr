/**
 * The vizarr mark, inlined rather than imported from assets/.
 *
 * The viewer is published as a library, so it cannot reference a file outside its own
 * package, and inlining also spares consumers from needing an SVG loader in their
 * bundler. It is the mark only: the wordmark variant would duplicate the adjacent
 * "VIZARR" text.
 */

// Intrinsic ratio of the artwork, so a caller only has to choose a height.
const ASPECT = 145.65 / 126.13;

function VizarrLogo({ size = 16 }: { size?: number }) {
  return (
    <svg
      height={size}
      width={Math.round(size * ASPECT)}
      viewBox="0 0 145.65 126.13"
      xmlns="http://www.w3.org/2000/svg"
      // Decorative: the adjacent text already names the application.
      aria-hidden="true"
      focusable="false"
      // Keeps the multiply blending between the three chevrons, rather than letting it
      // blend into whatever sits behind the panel.
      style={{ isolation: "isolate", display: "block", flexShrink: 0 }}
    >
      <polygon
        fill="#27aae1"
        style={{ mixBlendMode: "multiply" }}
        points="72.82 40.61 49.38 0 7.5 0 72.82 113.14 138.15 0 96.27 0 72.82 40.61"
      />
      <polygon
        fill="#ef4136"
        style={{ mixBlendMode: "multiply" }}
        points="102.06 12.99 72.82 63.62 43.59 12.99 15 12.99 80.32 126.13 145.65 12.99 102.06 12.99"
      />
      <polygon
        fill="#39b54a"
        style={{ mixBlendMode: "multiply" }}
        points="72.82 63.62 43.59 12.99 0 12.99 65.32 126.13 130.65 12.99 102.06 12.99 72.82 63.62"
      />
    </svg>
  );
}

export default VizarrLogo;
