/**
 * @module
 * Which space an image is drawn in, when its metadata names more than one.
 */

/**
 * The name of the space a transformation produces.
 *
 * NGFF 0.6 names it with a string. The transformations proposal, which SpatialData
 * writes today, names it with the whole coordinate system -- `{name, axes}` -- because a
 * transformation there has to declare the axes it maps between. Both say the same thing
 * about where the result lands, so both are read here rather than in each caller.
 */
export function outputName(transformation: { output?: unknown }): string | undefined {
  const { output } = transformation;
  if (typeof output === "string") {
    return output;
  }
  if (output && typeof output === "object" && "name" in output && typeof output.name === "string") {
    return output.name;
  }
  return undefined;
}

/**
 * The coordinate systems an element's own transformations refer to, in the order met.
 *
 * An element written against the transformations proposal carries no `coordinateSystems`
 * list: the systems are implied by what its transformations map into. A SpatialData image
 * typically names two -- one that is its own pixel grid under another name, and one it
 * shares with every other element of the sample -- and the second is the whole point,
 * because it is what makes an image and the labels over it line up.
 *
 * Returns undefined when the transformations name nothing, so a caller can fall back to
 * whatever it did before rather than receive an empty list it has to test for.
 */
export function coordinateSystemsFromTransformations(
  transformations: Array<{ output?: unknown }> | undefined,
  axes: Ome.Axis[],
): Ome.CoordinateSystem[] | undefined {
  if (!transformations) {
    return undefined;
  }
  const names: string[] = [];
  for (const transformation of transformations) {
    const name = outputName(transformation);
    if (name !== undefined && !names.includes(name)) {
      names.push(name);
    }
  }
  return names.length > 0 ? names.map((name) => ({ name, axes })) : undefined;
}

/**
 * The system to draw in: the one asked for, else `preferred`, else the first.
 *
 * `preferred` is how a caller says "this one, if the image has it", and is given only
 * where the systems were derived from an element's own transformations. There it is
 * `global`, the name SpatialData gives the space its elements share, and a shared space
 * is the only one in which two elements mean anything together. An image that lists its
 * systems itself is left alone: it may well have one called `global`, and changing which
 * of its systems is drawn by default would move images that work today.
 *
 * A name that is asked for and not found is not silently replaced. Drawing in a different
 * space than the one requested puts the image somewhere else entirely, and doing that
 * quietly is worse than not drawing it.
 */
export function selectCoordinateSystem(
  coordinateSystems: Ome.CoordinateSystem[],
  requested?: string,
  preferred?: string,
): Ome.CoordinateSystem | undefined {
  if (requested !== undefined) {
    return coordinateSystems.find((system) => system.name === requested);
  }
  if (preferred !== undefined) {
    const match = coordinateSystems.find((system) => system.name === preferred);
    if (match) {
      return match;
    }
  }
  return coordinateSystems[0];
}

/** The space elements of a SpatialData sample share unless they say otherwise. */
export const SHARED_COORDINATE_SYSTEM = "global";
