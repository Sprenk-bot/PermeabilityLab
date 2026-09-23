# Fieldnotes — Water & the land

A responsive, browser-based classroom tool for investigating water movement through soil and rock. Teachers can adapt its class name and roster for their own groups.

## Open the website

Open `index.html` in a modern browser. For reliable save and student-link behaviour, serve the folder as a static website and open it on `localhost` or a hosted domain.

The teacher desk displays a student version link ending in `?mode=join&code=...`, which fills in the current class code for students. Each class receives a random code when it is first created. Codes stay stable when you reopen the site; use **New class code** to replace one, then share the refreshed student link. Students enter the first or full name their teacher added to the roster. Names are checked without case sensitivity. A unique first name is accepted; if it is not a match, the site asks: “Please enter your first, or first and last name”.

## Included

- Large, high-contrast text and more spacing throughout the activity and teacher pages.
- Ten illustrated materials available in both Simple and Advanced modes, with a visual material picker and a selected-material illustration.
- A large animated permeameter illustration beside the cumulative water graph. Comparison samples stack vertically so each can be read and watched together.
- A trial-time slider and 10-second advance button that update elapsed time, collected water, the sample view and graph together.
- A single-material graph with a linear vertical scale. Material and saved-trial comparisons use a labelled logarithmic scale with a fixed time window and readable millilitre values, keeping slower results visible beside faster ones.
- Newest-first Activity History with the water head, material depth, compaction, collected volume, elapsed time and pore space for each saved attempt. Saved result lines can be overlaid on the graph, and each attempt can be downloaded as CSV.
- Short graph explanations, glossary meanings and everyday examples. Glossary help works with hover, keyboard focus and click/touch.
- A four-step Investigation Guide that updates with learner progress and links directly to its questions.
- A short inquiry sequence that students can answer using Simple mode. Teachers can edit the task, learning intention, prompts and step notes for each class.
- A teacher desk with multiple saved classes, editable names, random class codes, alphabetised rosters, bulk name pasting, learner add/edit/remove controls, class closing, student join link, learner profiles, manual marks and feedback, full comparison-aware session replay, and CSV export.
- A student join URL and QR-code dialog in the header, plus a teacher-only learner preview route with a clear return to the Teacher Desk. The QR image is requested from QRServer when opened; the encoded destination is the public student join URL.
- Per-class local storage for lesson settings and per-learner local storage for answers, progress and replay events. A learner can rejoin on the same browser using the same code and name.

## Classroom storage boundary

This package is a static front-end prototype. It saves records in the current browser’s local storage. Multiple tabs in the same browser profile can see updates, but a student using a different browser profile or device cannot share a teacher’s roster or report yet. Publishing the files will create a student join URL, but shared cross-device classes require a connected database and teacher/student authentication. The current join page is not an access-control system.

The student join URL is generated from the website’s current origin, so it will point at the published domain when hosted. The code and roster still need shared server storage before students on separate devices can join that class. A changing code is stored on the teacher’s device only in this preview, so it cannot make a class available to another device by itself.

## Publish with GitHub Pages

This folder is ready to publish from the root of a public GitHub repository. The included `.github/workflows/pages.yml` workflow deploys the static files to GitHub Pages whenever `main` is updated, including a direct classroom route at `/local-geology/water-movement-permeability-and-porosity/`. In the repository’s **Settings → Pages**, choose **GitHub Actions** as the build and deployment source. GitHub Pages is public; the repository source will also be public on the free plan.

## Shared-class deployment path

For a cross-device version, connect the static site to a hosted database and protect class records with server-side access policies. Supabase is a practical fit for this prototype because it combines Postgres, authentication and realtime updates. To avoid a teacher account, give each class a short student join code and a separate, private teacher recovery key. The teacher uses the recovery key to reopen class setup and records; students use the join code and roster name. Validate the recovery key on a server endpoint and restrict each learner to their own answers and replay data. Do not put database service-role secrets in the browser. Use pseudonyms where possible and set a deletion/retention plan for learner records.

## Teaching model and scope

The investigation supports a three-material comparison and a classroom rain-garden inquiry. It is one learning resource, not a substitute for other lesson activities or the class assessment form. The prompts support prediction, fair testing, observing, interpreting patterns and evaluating model limits. The teacher can copy or edit prompt wording in the Teacher desk.

The Master Project Planner specifies Microsoft Forms while the concept notes mention Google Forms. The interface says “class form” and does not assume or embed either platform.

Material artwork is a representative classroom illustration rather than a photograph. The displayed porosity bands and flow categories are teaching-model outputs, not field measurements. Advanced hydraulic-conductivity values are illustrative inputs. Natural samples vary, and compaction is represented with a simplified classroom curve.
