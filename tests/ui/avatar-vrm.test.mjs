import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';

const output = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: 'frontend/src/avatar/vrm/roam.ts',
      formats: ['es'],
      fileName: () => 'avatar-roam.js',
    },
  },
});
const chunk = (Array.isArray(output) ? output[0] : output).output.find((item) => item.type === 'chunk');
const { headingForScreenMotion } = await import(
  `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`
);

test('VRM roaming faces the direction of screen travel', () => {
  assert.equal(headingForScreenMotion(1, 0), Math.PI / 2);
  assert.equal(headingForScreenMotion(-1, 0), -Math.PI / 2);
  assert.equal(headingForScreenMotion(0, 1), Math.PI);
  assert.ok(Object.is(headingForScreenMotion(0, -1), 0));
});

const gestureOutput = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: 'frontend/src/avatar/vrm/gestures.ts',
      formats: ['es'],
      fileName: () => 'avatar-gestures.js',
    },
  },
});
const gestureChunk = (Array.isArray(gestureOutput) ? gestureOutput[0] : gestureOutput).output.find((item) => item.type === 'chunk');
const { GESTURE_DURATIONS, IDLE_GESTURES, isAvatarGesture } = await import(
  `data:text/javascript;base64,${Buffer.from(gestureChunk.code).toString('base64')}`
);

test('VRM interaction gestures cover wave, jump, dance and nod', () => {
  assert.deepEqual(Object.keys(GESTURE_DURATIONS).sort(), ['dance', 'jump', 'nod', 'wave']);
  assert.ok(IDLE_GESTURES.length >= 2 && IDLE_GESTURES.every((kind) => isAvatarGesture(kind)));
  assert.ok(isAvatarGesture('jump'));
  assert.ok(!isAvatarGesture('moonwalk'));
});

const videosOutput = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: {
      entry: 'frontend/src/ui/tour-videos.ts',
      formats: ['es'],
      fileName: () => 'tour-videos.js',
    },
  },
});
const videosChunk = (Array.isArray(videosOutput) ? videosOutput[0] : videosOutput).output.find((item) => item.type === 'chunk');
const { tourVideoFor, registeredVideos } = await import(
  `data:text/javascript;base64,${Buffer.from(videosChunk.code).toString('base64')}`
);

test('narration videos fall back to a blank screen until a clip is bound', () => {
  assert.equal(tourVideoFor(null), null);
  assert.equal(tourVideoFor(undefined), null);
  assert.equal(tourVideoFor('unknown-poi'), null);
  assert.ok(Array.isArray(registeredVideos()));
});
