import { Box } from "@mui/material";

/**
 * The arrow both RFC-4 orientation displays are drawn with.
 *
 * One definition rather than two. The compass and the slider are saying the same thing
 * about different axes -- which way along this axis the anatomy runs -- and an arrow
 * that changed shape between them would suggest they meant different things. It is
 * drawn rather than typed because a text glyph sits on the baseline and reads as
 * punctuation, and a hairline arrow at caption size is barely legible as an arrow.
 */

/** Line weight of the shaft. */
const STROKE = 1.25;
/** Half-width of the head, which also sets how far past the tip it reaches. */
const HEAD = 4.5;

export type ArmDirection = "up" | "down" | "left" | "right";

/**
 * A shaft from (`cx`, `cy`) running `length` in `direction`, with a head on the end.
 *
 * Takes its origin rather than assuming the centre, so the compass can draw four of
 * these out of one point while the slider draws a single one left to right.
 */
export function Arm({
  cx,
  cy,
  length,
  direction,
}: {
  cx: number;
  cy: number;
  length: number;
  direction: ArmDirection;
}) {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  const tipX = cx + dx * length;
  const tipY = cy + dy * length;
  // The head starts a hair inside the tip so the shaft never shows through its base.
  const baseX = tipX - dx;
  const baseY = tipY - dy;
  // Across the direction of travel, which is what the head's base spans.
  const [px, py] = [-dy, dx];
  const points = [
    `${tipX + dx * HEAD},${tipY + dy * HEAD}`,
    `${baseX - px * HEAD},${baseY - py * HEAD}`,
    `${baseX + px * HEAD},${baseY + py * HEAD}`,
  ].join(" ");

  return (
    <>
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="currentColor" strokeWidth={STROKE} />
      <polygon points={points} fill="currentColor" />
    </>
  );
}

/** Width and height of {@link InlineArrow}, in the units a caption is set in. */
const INLINE = { width: 24, height: 12 };

/**
 * One arm on its own, sized to sit in a line of text.
 *
 * Vertically centred on the box rather than on the baseline, so it lines up with the
 * middle of the labels either side of it instead of with the bottom of their letters.
 */
export function InlineArrow() {
  return (
    <Box
      component="svg"
      aria-hidden
      viewBox={`0 0 ${INLINE.width} ${INLINE.height}`}
      sx={{
        width: INLINE.width,
        height: INLINE.height,
        color: "rgba(255, 255, 255, 0.7)",
        display: "block",
        flexShrink: 0,
      }}
    >
      <Arm cx={1} cy={INLINE.height / 2} length={INLINE.width - 1 - HEAD - 1} direction="right" />
    </Box>
  );
}
