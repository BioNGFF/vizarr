import { loadSources } from "../src/io";
import { test, expect } from "vitest";
import { range } from "../src/utils";
import { AssertionError } from "node:assert";

const labelImageURL = 'https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0062A/6001240_labels.zarr'
const imageURL = 'https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.5/idr0066/ExpD_chicken_embryo_MIP.ome.zarr'
const labelIds = range(61)

function generateLabelColors(labelIds) {
  return labelIds.map((id) => {
    return (
      {
        labelValue: id + 1,
        rgba: [Math.floor(Math.random() * 250), Math.floor(Math.random() * 250), Math.floor(Math.random() * 250), Math.floor(Math.random() * 250)],
        value: Math.random()
      }
    )
  })
}

test('Can create source data with externally-defined label colours', async () => {
  const labelColours = generateLabelColors(labelIds)
  const sources = await loadSources(
    [labelImageURL],
    [labelColours]
  )
  console.log(labelColours[0])
  console.log(sources[0].value.labels[0].colors[0])
  expect(sources[0].value.labels[0].colors).toBe(labelColours)
})

test('Attempting to add externally-defined label colours to image without label leads to an error', async () => {
  const labelColours = generateLabelColors(labelIds)
  const sources = await loadSources(
    [imageURL],
    [labelColours]
  )
  expect(sources[0].status).toBe('rejected')
  //Requires AssertionError to provide correct error message to user
  expect(sources[0].reason.name).toBe('AssertionError')
})
