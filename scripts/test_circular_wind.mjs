import test from "node:test";
import assert from "node:assert/strict";

// Mathematical test for circular mean function
function circularAvg(angles) {
  const valid = angles.filter((a) => a !== null && !isNaN(a));
  if (valid.length === 0) return null;
  let sinSum = 0;
  let cosSum = 0;
  for (const deg of valid) {
    const rad = (deg * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  let meanRad = Math.atan2(sinSum / valid.length, cosSum / valid.length);
  if (meanRad < 0) meanRad += 2 * Math.PI;
  return (meanRad * 180) / Math.PI;
}

test("Circular Wind Direction Consensus Tests", async (t) => {
  await t.test("Averages across 0/360 degrees boundary correctly (North NNW and NNE)", () => {
    // 350 deg (NNW) and 10 deg (NNE) should yield 0 deg (or 360 deg), NOT 180 deg (South)
    const result = circularAvg([350, 10]);
    assert.ok(result !== null);
    // 0 deg or close to 360 deg
    const diffFromNorth = Math.min(Math.abs(result - 0), Math.abs(result - 360));
    assert.ok(diffFromNorth < 1e-6, `Expected ~0/360 degrees, got ${result}`);
  });

  await t.test("Averages standard quadrant correctly (East: 80 and 100 deg)", () => {
    const result = circularAvg([80, 100]);
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 90) < 1e-6, `Expected 90 degrees, got ${result}`);
  });

  await t.test("Handles null and NaN values gracefully", () => {
    const result = circularAvg([null, 180, NaN, 180]);
    assert.ok(result !== null);
    assert.ok(Math.abs(result - 180) < 1e-6, `Expected 180 degrees, got ${result}`);
  });
});
