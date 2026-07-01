# my-digital-postcard

Turn a photo into a film graded postage stamp, right in the browser. Shoot a frame with
your webcam or upload a photo, pick a film look, and save the result as a stamp PNG.

The whole idea is that the film looks feel like a real camera, not a slider. You tap one
look and it just works. No grading knobs.

## Run it

You need a static server because the app fetches the `.cube` LUT files, and the camera
needs a secure context (localhost counts as secure). With Node installed:

```
npm start
```

Then open http://localhost:5173 and either allow the camera or drop in a photo.

No build step, no dependencies. If you would rather not use the bundled server:

```
python3 -m http.server 5173
```

## The film looks

Each look is a real 3D LUT plus the camera artifacts that sell it as film.

- **Kodak Warm** warm skin, olive greens, a mint cyan in the highlights, gentle halation.
- **Overcast Teal** cold and misty, low contrast, lifted blacks, reds still pop.
- **Golden Hour** deep warm light, richer contrast, warm highlights against cool shadows.

## How the engine works

The color and the artifacts are separate on purpose, so the color is honest film science
and the artifacts are layered on top in WebGL2.

1. `tools/gen-luts.mjs` bakes each look into a `.cube` 3D LUT by running a short chain of
   color ops. Run `npm run luts` to regenerate them.
2. `js/gl/lut.js` parses a `.cube` file into a 3D texture.
3. `js/gl/renderer.js` runs the passes: LUT grade, highlight extract, a separable blur
   that feeds both halation and bloom, then grain and vignette composited to the canvas.
   The heavy passes run on the frozen still, not on live video, so it stays fast.
4. `js/stamp.js` draws the final stamp: perforated edges, paper, title, number, an
   optional date stamp, and an optional halftone print, then exports a PNG.

## Bring your own LUT

Any standard `.cube` 3D LUT works. Drop it in `luts/`, add an entry to `js/presets.js`
with the artifact settings you want, and it shows up as a new film.

## Layout

```
index.html          the page
css/style.css       styling
js/main.js          wires the UI together
js/camera.js        webcam capture, freeze a still
js/upload.js        photo upload and drag and drop
js/presets.js       the film looks
js/gl/              the WebGL2 pipeline and LUT parser
js/stamp.js         the postage stamp compositor
luts/               the generated .cube LUTs
tools/              LUT generator and the static server
```
