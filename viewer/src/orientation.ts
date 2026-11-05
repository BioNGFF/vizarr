import type { Matrix4 } from "math.gl";

/**
 * Placing RFC-4 anatomical orientation on the screen.
 *
 * https://ngff.openmicroscopy.org/rfc/4/index.html
 *
 * An orientation names the direction an axis runs in, from its lowest coordinate to its
 * highest. Turning that into a label at the edge of a canvas means asking where the axis
 * points once the image's coordinate transformations have been applied, which is why
 * everything here goes through the model matrix rather than reading the axis order.
 *
 * Nothing here moves a pixel. Orientation describes the coordinate system the spatial
 * metadata already establishes, so a transform that flips an axis has been accounted for
 * by the time these labels are chosen; applying it again would be applying it twice.
 */

/** The two ends of a direction pair, as RFC-4 writes them. */
export interface OrientationEnds {
  /** The term at the axis's lowest coordinate: "left", of "left-to-right". */
  from: string;
  /** The term at its highest: "right", of "left-to-right". */
  to: string;
}

/**
 * Split a vocabulary value into its ends, or null if it is not a direction pair.
 *
 * Deliberately not reduced to initials. The 24 values draw on 21 terms whose first
 * letters collide badly -- `p` is posterior, palmar, plantar and proximal; `d` is
 * dorsal, distal and deep -- and RFC-4 rejected three-letter codes such as RAS in its
 * Abandoned Ideas. Rebuilding them for the sake of a tidy label would reintroduce the
 * ambiguity the vocabulary exists to avoid.
 */
export function splitOrientation(value: string): OrientationEnds | null {
  const halves = value.split("-to-");
  if (halves.length !== 2 || !halves[0] || !halves[1]) {
    return null;
  }
  return { from: halves[0], to: halves[1] };
}

/** The anatomical term against each edge of the canvas, where there is one. */
export interface EdgeTerms {
  left: string | null;
  right: string | null;
  top: string | null;
  bottom: string | null;
}

export interface ScreenOrientation {
  edges: EdgeTerms;
  /**
   * Axes pointing out of the view, by axis name, with the ends ordered the way the
   * slider travels -- so `from` is where index 0 sits whichever way the axis is scaled.
   */
  throughPlane: Record<string, OrientationEnds>;
}

/**
 * The direction each spatial axis runs in data space.
 *
 * Only x, y and z: the model matrix is built by looking axes up by exactly these names,
 * so an axis called anything else has no column in it and nowhere to be drawn.
 */
const AXIS_VECTORS: Record<string, [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const NO_EDGES: EdgeTerms = { left: null, right: null, top: null, bottom: null };

/**
 * Work out where each oriented axis points once it is on screen.
 *
 * The view is orthographic and unrotated, so a direction in world space reaches the
 * screen unchanged: x to the right, y downwards. An axis is treated as lying in the
 * plane of the view when more of it is on screen than off it, and is labelled at the
 * edge it points towards. One that is mostly perpendicular -- z, for an ordinary image
 * -- cannot be drawn at an edge and is reported separately, for the control that scrolls
 * through it.
 */
export function resolveScreenOrientation(
  axes: ReadonlyArray<Ome.Axis> | undefined,
  matrix: Matrix4 | undefined,
): ScreenOrientation {
  const edges: EdgeTerms = { ...NO_EDGES };
  const throughPlane: Record<string, OrientationEnds> = {};
  if (!axes || !matrix) {
    return { edges, throughPlane };
  }

  for (const axis of axes) {
    // RFC-4 permits orientation only on spatial axes. One elsewhere is a fault in the
    // metadata, and drawing it would be repeating that fault rather than reporting it.
    if (axis.type !== "space" || !axis.orientation) {
      continue;
    }
    const ends = splitOrientation(axis.orientation.value);
    const vector = AXIS_VECTORS[axis.name];
    if (!ends || !vector) {
      continue;
    }

    const [dx, dy, dz] = matrix.transformAsVector(vector, []);
    const onScreen = Math.hypot(dx, dy);

    if (onScreen <= Math.abs(dz)) {
      // Ordered by index rather than by coordinate, since that is what the control
      // moves. A negative scale makes the two run opposite ways.
      throughPlane[axis.name] = dz < 0 ? { from: ends.to, to: ends.from } : ends;
      continue;
    }

    if (Math.abs(dx) >= Math.abs(dy)) {
      edges.left = dx >= 0 ? ends.from : ends.to;
      edges.right = dx >= 0 ? ends.to : ends.from;
    } else {
      // Screen y points down, so an axis with a positive y component has its lowest
      // coordinate at the top.
      edges.top = dy >= 0 ? ends.from : ends.to;
      edges.bottom = dy >= 0 ? ends.to : ends.from;
    }
  }

  return { edges, throughPlane };
}

/** Whether anything was found to draw, so a caller can skip the overlay entirely. */
export function hasScreenOrientation({ edges }: ScreenOrientation): boolean {
  return Boolean(edges.left || edges.right || edges.top || edges.bottom);
}
