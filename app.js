(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const STORAGE_KEY = "fieldnotes-soil-lab-v3";
  const LEGACY_STORAGE_KEY = "fieldnotes-soil-lab-v2";
  const STUDENT_SESSION_KEY = "fieldnotes-soil-lab-student-session";
  const AREA_M2 = 8e-4;
  const GRAPH_COLORS = ["#557d60", "#c16c51", "#7399a1"];
  const HISTORY_COLORS = ["#8167a5", "#c08a3e", "#4e8294", "#aa6475"];

  // Representative values make the classroom comparisons reproducible. The library
  // explains why a field sample may behave very differently from these model values.
  const materials = [
    { id: "gravel", label: "Gravel", category: "Loose grains", k: 8e-3, porosity: 35, grain: "Large, connected gaps", grainRadius: 5.1, color: "#927c54", sensitivity: 0.95, note: "Open gaps let water move quickly." },
    { id: "coarse_sand", label: "Coarse sand", category: "Loose grains", k: 1e-3, porosity: 38, grain: "Coarse grains", grainRadius: 3.5, color: "#b49a62", sensitivity: 0.82, note: "Larger gaps usually pass water faster." },
    { id: "fine_sand", label: "Fine sand", category: "Loose grains", k: 1e-4, porosity: 44, grain: "Fine, close grains", grainRadius: 2.25, color: "#c4a877", sensitivity: 0.63, note: "Smaller gaps slow water compared with coarse sand." },
    { id: "silt", label: "Silt", category: "Soil", k: 2e-6, porosity: 46, grain: "Very fine grains", grainRadius: 1.55, color: "#9d8b72", sensitivity: 0.58, note: "Fine pores can store water while slowing its movement." },
    { id: "clay", label: "Clay", category: "Soil", k: 2e-7, porosity: 48, grain: "Tiny, poorly connected pores", grainRadius: 1.12, color: "#a87965", sensitivity: 0.55, note: "Many tiny pores can hold water but pass it slowly." },
    { id: "loam", label: "Loam", category: "Soil mix", k: 1e-5, porosity: 42, grain: "Mixed grain sizes", grainRadius: 2.4, color: "#8c8664", sensitivity: 0.66, note: "A mix of particle sizes gives mixed pore pathways." },
    { id: "laterite", label: "Laterite", category: "WA field sample", k: 8e-6, porosity: 35, grain: "Weathered, variable material", grainRadius: 2.7, color: "#b5674d", sensitivity: 0.78, note: "Highly variable; the model uses a broad classroom estimate." },
    { id: "tamala_limestone", label: "Tamala Limestone", category: "WA field sample", k: 5e-4, porosity: 25, grain: "Fractures and solution spaces", grainRadius: 3.1, color: "#c6b28d", sensitivity: 0.7, note: "Fractures and cavities can carry water quickly." },
    { id: "granite", label: "Granite", category: "Rock", k: 1e-9, porosity: 4, grain: "Dense rock; fractures matter", grainRadius: 2.4, color: "#879594", sensitivity: 0.47, note: "Intact granite has little connected pore space; fractures change its flow." },
    { id: "sandstone", label: "Sandstone", category: "Rock", k: 1e-6, porosity: 18, grain: "Grains cemented together", grainRadius: 2.1, color: "#aa8c70", sensitivity: 0.53, note: "Cement and fractures make sandstone samples very different." }
  ];
  const materialById = Object.fromEntries(materials.map((item) => [item.id, item]));
  const questionBank = [
    { id: "q1", stage: "PREDICT", prompt: "Before you run anything: which of your three materials do you predict will pass water fastest? Give one reason from the particle picture or material note.", hint: "Start with: I predict ___ because I can see…" },
    { id: "q2", stage: "PLAN A FAIR TEST", prompt: "What will you keep the same while you compare materials? Why does that make the comparison fair?", hint: "Think about water head, sample depth and compaction." },
    { id: "q3", stage: "READ YOUR RESULTS · FORM Q7", prompt: "Which of your three materials let water move fastest? Compare the labelled mL values at the same time, then use the graph to support your answer.", hint: "Name the material, the elapsed time and the amount collected. In the comparison graph, line angle is not an exact measure of the difference in flow." },
    { id: "q4", stage: "EXPLAIN · FORM Q8", prompt: "Did the material with the most pore space also have the fastest flow? Explain how pore size or connected pathways could help explain your result.", hint: "Porosity is the amount of open space. Permeability is how easily water can move through connected spaces." },
    { id: "q5", stage: "EXPLAIN · FORM Q9", prompt: "How did grain size or particle arrangement affect water movement in your trials? Use one result as evidence.", hint: "Link what you saw between the grains to what happened to the water." },
    { id: "q6", stage: "CHECK THE EVIDENCE", prompt: "The material library says these are modelled results. What is one thing about a real soil sample or site that this simulator does not show?", hint: "Use the note about natural materials varying between samples and places." }
  ];
  const defaultWorkflowNotes = [
    "Choose three materials. Before running, note which you expect to pass water fastest and why.",
    "Keep water head, sample depth and compaction the same. Run your three materials together or one at a time with the same setup.",
    "At the same elapsed time, compare the labelled collected volumes on the graph's linear scale. Small values may be difficult to see when results differ greatly, so use the displayed mL values. Use that evidence for Form Q7.",
    "Compare pore space with flow, explain the grain pattern, then note one limit and one useful next test."
  ];
  const legacyGraphPrompt = "Which of your three materials let water move fastest? Use the graph as evidence: compare the lines at the same time, or describe which line rose most steeply.";
  const legacyGraphWorkflow = "At the same elapsed time, compare collected volume and line steepness. Use that evidence for Form Q7.";
  function migrateQuestionPrompts(prompts) {
    const source = Array.isArray(prompts) && prompts.length === questionBank.length ? prompts : questionBank.map((question) => question.prompt);
    return source.map((prompt, index) => index === 2 && prompt === legacyGraphPrompt ? questionBank[2].prompt : prompt);
  }
  function migrateWorkflowNotes(notes) {
    const source = Array.isArray(notes) && notes.length === defaultWorkflowNotes.length ? notes : defaultWorkflowNotes;
    return source.map((note, index) => index === 2 && note === legacyGraphWorkflow ? defaultWorkflowNotes[2] : note);
  }
  const defaultLearningIntention = "Compare how water moves through different materials and use the graph as evidence.";
  const introContent = {
    spaces: { label: "IDEA 1 · POROSITY", title: "Spaces between particles", copy: "Porosity means how much open space a material has. Imagine the gaps between grains as tiny rooms.", term: "porosity" },
    pathways: { label: "IDEA 2 · PERMEABILITY", title: "Can water find a path?", copy: "Permeability means how easily water moves through connected gaps. Many small rooms can hold water but still have narrow doorways.", term: "permeability" },
    fair: { label: "IDEA 3 · A FAIR TEST", title: "Change one thing at a time", copy: "To compare materials, keep water head, sample depth and compaction the same. Then the material is the main thing that changed.", term: "fair-test" }
  };
  const glossary = {
    porosity: { title: "Porosity", meaning: "How much open space is inside a material.", example: "A sponge has lots of spaces that can hold water." },
    permeability: { title: "Permeability", meaning: "How easily water can move through spaces that connect.", example: "A path with open gaps lets water pass more easily than a path with tiny, blocked gaps." },
    "hydraulic-conductivity": { title: "Hydraulic conductivity (K)", meaning: "A measure of how readily water moves through a material under stated conditions. In this activity, K is a representative model input, not a measurement of a real sample.", example: "In the same setup, an open material with connected gaps is modelled with a higher K than tightly packed clay." },
    "darcy-law": { title: "Darcy's law", meaning: "A relationship used to estimate water discharge through a porous material: Q = K × A × (Δh ÷ L). K describes how readily the material transmits water, A is the area water passes through, Δh is the water-level head difference, and L is the flow-path length. This classroom model simplifies real soil and rock.", example: "Picture water passing through a sponge. A higher water level can push it faster; a longer path or tighter material can slow it. Darcy's law combines these effects to estimate how much water passes each second." },
    "sample-area": { title: "Sample area (A)", meaning: "The cross-sectional area of the sample face that water passes through.", example: "A wider filter face gives water more area to pass through side by side." },
    "head-difference": { title: "Head difference (Δh)", meaning: "The difference in water head across the sample. It represents the pressure-related push that drives flow.", example: "Water flows from a higher tank level toward a lower outlet; a greater height difference gives a stronger push." },
    "sample-length": { title: "Sample length (L)", meaning: "The distance water travels through the sample in the direction of flow.", example: "Water takes a longer path through a deep soil layer than through a thin layer of the same material." },
    discharge: { title: "Discharge (Q)", meaning: "The volume of water passing through a given point each second. It is measured here in cubic metres per second.", example: "A tap that fills a bucket faster has a greater discharge." },
    "darcy-flux": { title: "Darcy flux (q/A)", meaning: "Discharge divided by the whole sample area. It describes flow per unit area; it is not the exact speed of water inside each pore.", example: "A sprinkler spreading the same water over a wider patch has a lower flow per square metre." },
    "water-head": { title: "Water head", meaning: "The height of water that pushes water through the sample.", example: "In the model, a higher water level gives a stronger push." },
    compaction: { title: "Compaction", meaning: "How tightly particles are pressed together.", example: "Pressing loose grains together can change the size and connections of gaps between them." },
    slope: { title: "Slope of the graph", meaning: "How quickly the line rises as time passes.", example: "A steeper line means more water was collected in the same amount of time." },
    "fair-test": { title: "Fair comparison", meaning: "A test where the other important settings stay the same while one thing changes.", example: "Keep water head, sample depth and compaction steady while you compare materials." },
    sediment: { title: "Sediment", meaning: "Small pieces of rock or other material moved and deposited by water, wind or ice.", example: "Sand can be moved by a river and later become part of a sedimentary rock." },
    "grain-size": { title: "Grain size", meaning: "How large or small the pieces in a material are.", example: "Gravel pieces are much larger than fine sand grains." },
    "material-gravel": { title: "Gravel", meaning: "A material made of relatively large rock fragments.", example: "Wide gaps between some gravel pieces can give water an open path." },
    "material-coarse_sand": { title: "Coarse sand", meaning: "Sand made of larger grains than fine sand.", example: "The larger grains can leave wider spaces between them." },
    "material-fine_sand": { title: "Fine sand", meaning: "Sand made of small grains.", example: "Fine grains usually leave smaller gaps than coarse sand grains." },
    "material-silt": { title: "Silt", meaning: "Very fine mineral particles, smaller than sand grains.", example: "Silt can feel smooth or floury when dry." },
    "material-clay": { title: "Clay", meaning: "Soil with extremely small mineral particles.", example: "Clay can have many tiny spaces but water may move through them slowly." },
    "material-loam": { title: "Loam", meaning: "A soil mix with sand, silt, clay and often organic matter.", example: "The mix can create a variety of pore sizes and pathways." },
    "material-laterite": { title: "Laterite", meaning: "A strongly weathered soil or rock material found in parts of Western Australia.", example: "Laterite can vary a lot from one place or sample to another." },
    "material-tamala_limestone": { title: "Tamala Limestone", meaning: "A limestone formation in the Perth region.", example: "Water movement can differ between intact pieces and places with cracks or cavities." },
    "material-granite": { title: "Granite", meaning: "An igneous rock formed when magma cools slowly underground.", example: "Granite has visible mineral crystals; cracks can create water pathways." },
    "material-sandstone": { title: "Sandstone", meaning: "A sedimentary rock made from sand-sized grains joined together.", example: "The spaces left between grains depend partly on how tightly they are cemented." }
  };

  function createId(prefix = "item") {
    const bytes = new Uint8Array(5);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    return `${prefix}-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  function cleanStudentName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 50); }
  function makeStudent(value) {
    const name = cleanStudentName(value);
    return { id: createId("learner"), name, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), progress: "Not started", percent: 0, score: "—", answers: {}, submitted: false, completedMaterials: [], events: [], marks: {}, feedback: {}, lastSeen: null, activity: null };
  }
  function normalizeStudent(student) {
    const result = { ...makeStudent(student?.name || "Learner"), ...student };
    result.name = cleanStudentName(student?.name || "Learner");
    result.id = student?.id || createId("learner");
    result.initials = result.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    result.answers = student?.answers && typeof student.answers === "object" ? student.answers : {};
    result.events = Array.isArray(student?.events) ? student.events.slice(-600) : [];
    result.marks = student?.marks && typeof student.marks === "object" ? student.marks : {};
    result.feedback = student?.feedback && typeof student.feedback === "object" ? student.feedback : {};
    result.completedMaterials = Array.isArray(student?.completedMaterials) ? student.completedMaterials : [];
    return result;
  }
  function makeClass(name, code, learners = []) {
    return {
      id: createId("class"), name: String(name || "New class").trim().slice(0, 80), code: code || "RIVER7", teacherCode: generateTeacherRecoveryCode(),
      students: learners.map(normalizeStudent), lessonTitle: "Where does the water go?",
      lessonIntentions: defaultLearningIntention,
      lessonDescription: "Choose three materials. Keep the setup the same and record what changes.",
      questionPrompts: questionBank.map((question) => question.prompt), workflowNotes: [...defaultWorkflowNotes],
      published: false, classClosed: false, events: [], draftAnswers: {}, activity: null
    };
  }
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}"); } catch { saved = {}; }
  const exampleRosterNames = new Set(["ava martin", "noah williams", "isla thompson", "leo wilson"]);
  const oldStudents = Array.isArray(saved.students) ? saved.students.map(normalizeStudent).filter((student) => {
    const joinedBefore = (saved.events || []).some((event) => event.type === "student_joined" && String(event.payload?.name || "").toLocaleLowerCase() === student.name.toLocaleLowerCase());
    const hasLearnerWork = Object.values(student.answers || {}).some((answer) => String(answer || "").trim()) || student.events.length || student.activity || joinedBefore;
    return !exampleRosterNames.has(student.name.toLocaleLowerCase()) || hasLearnerWork;
  }) : [];
  const storedClasses = Array.isArray(saved.classes) ? saved.classes.filter((item) => item && typeof item === "object").map((item) => {
    const fresh = makeClass(item.name, item.code, []);
    const savedName = String(item.name || fresh.name).trim().replace(/\s+/g, " ").slice(0, 80);
    return { ...fresh, ...item, id: item.id || fresh.id, name: savedName === "Water & the land" ? "Class name" : savedName, code: String(item.code || fresh.code).toUpperCase(), teacherCode: String(item.teacherCode || fresh.teacherCode).toUpperCase(), lessonIntentions: String(item.lessonIntentions || defaultLearningIntention), students: (Array.isArray(item.students) ? item.students : []).map(normalizeStudent), questionPrompts: migrateQuestionPrompts(item.questionPrompts || fresh.questionPrompts), workflowNotes: migrateWorkflowNotes(item.workflowNotes || fresh.workflowNotes) };
  }) : [];
  const needsFirstClassCodeSave = !storedClasses.length && !saved.classCode;
  const needsTeacherCodeSave = storedClasses.length ? storedClasses.some((item) => !item.teacherCode) : !saved.teacherCode;
  const classRecords = storedClasses.length ? storedClasses : [Object.assign(makeClass(saved.className && saved.className !== "Water & the land" ? saved.className : "Class name", saved.classCode || generateClassCode(), oldStudents), {
    lessonTitle: typeof saved.lessonTitle === "string" ? saved.lessonTitle : "Where does the water go?",
    lessonIntentions: typeof saved.lessonIntentions === "string" ? saved.lessonIntentions : defaultLearningIntention,
    lessonDescription: typeof saved.lessonDescription === "string" ? saved.lessonDescription : "Choose three materials. Keep the setup the same and record what changes.",
    questionPrompts: migrateQuestionPrompts(saved.questionPrompts),
    workflowNotes: migrateWorkflowNotes(saved.workflowNotes),
    published: Boolean(saved.published), classClosed: Boolean(saved.classClosed), events: Array.isArray(saved.events) ? saved.events : [], draftAnswers: saved.answers || {}, teacherCode: String(saved.teacherCode || generateTeacherRecoveryCode()).toUpperCase()
  })];
  const activeClassId = classRecords.some((item) => item.id === saved.activeClassId) ? saved.activeClassId : classRecords[0].id;
  const initialClass = classRecords.find((item) => item.id === activeClassId) || classRecords[0];
  const initialActivity = initialClass.activity && typeof initialClass.activity === "object" ? initialClass.activity : saved;
  const routeParams = new URLSearchParams(window.location.search);
  const joiningFromLink = routeParams.get("mode") === "join";
  const state = {
    view: joiningFromLink ? "join" : saved.introDone ? "explore" : "intro",
    introDone: Boolean(saved.introDone),
    introStep: "spaces",
    questionPrompts: Array.isArray(initialClass.questionPrompts) && initialClass.questionPrompts.length === questionBank.length ? initialClass.questionPrompts : questionBank.map((q) => q.prompt),
    workflowNotes: Array.isArray(initialClass.workflowNotes) && initialClass.workflowNotes.length === defaultWorkflowNotes.length ? initialClass.workflowNotes : defaultWorkflowNotes,
    grainModel: Number.isFinite(saved.grainModel) ? saved.grainModel : 50,
    pathModel: Number.isFinite(saved.pathModel) ? saved.pathModel : 50,
    mode: initialActivity.mode === "advanced" ? "advanced" : "simple",
    selected: materialById[initialActivity.selected] ? initialActivity.selected : "gravel",
    headCm: Number.isFinite(initialActivity.headCm) ? initialActivity.headCm : 15,
    depthCm: Number.isFinite(initialActivity.depthCm) ? initialActivity.depthCm : 10,
    compaction: Number.isFinite(initialActivity.compaction) ? initialActivity.compaction : 0,
    comparison: Array.isArray(initialActivity.comparison) ? initialActivity.comparison.filter((id) => materialById[id]).slice(0, 2) : [],
    elapsed: Number.isFinite(initialActivity.elapsed) ? Math.max(0, Math.min(120, initialActivity.elapsed)) : 0,
    hasRun: Boolean(initialActivity.hasRun),
    series: initialActivity.series && typeof initialActivity.series === "object" ? initialActivity.series : {},
    history: Array.isArray(initialActivity.history) ? initialActivity.history.slice(0, 15) : [],
    historyOverlays: Array.isArray(initialActivity.historyOverlays) ? initialActivity.historyOverlays : [],
    running: false,
    lastTick: 0,
    nextSampleAt: 1,
    nextSnapshotAt: 15,
    completedMaterials: new Set(Array.isArray(initialActivity.completedMaterials) ? initialActivity.completedMaterials : []),
    answers: initialClass.draftAnswers && typeof initialClass.draftAnswers === "object" ? initialClass.draftAnswers : saved.answers && typeof saved.answers === "object" ? saved.answers : {},
    submitted: Boolean(saved.submitted),
    students: initialClass.students,
    events: Array.isArray(initialClass.events) ? initialClass.events.slice(-600) : Array.isArray(saved.events) ? saved.events.slice(-600) : [],
    published: Boolean(initialClass.published),
    lessonTitle: typeof initialClass.lessonTitle === "string" ? initialClass.lessonTitle : "Where does the water go?",
    lessonIntentions: typeof initialClass.lessonIntentions === "string" ? initialClass.lessonIntentions : defaultLearningIntention,
    lessonDescription: typeof initialClass.lessonDescription === "string" ? initialClass.lessonDescription : "Choose three materials. Keep the setup the same and record what changes.",
    classClosed: Boolean(initialClass.classClosed),
    classRecords,
    activeClassId,
    currentStudentId: joiningFromLink && typeof sessionStorage.getItem(STUDENT_SESSION_KEY) === "string" && initialClass.students.some((student) => student.id === sessionStorage.getItem(STUDENT_SESSION_KEY)) ? sessionStorage.getItem(STUDENT_SESSION_KEY) : null,
    teacherPreview: joiningFromLink && routeParams.get("teacherPreview") === "1",
    selectedReplayStudentId: "",
    idle: false,
    lastActivity: Date.now()
  };
  function activeClass() { return state.classRecords.find((item) => item.id === state.activeClassId) || state.classRecords[0]; }
  function currentStudent() { return state.students.find((student) => student.id === state.currentStudentId) || null; }
  function studentJoinUrl(options = {}) {
    const url = new URL("?mode=join", window.location.href);
    const code = options.code || activeClass()?.code;
    if (code) url.searchParams.set("code", code);
    if (options.teacherPreview) {
      url.searchParams.set("teacherPreview", "1");
    }
    return url;
  }
  function renderStudentAccess() {
    const student = currentStudent();
    $("#header-view-identity").textContent = student?.name || (state.view === "join" ? "Join your class" : "Teacher View");
    $("#header-class-code").textContent = activeClass()?.code || "—";
    $("#topbar-class-name").textContent = activeClass()?.name || "Fieldnotes";
    const joinUrl = studentJoinUrl();
    const link = $("#header-student-url");
    link.href = joinUrl.href;
    $("#header-student-url-text").textContent = joinUrl.href;
    link.title = joinUrl.href;
    const isStudent = Boolean(student) || state.view === "join";
    $("[data-view='teacher']").hidden = isStudent;
    $(".join-shortcut").hidden = isStudent;
    $(".header-join-button").hidden = isStudent;
    link.hidden = isStudent;
    $("#header-qr-code").hidden = isStudent;
    $("#return-teacher-view").hidden = !(isStudent && state.teacherPreview);
  }
  if (state.currentStudentId) {
    const returningLearner = currentStudent();
    state.answers = returningLearner?.answers || state.answers;
    state.submitted = Boolean(returningLearner?.submitted);
    state.events = returningLearner?.events?.length ? returningLearner.events.slice(-600) : state.events;
    if (returningLearner?.activity) {
      const savedActivity = returningLearner.activity;
      state.selected = materialById[savedActivity.selected] ? savedActivity.selected : state.selected;
      state.comparison = Array.isArray(savedActivity.comparison) ? savedActivity.comparison.filter((id) => materialById[id]).slice(0, 2) : state.comparison;
      state.headCm = Number.isFinite(savedActivity.headCm) ? savedActivity.headCm : state.headCm;
      state.depthCm = Number.isFinite(savedActivity.depthCm) ? savedActivity.depthCm : state.depthCm;
      state.compaction = Number.isFinite(savedActivity.compaction) ? savedActivity.compaction : state.compaction;
      state.elapsed = Number.isFinite(savedActivity.elapsed) ? Math.max(0, Math.min(120, savedActivity.elapsed)) : state.elapsed;
      state.hasRun = Boolean(savedActivity.hasRun);
      state.series = savedActivity.series && typeof savedActivity.series === "object" ? savedActivity.series : state.series;
      state.history = Array.isArray(savedActivity.history) ? savedActivity.history.slice(0, 15) : state.history;
      state.historyOverlays = Array.isArray(savedActivity.historyOverlays) ? savedActivity.historyOverlays : state.historyOverlays;
      state.completedMaterials = new Set(Array.isArray(savedActivity.completedMaterials) ? savedActivity.completedMaterials : []);
      state.mode = savedActivity.mode === "advanced" ? "advanced" : "simple";
    }
  }
  function captureClassState() {
    const record = activeClass();
    if (!record) return;
    record.updatedAt = Date.now();
    if (!record.createdAt) record.createdAt = record.updatedAt;
    record.students = state.students;
    record.lessonTitle = state.lessonTitle;
    record.lessonIntentions = state.lessonIntentions;
    record.lessonDescription = state.lessonDescription;
    record.questionPrompts = [...state.questionPrompts];
    record.workflowNotes = [...state.workflowNotes];
    record.published = state.published;
    record.classClosed = state.classClosed;
    record.events = state.events.slice(-600);
    record.draftAnswers = state.answers;
    if (!state.currentStudentId) record.activity = { selected: state.selected, comparison: [...state.comparison], headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction, elapsed: state.elapsed, hasRun: state.hasRun, series: state.series, history: state.history, historyOverlays: state.historyOverlays, completedMaterials: Array.from(state.completedMaterials), mode: state.mode };
    const learner = currentStudent();
    if (learner) {
      learner.answers = state.answers;
      learner.submitted = state.submitted;
      learner.events = state.events.slice(-600);
      learner.completedMaterials = Array.from(state.completedMaterials);
      learner.activity = { selected: state.selected, comparison: [...state.comparison], headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction, elapsed: state.elapsed, hasRun: state.hasRun, series: state.series, history: state.history, historyOverlays: state.historyOverlays, completedMaterials: Array.from(state.completedMaterials), mode: state.mode };
      learner.lastSeen = Date.now();
      const answered = questionBank.filter((question) => String(learner.answers[question.id] ?? "").trim()).length;
      const tested = Math.min(3, learner.completedMaterials.length);
      learner.percent = Math.round((tested / 3 * 55) + (answered / questionBank.length * 45));
      learner.progress = learner.submitted ? "Submitted" : tested || answered ? "Working" : "Not started";
      const marked = Object.values(learner.marks || {}).filter(Boolean);
      learner.score = marked.length ? `${marked.filter((mark) => mark === "correct").length} / ${marked.length} marked` : learner.submitted ? `${answered} / 6 saved` : "—";
    }
  }

  function persist() {
    captureClassState();
    const copy = {
      mode: state.mode, selected: state.selected, headCm: state.headCm,
      depthCm: state.depthCm, compaction: state.compaction,
      comparison: state.comparison, elapsed: state.elapsed, hasRun: state.hasRun,
      series: state.series, history: state.history, historyOverlays: state.historyOverlays, completedMaterials: Array.from(state.completedMaterials),
      answers: state.answers, submitted: state.submitted, students: state.students,
      introDone: state.introDone, questionPrompts: state.questionPrompts, workflowNotes: state.workflowNotes,
      grainModel: state.grainModel, pathModel: state.pathModel,
      events: state.events.slice(-600), published: state.published,
      lessonTitle: state.lessonTitle, lessonDescription: state.lessonDescription,
      lessonIntentions: state.lessonIntentions,
      classClosed: state.classClosed, classes: state.classRecords, activeClassId: state.activeClassId,
      currentStudentId: state.currentStudentId, className: activeClass()?.name, classCode: activeClass()?.code, teacherCode: activeClass()?.teacherCode
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); } catch { /* The activity still works if storage is unavailable. */ }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function getMaterial(id = state.selected) { return materialById[id] || materialById.clay; }
  function activeMaterialIds() { return [state.selected, ...state.comparison].filter((id, index, list) => list.indexOf(id) === index); }
  function materialIllustration(material, decorative = false) {
    const label = `${material.label} material illustration`;
    let texture = "";
    if (material.id === "gravel") {
      const stones = [[21,22,12,9],[52,20,10,8],[84,25,13,10],[108,19,9,7],[35,49,14,10],[70,50,11,8],[101,48,13,10],[15,56,8,6]];
      texture = stones.map(([x,y,rx,ry],i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${i%2?"#aa9873":"#c1ae88"}" stroke="#8f8063" stroke-width="1"/>`).join("");
    } else if (["coarse_sand","fine_sand","silt","clay","loam","laterite"].includes(material.id)) {
      const seed = material.id.split("").reduce((n,c)=>n+c.charCodeAt(0),0);
      const count = material.id === "coarse_sand" ? 46 : material.id === "fine_sand" ? 92 : material.id === "silt" ? 138 : material.id === "clay" ? 160 : material.id === "loam" ? 54 : 48;
      for (let i=0;i<count;i+=1) {
        const x=7+((i*37+seed*3)%106), y=7+((i*23+seed)%56);
        const base = material.id === "coarse_sand" ? 2.8 : material.id === "fine_sand" ? 1.7 : material.id === "silt" ? .95 : material.id === "clay" ? .78 : material.id === "loam" ? 1.5+(i%4)*.8 : 2+(i%4)*.75;
        const r=base+((i*7)%5)*.22;
        const fill=material.id === "laterite" ? (i%5===0?"#e0a16e":i%3===0?"#923f2f":"#b85b3f") : material.id === "clay" ? (i%4===0?"#9b685a":"#bd8972") : material.id === "loam" ? ["#a48b63","#78634c","#c3a16d","#987659"][i%4] : ["#c5a66d","#b9945d","#dfc48d","#aa8c5d"][i%4];
        texture += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${fill}" opacity="${material.id === "silt" ? ".72" : ".9"}"/>`;
      }
      if (material.id === "clay") texture += `<path d="M14 23c13-9 20 10 33 1s22 9 35 0 17 5 27-1M12 46c12-7 18 9 32 1s19 8 33 0 22 7 31-1" fill="none" stroke="#7eaaa2" stroke-width="1.3" stroke-dasharray="2 4" opacity=".75"/>`;
      if (material.id === "laterite") texture += `<path d="M14 18l20 2m36 26 23-4M53 11l13 3" stroke="#efc092" stroke-width="1.5" opacity=".7"/>`;
    } else if (material.id === "tamala_limestone") {
      texture = `<path d="M8 19 18 9l25 3 12-4 20 6 17-2 13 12-3 24-18 12-20-4-17 5-21-6-17 4-7-16Z" fill="#d4c4a0" stroke="#9f9276" stroke-width="1.4"/><path d="M26 36c1-10 16-12 20-2 4 11-12 15-18 8m3-8c5-4 11 1 8 6m29-15c1-8 13-9 15-1 2 7-9 12-14 6m-43 24 9-5m35-4 13 6" fill="none" stroke="#a99a7d" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="29" r="4" fill="#f1e5c7"/><circle cx="94" cy="41" r="3" fill="#efe2c4"/>`;
    } else if (material.id === "granite") {
      texture = `<path d="M8 17 22 8l21 3 17-5 18 8 22-1 12 13-4 23-18 10-20-4-17 6-18-7-20 4-9-18Z" fill="#929891" stroke="#747e78" stroke-width="1.5"/>`;
      for(let i=0;i<58;i+=1){const x=13+((i*31+7)%94),y=13+((i*19+13)%43),r=.7+(i%3)*.45;texture+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${i%3===0?"#e2d7bd":i%3===1?"#4d5e61":"#d5e2dc"}" opacity=".9"/>`;}
      texture += `<path d="m41 15 5 5-4 5m29 19 4-5 5 1" fill="none" stroke="#f4ead2" stroke-width="1.5"/>`;
    } else if (material.id === "sandstone") {
      texture = `<path d="M8 18 22 9l19 4 17-6 17 8 24-2 13 10-3 27-19 10-17-4-17 5-18-6-18 3-11-17Z" fill="#c49b74" stroke="#9b7758" stroke-width="1.4"/><path d="M13 24c18-5 33 5 49 0s31 4 49-1M12 42c16-4 29 3 43 0s31 4 55-1" fill="none" stroke="#e0bd91" stroke-width="2" opacity=".85"/>`;
      for(let i=0;i<38;i+=1){const x=13+((i*29+3)%95),y=17+((i*17+4)%43);texture+=`<circle cx="${x}" cy="${y}" r="${1+(i%3)*.45}" fill="${i%2?"#8e6e54":"#e4c59d"}" opacity=".8"/>`;}
    }
    const accessible = decorative ? "aria-hidden=\"true\" focusable=\"false\"" : `role=\"img\" aria-label=\"${escapeHtml(label)}\"`;
    return `<svg viewBox="0 0 120 72" ${accessible}><title>${escapeHtml(label)}</title><rect x="1" y="1" width="118" height="70" rx="9" fill="${material.id === "granite" ? "#dfe3df" : material.id === "laterite" ? "#ead6c3" : "#f0eadb"}"/>${texture}<rect x="1" y="1" width="118" height="70" rx="9" fill="none" stroke="#d9d7cb"/></svg>`;
  }

  function renderCustomPicker(wrapperId, menuId, triggerId, currentId, options, selectedId, prompt = "") {
    const wrapper = $(`#${wrapperId}`);
    const menu = $(`#${menuId}`);
    const trigger = $(`#${triggerId}`);
    const current = $(`#${currentId}`);
    const selected = options.find((material) => material.id === selectedId);
    current.innerHTML = selected ? `<span class="material-thumb current-thumb">${materialIllustration(selected, true)}</span><span class="material-current-copy"><strong>${escapeHtml(selected.label)}</strong><small>${escapeHtml(selected.category)}</small></span>` : `<span class="picker-prompt">${escapeHtml(prompt)}</span>`;
    trigger.setAttribute("aria-label", selected ? `${prompt || "Material"}: ${selected.label}` : prompt);
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
    menu.innerHTML = options.map((material) => `<div class="material-option" role="option" tabindex="-1" aria-selected="${material.id === selectedId}" data-material-option="${material.id}"><span class="material-thumb">${materialIllustration(material, true)}</span><span class="material-option-copy"><strong>${escapeHtml(material.label)}</strong><small>${escapeHtml(material.category)}</small></span></div>`).join("");
    wrapper.classList.toggle("is-open", !menu.hidden);
  }

  function setPickerOpen(wrapperId, menuId, triggerId, open, focusSelected = false, returnFocus = false) {
    const wrapper = $(`#${wrapperId}`);
    const menu = $(`#${menuId}`);
    const trigger = $(`#${triggerId}`);
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    wrapper.classList.toggle("is-open", open);
    if (open && focusSelected) (menu.querySelector('[aria-selected="true"]') || menu.querySelector('[role="option"]'))?.focus();
    if (!open && returnFocus) trigger.focus({ preventScroll: true });
  }

  function wirePicker(wrapperId, menuId, triggerId, selectId, onChoose) {
    const wrapper = $(`#${wrapperId}`), menu = $(`#${menuId}`), trigger = $(`#${triggerId}`), select = $(`#${selectId}`);
    trigger.addEventListener("click", () => setPickerOpen(wrapperId, menuId, triggerId, menu.hidden, menu.hidden));
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown","ArrowUp","Enter"," "].includes(event.key)) { event.preventDefault(); setPickerOpen(wrapperId, menuId, triggerId, true, true); }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-material-option]");
      if (!option) return;
      onChoose(option.dataset.materialOption, select);
      setPickerOpen(wrapperId, menuId, triggerId, false, false, true);
    });
    menu.addEventListener("keydown", (event) => {
      const options = Array.from(menu.querySelectorAll('[role="option"]'));
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); setPickerOpen(wrapperId, menuId, triggerId, false, false, true); }
      else if (["ArrowDown","ArrowUp","Home","End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      } else if (["Enter"," "].includes(event.key) && index >= 0) {
        event.preventDefault(); onChoose(options[index].dataset.materialOption, select); setPickerOpen(wrapperId, menuId, triggerId, false, false, true);
      }
    });
    wrapper.addEventListener("focusout", (event) => { if (!wrapper.contains(event.relatedTarget)) setPickerOpen(wrapperId, menuId, triggerId, false); });
  }

  function compactionFactor(material, compaction = state.compaction) {
    const amount = compaction / 100;
    const base = Math.max(.08, 1 - amount * .72);
    return Math.pow(base, material.sensitivity > .75 ? 2.15 : 1.15);
  }
  function effectiveK(material, compaction = state.compaction) { return material.k * compactionFactor(material, compaction); }
  function effectivePorosity(material, compaction = state.compaction) { return Math.max(1, material.porosity - (compaction / 100) * 18); }
  function hydraulics(material, settings = null) {
    const current = settings || state;
    const k = effectiveK(material, current.compaction);
    const headM = current.headCm / 100;
    const lengthM = current.depthCm / 100;
    const gradient = headM / lengthM;
    const qM3s = k * AREA_M2 * gradient;
    return { k, headM, lengthM, gradient, qM3s, qMlSec: qM3s * 1e6, qMlMin: qM3s * 6e7, darcyFlux: k * gradient };
  }
  function porosityBand(value) { return value < 20 ? "Low" : value < 40 ? "Medium" : "High"; }
  function flowBand(qMlMin) { return qMlMin < .1 ? "Slow" : qMlMin < 30 ? "Steady" : "Fast"; }
  function formatScientific(value) {
    if (!Number.isFinite(value) || value === 0) return "0";
    return value.toExponential(2).replace("e-", " × 10⁻").replace("e+", " × 10").replace(/(\d\.\d)0(?= ×)/, "$1");
  }
  function formatVolume(value) {
    if (value === 0) return "0.000";
    if (value < .001) return value.toFixed(5);
    if (value < 1) return value.toFixed(3);
    if (value < 100) return value.toFixed(2);
    return value.toFixed(1);
  }
  function formatAxis(value, max) {
    if (value === 0) return "0";
    if (value < .001) return value.toExponential(0).replace("e-", "e−");
    if (value < 1) return value.toFixed(3);
    if (value < 10) return value.toFixed(2);
    if (value < 100) return value.toFixed(1);
    return value.toFixed(0);
  }
  function niceCeil(value) {
    if (!Number.isFinite(value) || value <= 0) return .01;
    const exponent = Math.floor(Math.log10(value));
    const power = Math.pow(10, exponent);
    const fraction = value / power;
    const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return step * power;
  }

  function niceStep(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const power = Math.pow(10, exponent);
    const fraction = value / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  }

  function currentFlowSettings() {
    return { headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction };
  }

  function appendSeriesPoint(series, t, volume) {
    const point = { t, v: volume };
    const last = series.points[series.points.length - 1];
    if (last && Math.abs(last.t - t) < 1e-7) series.points[series.points.length - 1] = point;
    else series.points.push(point);
  }

  function addSimulationEvent(id) {
    const series = state.series[id];
    if (!series) return;
    series.events ||= [];
    series.points ||= [{ t: 0, v: 0 }];
    const material = getMaterial(id);
    const event = { t: state.elapsed, v: series.volume, rate: hydraulics(material).qMlSec, settings: currentFlowSettings() };
    const last = series.events[series.events.length - 1];
    if (last && Math.abs(last.t - event.t) < 1e-7) series.events[series.events.length - 1] = event;
    else series.events.push(event);
    appendSeriesPoint(series, event.t, event.v);
  }

  function volumeAt(id, time) {
    const points = state.series[id]?.points || [];
    if (!points.length || time <= points[0].t) return 0;
    for (let i = 1; i < points.length; i += 1) {
      const right = points[i];
      if (time <= right.t) {
        const left = points[i - 1];
        const span = right.t - left.t;
        return span > 0 ? left.v + (right.v - left.v) * ((time - left.t) / span) : right.v;
      }
    }
    return points[points.length - 1].v;
  }

  function recordedUntil() {
    return Math.max(0, ...activeMaterialIds().map((id) => {
      const points = state.series[id]?.points || [];
      return points[points.length - 1]?.t || 0;
    }));
  }

  function logEvent(type, payload = {}) {
    const event = { seq: (state.events.at(-1)?.seq || 0) + 1, timestampMs: Date.now(), elapsed: state.elapsed, type, payload };
    state.events.push(event);
    if (state.events.length > 600) state.events.shift();
    persist();
    updateReplayControls();
  }

  function resetForSeriesChange() {
    state.running = false;
    state.elapsed = 0;
    state.hasRun = false;
    state.series = {};
    state.nextSampleAt = 1;
    state.nextSnapshotAt = 15;
  }

  function archiveCurrentTrial(reason = "") {
    if (!state.hasRun || state.elapsed <= 0) return false;
    const series = structuredCloneSafe(state.series);
    activeMaterialIds().forEach((id) => {
      if (!series[id]) return;
      const points = series[id].points || (series[id].points = [{ t: 0, v: 0 }]);
      const last = points[points.length - 1];
      if (!last || last.t < state.elapsed) points.push({ t: state.elapsed, v: series[id].volume || 0 });
    });
    const attempt = {
      id: `trial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: Date.now(), reason, elapsed: state.elapsed, selected: state.selected,
      comparison: [...state.comparison], materials: activeMaterialIds(), headCm: state.headCm,
      depthCm: state.depthCm, compaction: state.compaction, series
    };
    state.history.unshift(attempt);
    state.history = state.history.slice(0, 15);
    state.historyOverlays = state.historyOverlays.filter((key) => state.history.some((item) => key.startsWith(`${item.id}::`)));
    logEvent("trial_saved", { attemptId: attempt.id, elapsed: attempt.elapsed, materials: attempt.materials, reason });
    renderActivityHistory();
    persist();
    return true;
  }

  function restartTrialForSettingsChange(reason) {
    const changedDuringTrial = state.running || state.elapsed > 0;
    if (state.running) {
      settleClock(performance.now());
      state.running = false;
      logEvent("flow_paused", { elapsed: state.elapsed, reason });
    }
    if (changedDuringTrial) {
      archiveCurrentTrial(reason);
      resetForSeriesChange();
      logEvent("trial_reset", { reason });
    }
    return changedDuringTrial;
  }

  function initializeSeries() {
    state.series = {};
    state.elapsed = 0;
    activeMaterialIds().forEach((id) => {
      state.series[id] = { volume: 0, points: [{ t: 0, v: 0 }], events: [] };
      addSimulationEvent(id);
    });
    state.hasRun = true;
    state.nextSampleAt = 1;
    state.nextSnapshotAt = 15;
  }

  function settleClock(now = performance.now()) {
    if (!state.running || !state.lastTick) return;
    const dt = Math.max(0, Math.min((now - state.lastTick) / 1000, 4));
    if (!dt) return;
    state.lastTick = now;
    const startTime = state.elapsed;
    const endTime = Math.min(120, startTime + dt);
    const actualDt = endTime - startTime;
    if (actualDt <= 0) { state.running = false; return; }
    const sampleTimes = [];
    while (state.nextSampleAt <= endTime) {
      if (state.nextSampleAt > startTime) sampleTimes.push(state.nextSampleAt);
      state.nextSampleAt += 1;
    }
    activeMaterialIds().forEach((id) => {
      if (!state.series[id]) state.series[id] = { volume: 0, points: [{ t: 0, v: 0 }], events: [] };
      const series = state.series[id];
      const rate = hydraulics(getMaterial(id)).qMlSec;
      const startingVolume = series.volume;
      series.volume += rate * actualDt;
      sampleTimes.forEach((time) => appendSeriesPoint(series, time, startingVolume + rate * (time - startTime)));
      if (endTime >= 120) appendSeriesPoint(series, 120, series.volume);
    });
    state.elapsed = endTime;
    if (state.elapsed >= state.nextSnapshotAt) {
      logEvent("state_snapshot", { selected: state.selected, headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction, comparison: [...state.comparison], series: structuredCloneSafe(state.series), mode: state.mode });
      state.nextSnapshotAt = Math.floor(state.elapsed / 15 + 1) * 15;
    }
    if (state.elapsed >= 120) state.running = false;
  }

  function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }

  function setRunning(shouldRun) {
    if (shouldRun && state.hasRun && state.elapsed < recordedUntil() - 1e-6) {
      showToast("Return to the latest recorded time before continuing the trial.");
      return;
    }
    if (shouldRun && !state.hasRun) initializeSeries();
    if (shouldRun === state.running) return;
    if (shouldRun) {
      state.running = true;
      state.lastTick = performance.now();
      state.completedMaterials.add(state.selected);
      state.comparison.forEach((id) => state.completedMaterials.add(id));
      logEvent("flow_started", { selected: state.selected, comparison: [...state.comparison], headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction, series: structuredCloneSafe(state.series) });
    } else {
      settleClock(performance.now());
      state.running = false;
      activeMaterialIds().forEach((id) => {
        const series = state.series[id];
        if (series) appendSeriesPoint(series, state.elapsed, series.volume);
      });
      logEvent("flow_paused", { elapsed: state.elapsed, series: structuredCloneSafe(state.series) });
    }
    persist();
    renderAll();
  }

  function resetTrial() {
    if (state.running) settleClock(performance.now());
    if (state.running) {
      state.running = false;
      logEvent("flow_paused", { elapsed: state.elapsed, series: structuredCloneSafe(state.series) });
    }
    const savedAttempt = archiveCurrentTrial("reset");
    resetForSeriesChange();
    logEvent("trial_reset", {});
    renderAll();
    showToast(savedAttempt ? "Trial reset. Results saved in Activity History." : "Trial reset. Your setup is ready.");
  }

  function seekTrialTo(seconds, recordEvent = false) {
    const target = Math.max(0, Math.min(Number($("#trial-scrubber").max), Number(seconds) || 0));
    state.running = false;
    state.lastTick = 0;
    if (state.hasRun && target > recordedUntil()) {
      const startTime = recordedUntil();
      const duration = target - startTime;
      const sampleTimes = [];
      const firstSample = Math.max(1, Math.floor(startTime) + 1);
      for (let time = firstSample; time <= target; time += 1) sampleTimes.push(time);
      activeMaterialIds().forEach((id) => {
        const series = state.series[id];
        if (!series) return;
        const startVolume = series.volume;
        const rate = hydraulics(getMaterial(id)).qMlSec;
        sampleTimes.forEach((time) => appendSeriesPoint(series, time, startVolume + rate * (time - startTime)));
        series.volume = startVolume + rate * duration;
        appendSeriesPoint(series, target, series.volume);
      });
      state.nextSampleAt = Math.floor(target) + 1;
    }
    state.elapsed = target;
    state.hasRun = activeMaterialIds().some((id) => (state.series[id]?.points?.length || 0) > 1);
    activeMaterialIds().forEach((id) => { if (state.hasRun && target > 0) state.completedMaterials.add(id); });
    if (target >= recordedUntil()) state.nextSnapshotAt = Math.floor(target / 15 + 1) * 15;
    updateExperimentStatus();
    renderChart();
    renderAdvanced();
    renderProgress();
    if (recordEvent) {
      logEvent("time_seeked", { elapsed: target, hasRun: state.hasRun, series: structuredCloneSafe(state.series), headCm: state.headCm, depthCm: state.depthCm, compaction: state.compaction });
      persist();
      showToast(`Model moved to ${formatClock(target)}.`);
    }
  }

  function renderMaterialOptions() {
    const select = $("#material-select");
    const compare = $("#compare-select");
    if (!select.dataset.ready) {
      select.innerHTML = materials.map((m) => `<option value="${m.id}">${escapeHtml(m.label)} · ${escapeHtml(m.category)}</option>`).join("");
      select.dataset.ready = "true";
    }
    select.value = state.selected;
    const available = materials.filter((m) => m.id !== state.selected && !state.comparison.includes(m.id));
    const previous = compare.value;
    compare.innerHTML = `<option value="">Choose another material</option>${available.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join("")}`;
    if (available.some((m) => m.id === previous)) compare.value = previous;
    renderCustomPicker("material-picker", "material-picker-menu", "material-picker-trigger", "material-picker-current", materials, state.selected, "Choose a material");
    renderCustomPicker("compare-picker", "compare-picker-menu", "compare-picker-trigger", "compare-picker-current", available, compare.value, "Choose another material");
  }

  function renderCompareChips() {
    const target = $("#compare-chips");
    target.innerHTML = state.comparison.map((id) => {
      const material = getMaterial(id);
      const color = GRAPH_COLORS[activeMaterialIds().indexOf(id) % GRAPH_COLORS.length];
      return `<span class="compare-chip"><i class="legend-dot" style="background:${color}"></i>${escapeHtml(material.label)}<button type="button" data-remove-compare="${id}" aria-label="Remove ${escapeHtml(material.label)} from comparison">×</button></span>`;
    }).join("");
  }

  function renderAdvanced() {
    const material = getMaterial();
    const h = hydraulics(material);
    const porosity = effectivePorosity(material);
    $("#advanced-readout").hidden = state.mode !== "advanced";
    $("#k-value").textContent = `${formatScientific(h.k)} m/s`;
    $("#porosity-value").textContent = `${porosity.toFixed(1)}%`;
    $("#area-value").textContent = `${AREA_M2.toExponential(1)} m²`;
    $("#head-value").textContent = `${h.headM.toFixed(3)} m`;
    $("#length-value").textContent = `${h.lengthM.toFixed(3)} m`;
    $("#q-value").textContent = `${formatScientific(h.qM3s)} m³/s`;
    $("#v-value").textContent = `${formatScientific(h.darcyFlux)} m/s`;
    $("#equation-value").textContent = `Q = ${formatScientific(h.k)} × ${AREA_M2.toExponential(1)} × (${h.headM.toFixed(3)} ÷ ${h.lengthM.toFixed(3)})`;
    renderSelectedMaterialModel(material, h, porosity);
    $("#advanced-mode").classList.toggle("selected", state.mode === "advanced");
    $("#simple-mode").classList.toggle("selected", state.mode === "simple");
    $("#advanced-mode").setAttribute("aria-pressed", state.mode === "advanced");
    $("#simple-mode").setAttribute("aria-pressed", state.mode === "simple");
  }

  function renderSelectedMaterialModel(material, h, porosity) {
    renderCompareMaterialReadouts();
  }

  function renderCompareMaterialReadouts() {
    const container = $("#compare-material-readouts");
    if (!container) return;
    container.innerHTML = activeMaterialIds().map((id) => {
      const material = getMaterial(id);
      const h = hydraulics(material);
      const porosity = effectivePorosity(material);
      const porePercent = Math.min(100, Math.max(0, porosity));
      const kPower = Math.floor(Math.log10(h.k));
      const permeabilityBand = kPower <= -7 ? "Very low" : kPower <= -5 ? "Low" : kPower <= -3 ? "Moderate" : "High";
      const permeabilityPercent = ({ "Very low": 12.5, Low: 37.5, Moderate: 62.5, High: 87.5 })[permeabilityBand];
      const color = GRAPH_COLORS[activeMaterialIds().indexOf(id) % GRAPH_COLORS.length];
      return `<article class="compare-property-card" style="--sample-color:${color}"><strong class="compare-property-name"><i></i>${escapeHtml(material.label)}</strong><div class="compare-property-meter"><span>Porosity <b>${porosity.toFixed(0)}% of volume</b></span><div class="model-meter" role="meter" aria-label="${escapeHtml(material.label)} modelled porosity, percentage of total volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${porosity.toFixed(1)}"><i style="width:${porePercent}%"></i></div></div><div class="compare-property-meter"><span>Permeability <b>${permeabilityBand}</b></span><div class="model-meter permeability-meter" role="meter" aria-label="${escapeHtml(material.label)} illustrative permeability category" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${permeabilityPercent.toFixed(0)}"><i style="width:${permeabilityPercent}%"></i></div><small class="meter-scale-ends"><span>Very low</span><span>High</span></small></div></article>`;
    }).join("");
  }

  function renderIntroStep(step = state.introStep) {
    state.introStep = introContent[step] ? step : "spaces";
    const item = introContent[state.introStep];
    $$("[data-intro-step]").forEach((button) => {
      const selected = button.dataset.introStep === state.introStep;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("#intro-step-label").textContent = item.label;
    $("#intro-step-title").textContent = item.title;
    $("#intro-step-copy").textContent = item.copy;
    const termButton = $(".intro-explanation .term-link");
    termButton.dataset.glossary = item.term;
    termButton.textContent = item.term === "fair-test" ? "Fair comparison · simple meaning + example" : `${item.term[0].toUpperCase()}${item.term.slice(1)} · simple meaning + example`;
    termButton.dataset.tooltip = `${glossary[item.term].meaning} Example: ${glossary[item.term].example}`;
    $("#intro-diagram").setAttribute("aria-label", `${item.title}. ${item.copy}`);
    const connected = state.introStep === "pathways";
    const radius = state.introStep === "spaces" ? 6 : state.introStep === "pathways" ? 8 : 7;
    const links = connected ? `<path d="M26 37 C52 37 49 67 77 67 S101 37 128 37 S151 68 179 68 S202 37 232 37" fill="none" stroke="#79aeb1" stroke-width="4" stroke-linecap="round" stroke-dasharray="5 6"/><path d="M26 91 C52 91 49 61 77 61 S101 92 128 92 S151 62 179 62 S202 91 232 91" fill="none" stroke="#91bec0" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 7"/>` : `<path d="M34 45h18M91 68h15M163 43h12M61 96h16M190 95h16" stroke="#aec0b0" stroke-width="2" stroke-dasharray="2 5"/>`;
    const circles = [];
    const points = [[40,39],[77,39],[116,39],[155,39],[194,39],[59,72],[98,72],[137,72],[176,72],[215,72],[40,105],[79,105],[118,105],[157,105],[196,105]];
    points.forEach(([cx, cy], i) => circles.push(`<circle cx="${cx}" cy="${cy}" r="${radius + ((i % 3) - 1) * .7}" fill="${i % 4 === 0 ? "#ba9470" : "#c8ad85"}"/>`));
    $("#intro-diagram").innerHTML = `<svg viewBox="0 0 260 144" role="img" aria-label="Particles with spaces between them"><title>${escapeHtml(item.title)}</title><rect x="8" y="8" width="244" height="128" rx="12" fill="#f5f4eb"/>${links}${circles.join("")}<text x="14" y="128" fill="#78877b" font-size="9" font-family="Poppins, sans-serif">PARTICLES</text><text x="196" y="128" fill="#688e93" font-size="9" font-family="Poppins, sans-serif">WATER PATH</text></svg>`;
    $("#intro-diagram svg").setAttribute("aria-label", `${item.title}. ${item.copy}`);
  }

  function renderPoreModel() {
    const grain = Number($("#grain-model-range").value);
    const paths = Number($("#path-model-range").value);
    state.grainModel = grain;
    state.pathModel = paths;
    const grainWord = grain < 34 ? "Fine" : grain > 66 ? "Coarse" : "Mixed";
    const pathWord = paths < 34 ? "Few" : paths > 66 ? "Many" : "Some";
    $("#grain-model-output").textContent = grainWord;
    $("#path-model-output").textContent = pathWord;
    const radius = 2.4 + (grain / 100) * 5;
    const spacing = 25 - radius * .6;
    const circles = [];
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 6; col += 1) {
      const x = 16 + col * spacing + (row % 2) * spacing / 2;
      const y = 13 + row * 20;
      circles.push(`<circle cx="${x.toFixed(1)}" cy="${y}" r="${radius.toFixed(1)}" fill="#b89a70" opacity="${(0.74 + (col % 2) * .12).toFixed(2)}"/>`);
    }
    const count = Math.round(1 + paths / 20);
    const linkPaths = [];
    for (let i = 0; i < count; i += 1) {
      const y = 18 + i * (46 / Math.max(1, count - 1));
      linkPaths.push(`<path d="M4 ${y} C30 ${y - 8}, 38 ${y + 8}, 57 ${y} S83 ${y + 7}, 102 ${y - 1} S128 ${y + 8}, 150 ${y}" fill="none" stroke="#6da3a6" stroke-width="${paths < 35 ? 1.5 : 2.5}" stroke-dasharray="4 5" opacity="${(0.38 + paths / 170).toFixed(2)}"/>`);
    }
    $("#pore-model-visual").innerHTML = `<svg viewBox="0 0 156 74" role="img" aria-label="${grainWord} grains with ${pathWord.toLowerCase()} connected water paths"><title>${grainWord} grains and ${pathWord.toLowerCase()} connected gaps</title>${linkPaths.join("")}${circles.join("")}</svg>`;
    const message = grain < 34 && paths < 34
      ? "Many tiny, poorly connected gaps can hold water while slowing its movement."
      : paths > 66
        ? "More connected gaps make a clearer route for water through the material."
        : "Grain size and the way gaps connect can both affect how easily water moves.";
    $("#pore-model-caption").textContent = message;
  }

  function renderActivitySvgLegacy(target, material, headCm, running, compact = false) {
    const waterHeight = 31 + Math.min(26, Math.max(2, ((headCm - 5) / 25) * 26));
    const waterY = 126 - waterHeight;
    const radius = material.grainRadius;
    let grains = "";
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = 163 + col * 10 + ((row % 2) * 4) + ((row * 7 + col * 5) % 4);
        const y = 67 + row * 12 + ((col * 3 + row) % 4);
        const r = Math.max(.9, radius * (0.69 + ((row + col) % 3) * .12));
        grains += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${material.color}" opacity="${(.47 + ((row + col) % 3) * .12).toFixed(2)}"/>`;
      }
    }
    const animation = running ? `<circle class="water-drop" cx="253" cy="157" r="2.7" fill="#77acb6"/><circle class="water-drop drop-2" cx="253" cy="157" r="2.2" fill="#77acb6"/>` : "";
    const tiny = compact;
    target.innerHTML = `<svg viewBox="0 0 420 200" role="img" aria-label="${escapeHtml(material.label)} sample in a permeameter; water flows from a head tank through soil and into a collector">
      <defs><clipPath id="soil-clip-${compact ? "replay" : "main"}"><rect x="151" y="59" width="67" height="95" rx="5"/></clipPath><linearGradient id="water-grad-${compact ? "replay" : "main"}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a7d0d1"/><stop offset="1" stop-color="#75aab3"/></linearGradient></defs>
      <g opacity=".45"><path d="M20 167H397" stroke="#cad4c6" stroke-width="1" stroke-dasharray="2 5"/><circle cx="98" cy="45" r="2" fill="#d6c295"/><circle cx="119" cy="159" r="2" fill="#d6c295"/><circle cx="355" cy="54" r="2" fill="#d6c295"/><circle cx="375" cy="139" r="2" fill="#d6c295"/></g>
      <g><path d="M31 50h64v81H31z" fill="#fdfdf8" stroke="#9aa99c" stroke-width="2"/><path d="M35 ${waterY}h56v${131-waterY}H35z" fill="url(#water-grad-${compact ? "replay" : "main"})" opacity=".82"/><path d="M35 ${waterY}h56" stroke="#5f9ea8" stroke-width="1.4"/><path d="M45 45h36" stroke="#8d9c91" stroke-width="3" stroke-linecap="round"/><path d="M96 108h19q9 0 9 9v8q0 6 8 6h20" fill="none" stroke="#78978f" stroke-width="4" stroke-linejoin="round"/><path d="M115 107v9" stroke="#78978f" stroke-width="2"/><path d="M108 76v46" stroke="#aab7ab" stroke-width="1" stroke-dasharray="2 3"/><text x="25" y="147" font-family="DM Sans, sans-serif" font-size="8" fill="#859287">HEAD TANK</text><text x="44" y="${Math.max(62, waterY - 4)}" font-family="DM Sans, sans-serif" font-size="7" fill="#608b8d">${headCm} cm</text></g>
      <g><path d="M147 53q0-5 6-5h62q6 0 6 5v105q0 5-6 5h-62q-6 0-6-5z" fill="#fffefa" stroke="#819689" stroke-width="2"/><rect x="151" y="59" width="67" height="95" rx="5" fill="#eee3ce"/><g clip-path="url(#soil-clip-${compact ? "replay" : "main"})">${grains}<path d="M176 62v80m22-80v77" fill="none" stroke="#84b4b8" stroke-width="1.4" stroke-dasharray="3 5" opacity=".76"/><path d="M186 70v63" fill="none" stroke="#75a9ad" stroke-width="2" stroke-dasharray="5 5" opacity=".68"/></g><path d="M151 59q33 5 67 0" fill="none" stroke="#a5b2a4" stroke-width="1.2"/><text x="151" y="176" font-family="DM Sans, sans-serif" font-size="8" fill="#859287">SOIL SAMPLE</text><path d="M184 39v8" stroke="#a9b4a8" stroke-width="1"/><path d="M181 42h6" stroke="#a9b4a8" stroke-width="1"/></g>
      <g><path d="M218 156h28q6 0 8-7v-2h4v5q0 9-9 9h-28" fill="none" stroke="#78978f" stroke-width="4" stroke-linejoin="round"/>${animation}<path d="M273 130h6v29q0 4 5 4h34q5 0 5-4v-29h6v33q0 6-8 6h-40q-8 0-8-6z" fill="#fffefa" stroke="#8b9d8e" stroke-width="2"/><path d="M278 150h45v12h-45z" fill="#a2c7c3" opacity=".56"/><path d="M277 150q12-4 23 0t23 0" fill="none" stroke="#6ea5a7" stroke-width="1.4"/><path d="M277 129h45" stroke="#8b9d8e" stroke-width="2"/><text x="274" y="184" font-family="DM Sans, sans-serif" font-size="8" fill="#859287">COLLECTED WATER</text></g>
      <g fill="#95a397" font-family="DM Sans, sans-serif" font-size="7"><text x="340" y="66">Water moves</text><text x="340" y="76">through connected</text><text x="340" y="86">pore spaces</text></g><path d="M333 82l-10 3" stroke="#c4cec3" stroke-width="1"/>
      <g fill="#b4beb3"><circle cx="108" cy="154" r="1.1"/><circle cx="350" cy="107" r="1.1"/><circle cx="117" cy="59" r="1"/></g>
    </svg>`;
    if (tiny) target.classList.add("compact-diagram");
  }

  function renderComparisonSamplesLegacy(ids) {
    const target = $("#activity-visual");
    const time = state.elapsed;
    target.setAttribute("aria-label", `Three simulated samples compared at ${formatClock(time)}: ${ids.map((id) => getMaterial(id).label).join(", ")}.`);
    target.innerHTML = `<div class="sample-comparison-grid">${ids.map((id, index) => {
      const material = getMaterial(id);
      const properties = hydraulics(material);
      const flow = flowBand(properties.qMlMin);
      const radius = Math.max(1.3, Math.min(4.1, material.grainRadius * .72));
      let grains = "";
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const x = 65 + col * 10 + (row % 2) * 4;
          const y = 29 + row * 13;
          const r = radius * (.8 + ((row + col) % 3) * .13);
          grains += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${material.color}" opacity=".82"/>`;
        }
      }
      const speed = .16 + ((Math.log10(properties.k) + 9) / 7) * .76;
      const drops = state.hasRun ? [0, 1, 2].map((drop) => {
        const y = 24 + ((time * speed * 27 + drop * 30 + index * 11) % 58);
        const x = 81 + (drop % 2) * 6;
        return `<circle cx="${x}" cy="${y.toFixed(1)}" r="2.2" fill="#468e9b" opacity=".88"/>`;
      }).join("") : "";
      const stream = state.hasRun ? `<path d="M84 17V84" fill="none" stroke="#6ca6ac" stroke-width="1.5" stroke-dasharray="2 4" opacity=".72"/>` : "";
      const collectedY = 98 + ((time * speed * 14 + index * 3) % 8);
      return `<article class="sample-mini"><div class="sample-mini-head"><span class="sample-index" style="--sample-color:${GRAPH_COLORS[index % GRAPH_COLORS.length]}">${index + 1}</span><strong>${escapeHtml(material.label)}</strong></div><svg viewBox="0 0 150 112" role="img" aria-label="${escapeHtml(material.label)} grains with ${flow.toLowerCase()} model flow"><title>${escapeHtml(material.label)} simulated sample</title><rect x="49" y="13" width="70" height="78" rx="7" fill="#fffefa" stroke="#98a998" stroke-width="2"/><path d="M55 22h58v62H55z" fill="#f2efe4"/>${stream}${grains}${drops}<path d="M74 95h20" stroke="#78978f" stroke-width="3" stroke-linecap="round"/><path d="M84 91v8" stroke="#6ca6ac" stroke-width="2"/>${state.hasRun ? `<circle cx="84" cy="${collectedY.toFixed(1)}" r="2.6" fill="#5499a2"/>` : ""}<text x="84" y="109" text-anchor="middle" fill="#75847a" font-size="8" font-family="DM Sans, sans-serif">${escapeHtml(flow.toUpperCase())}</text></svg><div class="sample-mini-foot"><span>Porosity ${effectivePorosity(material).toFixed(0)}%</span><span>${escapeHtml(material.note)}</span></div></article>`;
    }).join("")}</div>`;
  }

  function renderActivitySvg(target, material, headCm, running, compact = false, frame = state) {
    const svgKey = String(target.id || "activity").replace(/[^a-z0-9_-]/gi, "");
    const clipId = `soil-clip-${svgKey}`;
    const gradientId = `water-grad-${svgKey}`;
    const elapsed = Number(frame.elapsed) || 0;
    const hasRun = Boolean(frame.hasRun || running);
    const volume = frame === state ? getSeriesVolume(material.id) : frame.series?.[material.id]?.cursorVolume ?? frame.series?.[material.id]?.volume ?? frame.volumeMl ?? state.series[material.id]?.volume ?? 0;
    const compaction = Number.isFinite(frame.compaction) ? frame.compaction : state.compaction;
    const depthCm = Number.isFinite(frame.depthCm) ? frame.depthCm : state.depthCm;
    const qMlSec = elapsed > 0 ? volume / elapsed : hydraulics(material).qMlSec;
    const speed = Math.max(.12, Math.min(3.4, qMlSec * 8));
    const porosity = Math.max(1, material.porosity - (compaction / 100) * 18);
    const timeHorizon = Number(frame.timeLimit) || Number($("#trial-scrubber").max) || Math.max(120, Math.ceil(elapsed / 300) * 300);
    const expected = Math.max(.00001, qMlSec * timeHorizon);
    const waterLevel = hasRun ? Math.min(23, Math.max(1, (volume / expected) * 23)) : 0;
    const waterTop = 162 - waterLevel;
    const headWaterTop = 132 - Math.min(72, Math.max(18, (Number(headCm) / 30) * 72));
    let grains = "";
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = 158 + col * 13 + ((row % 2) * 5) + ((row * 7 + col * 5) % 4);
        const y = 68 + row * 14 + ((col * 3 + row) % 4);
        const r = Math.max(1.3, material.grainRadius * (.78 + ((row + col) % 3) * .16));
        grains += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${material.color}" opacity="${(.58 + ((row + col) % 3) * .1).toFixed(2)}"/>`;
      }
    }
    const movingWater = hasRun ? [0, 1, 2, 3].map((drop) => {
      const y = 68 + ((elapsed * speed * 14 + drop * 20) % 78);
      const x = 173 + (drop % 2) * 21;
      return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${drop % 2 ? 3.2 : 2.6}" fill="#4e9aa4" opacity=".88"/>`;
    }).join("") : "";
    const route = hasRun ? `<path d="M175 64v87m22-87v87" fill="none" stroke="#69a7ad" stroke-width="2" stroke-dasharray="4 6" opacity=".7"/>` : `<path d="M175 64v87m22-87v87" fill="none" stroke="#82adb0" stroke-width="1.5" stroke-dasharray="3 6" opacity=".58"/>`;
    target.innerHTML = `<svg viewBox="0 0 420 205" role="img" aria-label="${escapeHtml(material.label)} sample. ${hasRun ? `${formatVolume(volume)} millilitres collected after ${elapsed.toFixed(0)} seconds.` : "Ready for a water-flow trial."}">
      <defs><clipPath id="${clipId}"><rect x="147" y="59" width="78" height="97" rx="5"/></clipPath><linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#afd4d4"/><stop offset="1" stop-color="#76aeb5"/></linearGradient></defs>
      <g opacity=".4"><path d="M18 175H401" stroke="#cad4c6" stroke-width="1" stroke-dasharray="2 5"/><circle cx="112" cy="48" r="2" fill="#d6c295"/><circle cx="365" cy="57" r="2" fill="#d6c295"/></g>
      <g><path d="M26 43h66v92H26z" fill="#fdfdf8" stroke="#8d9f91" stroke-width="2"/><path d="M30 ${headWaterTop}h58v${135 - headWaterTop}H30z" fill="url(#${gradientId})" opacity=".88"/><path d="M30 ${headWaterTop}h58" stroke="#5f9ea8" stroke-width="1.5"/><path d="M41 38h36" stroke="#8d9c91" stroke-width="3" stroke-linecap="round"/><path d="M94 112h35q8 0 8 9v8q0 7 8 7" fill="none" stroke="#78978f" stroke-width="5" stroke-linejoin="round"/><text x="24" y="153" font-family="DM Sans, sans-serif" font-size="10" font-weight="600" fill="#657b6e">WATER HEAD</text><text x="39" y="${Math.max(57, headWaterTop - 7)}" font-family="DM Sans, sans-serif" font-size="11" font-weight="700" fill="#507f85">${Number(headCm).toFixed(0)} cm</text></g>
      <g><path d="M141 52q0-6 7-6h78q7 0 7 6v110q0 6-7 6h-78q-7 0-7-6z" fill="#fffefa" stroke="#718d7b" stroke-width="2.5"/><rect x="147" y="59" width="78" height="97" rx="5" fill="#eee3ce"/><g clip-path="url(#${clipId})">${grains}${route}${movingWater}</g><path d="M147 59q39 5 78 0" fill="none" stroke="#a5b2a4" stroke-width="1.5"/></g>
      <g><path d="M233 143h25q6 0 8-7v-3h5v6q0 10-10 10h-26" fill="none" stroke="#78978f" stroke-width="5" stroke-linejoin="round"/><path d="M283 126h7v35q0 4 5 4h35q5 0 5-4v-35h7v40q0 7-9 7h-41q-9 0-9-7z" fill="#fffefa" stroke="#839889" stroke-width="2.5"/><path d="M292 ${waterTop}h40v${162 - waterTop}h-40z" fill="#91c3c2" opacity=".78"/><path d="M291 ${waterTop}q10-4 20 0t21 0" fill="none" stroke="#5b9da2" stroke-width="1.7"/><text x="280" y="184" font-family="DM Sans, sans-serif" font-size="10" font-weight="700" fill="#62776a">COLLECTED</text><text x="350" y="143" font-family="DM Sans, sans-serif" font-size="11" font-weight="700" fill="#416b69">${formatVolume(volume)} mL</text><text x="350" y="160" font-family="DM Sans, sans-serif" font-size="10" fill="#78887b">${formatClock(elapsed)}</text></g>
      <g fill="#708378" font-family="DM Sans, sans-serif" font-size="10"><text x="29" y="197">Water head: ${Number(headCm).toFixed(0)} cm</text><text x="143" y="197">Sample path: ${Number(depthCm).toFixed(0)} cm</text><text x="281" y="197">${hasRun ? (running ? "Water is flowing" : "Trial paused") : "Ready to begin"}</text></g>
    </svg>`;
    target.classList.toggle("compact-diagram", compact);
    target.querySelectorAll("svg text").forEach((label) => {
      const originalSize = Number(label.getAttribute("font-size")) || 10;
      label.setAttribute("font-size", String(Math.max(11, originalSize * 1.2)));
    });
    const sampleCore = Array.from(target.querySelectorAll("svg > g")).find((group) => group.querySelector("[clip-path]"));
    sampleCore?.setAttribute("transform", "translate(-45 0) scale(1.2 1)");
  }

  function renderComparisonSamples(ids, target = $("#activity-visual"), frame = state) {
    const elapsed = Number(frame.elapsed) || 0;
    const hasRun = Boolean(frame.hasRun || frame.running);
    const comparisons = [...ids];
    target.setAttribute("aria-label", `${comparisons.length} simulated samples at ${formatClock(elapsed)}: ${comparisons.map((id) => getMaterial(id).label).join(", ")}.`);
    target.innerHTML = `<div class="sample-comparison-grid">${comparisons.map((id, index) => {
      const material = getMaterial(id);
      const volume = frame === state ? getSeriesVolume(id) : frame.series?.[id]?.cursorVolume ?? frame.series?.[id]?.volume ?? 0;
      const qMlMin = elapsed > 0 ? (volume / elapsed) * 60 : hydraulics(material).qMlMin;
      const flow = flowBand(qMlMin);
      const porosity = Math.max(1, material.porosity - ((Number(frame.compaction) || 0) / 100) * 18);
      const radius = Math.max(2.1, Math.min(8, material.grainRadius * 1.2));
      const speed = Math.max(.1, Math.min(2.5, qMlMin / 24));
      let grains = "";
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 5; col += 1) {
        const x = 46 + col * 17 + (row % 2) * 7;
        const y = 25 + row * 18;
        const r = radius * (.76 + ((row + col) % 3) * .12);
        grains += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${material.color}" opacity=".82"/>`;
      }
      const drops = hasRun ? [0, 1, 2, 3].map((drop) => {
        const y = 19 + ((elapsed * speed * 17 + drop * 24) % 92);
        return `<circle cx="${84 + (drop % 2) * 7}" cy="${y.toFixed(1)}" r="3.2" fill="#438f9a" opacity=".9"/>`;
      }).join("") : "";
      const horizon = Number(frame.timeLimit) || Number($("#trial-scrubber").max) || Math.max(120, Math.ceil(elapsed / 300) * 300);
      const expected = Math.max(.00001, qMlMin / 60 * horizon);
      const fill = hasRun ? Math.min(10, Math.max(1, (volume / expected) * 10)) : 0;
      const fillY = 149 - fill;
      return `<article class="sample-mini"><div class="sample-mini-head"><span class="sample-index" style="--sample-color:${GRAPH_COLORS[index % GRAPH_COLORS.length]}">${index + 1}</span><strong>${escapeHtml(material.label)}</strong><span class="sample-flow-pill">${flow}</span></div><svg viewBox="0 0 180 150" role="img" aria-label="${escapeHtml(material.label)}: ${porosity.toFixed(0)} percent pore space, ${formatVolume(volume)} millilitres collected"><title>${escapeHtml(material.label)} simulated flow sample</title><path d="M84 6v17" stroke="#72948a" stroke-width="4"/><rect x="45" y="19" width="78" height="110" rx="7" fill="#fffefa" stroke="#809686" stroke-width="2.5"/><path d="M52 28h64v91H52z" fill="#f2ede0"/><path d="M84 29v88" stroke="#65a0a5" stroke-width="2" stroke-dasharray="4 5" opacity=".72"/>${grains}${drops}<path d="M84 129v9" stroke="#73968f" stroke-width="4"/><rect x="68" y="137" width="32" height="12" rx="3" fill="#fffefa" stroke="#92a394" stroke-width="1.5"/><rect x="70" y="${fillY}" width="28" height="${fill}" rx="2" fill="#79b4b8" opacity=".9"/><text x="84" y="14" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="9" fill="#6f8276">WATER</text><text x="84" y="148" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="7" fill="#648b8b">${hasRun ? "FLOWING" : "READY"}</text></svg><div class="sample-mini-foot"><span><strong>Porosity</strong><b>${porosity.toFixed(0)}%</b></span><span><strong>Collected</strong><b>${formatVolume(volume)} mL</b></span><span><strong>Elapsed</strong><b>${formatClock(elapsed)}</b></span><span class="sample-note">${escapeHtml(material.note)}</span></div></article>`;
    }).join("")}</div>`;
  }

  function getSeriesVolume(id) { return state.running ? state.series[id]?.volume || 0 : volumeAt(id, state.elapsed); }
  function graphInsight() {
    const active = activeMaterialIds();
    if (active.length > 1) {
      if (state.hasRun && state.elapsed > 1) {
        const ranked = [...active].sort((a, b) => getSeriesVolume(b) - getSeriesVolume(a));
        const more = ranked[0], less = ranked[ranked.length - 1];
        return `At ${state.elapsed.toFixed(0)} seconds, ${getMaterial(more).label} collected ${formatVolume(getSeriesVolume(more))} mL and ${getMaterial(less).label} collected ${formatVolume(getSeriesVolume(less))} mL. Read the labelled values at the same time; small results can be hard to see on the linear scale.`;
      }
      return "All materials share one linear graph and the same axes. A low-flow material may sit close to zero beside gravel; read the labelled mL values at the same time for an honest comparison.";
    }
    const current = getMaterial();
    if (state.hasRun && state.elapsed > 1) {
      return `The line shows ${formatVolume(getSeriesVolume(current.id))} mL collected over ${state.elapsed.toFixed(0)} seconds. Its slope represents discharge: a steeper line means more water moves each second.`;
    }
    if (current.id === "clay") return "Clay can store water in many tiny pores. Those pores connect less easily, so expect a much gentler rise than gravel.";
    if (current.id === "gravel") return "Gravel’s open, connected gaps let water move quickly. Compare its steeper rise with fine-grained materials.";
    return `This ${current.label.toLowerCase()} setup has ${porosityBand(effectivePorosity(current)).toLowerCase()} porosity and ${flowBand(hydraulics(current).qMlMin).toLowerCase()} flow. Compare it with another material to explain the difference.`;
  }

  function renderChart() {
    const chart = $("#volume-chart");
    const W = 520, H = 260, left = 65, right = 16, top = 18, bottom = 42;
    const active = activeMaterialIds();
    const xMax = 120;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const availablePlotWidth = (chart.clientWidth || W) * plotW / W;
    const targetXIntervals = Math.max(2, Math.floor(availablePlotWidth / 70));
    const xStep = [10, 20, 30, 60].sort((a, b) => Math.abs(xMax / a - targetXIntervals) - Math.abs(xMax / b - targetXIntervals) || b - a)[0];
    const visibleTime = Math.min(xMax, Math.max(0, state.elapsed));
    const overlays = state.historyOverlays.map((key) => {
      const split = key.indexOf("::");
      const attempt = state.history.find((item) => item.id === key.slice(0, split));
      const id = key.slice(split + 2);
      return attempt?.series?.[id] ? { key, attempt, id, series: attempt.series[id] } : null;
    }).filter(Boolean);
    const x = (time) => left + Math.min(xMax, Math.max(0, time)) / xMax * plotW;
    const projections = active.map((id) => {
      const material = getMaterial(id);
      const series = state.series[id];
      const collected = series ? state.running ? series.volume : volumeAt(id, visibleTime) : 0;
      const rate = hydraulics(material).qMlSec;
      const endVolume = state.hasRun ? collected + rate * (xMax - visibleTime) : rate * xMax;
      return { id, material, series, collected, rate, endVolume };
    });
    const values = [0, ...projections.map((item) => item.endVolume), ...projections.flatMap((item) => (item.series?.points || []).filter((point) => point.t <= visibleTime).map((point) => point.v)), ...overlays.flatMap((item) => (item.series.points || []).filter((point) => point.t <= xMax).map((point) => point.v))];
    const dataMax = Math.max(...values, .00001);
    const yStep = niceStep(dataMax / 5);
    const yMax = Math.max(yStep, Math.ceil(dataMax / yStep) * yStep);
    const y = (value) => top + plotH - Math.min(yMax, Math.max(0, value)) / yMax * plotH;
    let svg = "";
    for (let value = 0; value <= yMax + yStep * 1e-8; value += yStep) {
      const yy = y(value);
      svg += `<line class="chart-grid" x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}"/><text class="chart-label" x="${left - 7}" y="${yy + 3}" text-anchor="end">${formatAxis(value, yStep)}</text>`;
    }
    for (let value = 0; value <= xMax; value += xStep) {
      const xx = x(value);
      svg += `<line class="chart-grid chart-time-grid" x1="${xx}" y1="${top}" x2="${xx}" y2="${top + plotH}"/><text class="chart-label" x="${xx}" y="${top + plotH + 15}" text-anchor="middle">${value}</text>`;
    }
    svg += `<line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}"/><line class="chart-axis" x1="${left}" y1="${top + plotH}" x2="${W - right}" y2="${top + plotH}"/>`;
    projections.forEach(({ series, collected, rate }, index) => {
      const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
      if (state.hasRun && series) {
        const points = (series.points || [{ t: 0, v: 0 }]).filter((point) => point.t <= visibleTime);
        const current = state.running ? series.volume : collected;
        const last = points[points.length - 1];
        if (!last || last.t < visibleTime) points.push({ t: visibleTime, v: current });
        const line = points.map((point, i) => `${i ? "L" : "M"} ${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
        svg += `<path class="chart-line" stroke="${color}" d="${line}"/>`;
        if (!state.running && visibleTime > 0) svg += `<circle class="chart-point" cx="${x(visibleTime)}" cy="${y(current)}" r="3.5" fill="${color}"/>`;
        if (visibleTime < xMax) svg += `<path class="chart-line forecast" stroke="${color}" d="M ${x(visibleTime)} ${y(current)} L ${x(xMax)} ${y(current + rate * (xMax - visibleTime))}"/>`;
      } else {
        svg += `<path class="chart-line forecast" stroke="${color}" d="M ${x(0)} ${y(0)} L ${x(xMax)} ${y(rate * xMax)}"/>`;
      }
    });
    overlays.forEach((item, index) => {
      const points = (item.series.points || [{ t: 0, v: 0 }]).filter((point) => point.t <= xMax);
      const path = points.map((point, i) => `${i ? "L" : "M"} ${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
      svg += `<path class="chart-line history-chart-line" stroke="${HISTORY_COLORS[index % HISTORY_COLORS.length]}" d="${path}"/>`;
    });
    svg += `<text class="chart-axis-title" x="16" y="${top + plotH / 2}" text-anchor="middle" transform="rotate(-90 16 ${top + plotH / 2})">WATER COLLECTED (mL)</text><text class="chart-axis-title" x="${left + plotW / 2}" y="${H - 3}" text-anchor="middle">TIME (seconds)</text>`;
    chart.innerHTML = svg;
    chart.setAttribute("viewBox", `0 0 ${W} ${H}`);
    chart.setAttribute("aria-label", `Cumulative water collected against time on one shared linear scale: ${projections.map(({ material, collected }) => `${material.label}: ${formatVolume(collected)} millilitres`).join("; ")}.`);
    $(".chart-wrap").style.height = `${H}px`;
    $("#chart-legend").innerHTML = projections.map(({ id, material, collected }, index) => {
      const qualifier = state.hasRun ? "collected at selected time" : `model estimate at ${visibleTime} sec`;
      return `<span class="legend-item"><i class="legend-dot" style="background:${GRAPH_COLORS[index % GRAPH_COLORS.length]}"></i>${escapeHtml(material.label)} · <strong>${formatVolume(collected)} mL</strong> <small>${qualifier}</small></span>`;
    }).join("") + overlays.map((item, index) => `<button type="button" class="legend-item history-legend" data-history-overlay="${escapeHtml(item.key)}" aria-label="Remove ${escapeHtml(getMaterial(item.id).label)} saved trial from graph"><i class="legend-dot" style="background:${HISTORY_COLORS[index % HISTORY_COLORS.length]}"></i>${escapeHtml(getMaterial(item.id).label)} · saved ${new Date(item.attempt.savedAt).toLocaleDateString()}</button>`).join("");
    const scaleNote = $("#graph-scale-note");
    scaleNote.hidden = false;
    scaleNote.textContent = `One shared linear scale for all materials · 0–${formatAxis(yMax, yStep)} mL · ${formatAxis(yStep, yStep)} mL per vertical step`;
    $("#graph-line-reading").textContent = active.length > 1
      ? "All materials share one linear graph and identical axes. Large flow differences may put low-flow lines close to zero; use the labelled mL values to compare them."
      : "The graph uses linear axes with equal increments. A higher point means more water has collected; the vertical scale updates as results grow.";
    const slopeTerm = $(".graph-term");
    slopeTerm.dataset.tooltip = active.length > 1
      ? "All materials share one linear vertical scale. At the same time, compare labelled millilitre values as well as line heights."
      : "Graph slope means how quickly the line rises. Example: a steeper line shows more water collected in the same time.";
    $("#graph-insight").innerHTML = `<span class="insight-stars">✳</span><span>${escapeHtml(graphInsight())}</span>`;
    const live = $("#graph-live");
    live.classList.toggle("running", state.running);
    live.innerHTML = `<i></i> ${state.running ? "RUNNING" : state.hasRun ? "EVIDENCE" : "READY"}`;
  }

  function renderActivityHistory() {
    const list = $("#activity-history-list");
    if (!list) return;
    const expandedAttempts = new Set(Array.from(list.querySelectorAll(".history-attempt[open]")).map((item) => item.dataset.attemptId));
    $("#history-count").textContent = `${state.history.length} saved ${state.history.length === 1 ? "trial" : "trials"}`;
    if (!state.history.length) {
      list.innerHTML = `<p class="history-empty">Your saved trials will appear here after you reset a run or change its setup.</p>`;
      return;
    }
    list.innerHTML = state.history.map((attempt, index) => {
      const date = new Date(attempt.savedAt || Date.now());
      const stamp = `${date.toLocaleDateString([], { day: "numeric", month: "short" })} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
      const materialsUsed = (attempt.materials || [attempt.selected]).map((id) => getMaterial(id));
      const lines = materialsUsed.map((material, materialIndex) => {
        const volume = attempt.series?.[material.id]?.volume || 0;
        const porosity = Math.max(1, material.porosity - ((attempt.compaction || 0) / 100) * 18);
        const key = `${attempt.id}::${material.id}`;
        const selected = state.historyOverlays.includes(key);
        return `<div class="history-material-row"><span class="history-material-name"><i class="legend-dot" style="background:${HISTORY_COLORS[materialIndex % HISTORY_COLORS.length]}"></i>${escapeHtml(material.label)}</span><span>${formatVolume(volume)} mL</span><span>${porosity.toFixed(0)}% pore space</span><button type="button" class="history-compare-button ${selected ? "is-selected" : ""}" data-history-overlay="${escapeHtml(key)}" aria-pressed="${selected}">${selected ? "Remove from graph" : "Compare on graph"}</button></div>`;
      }).join("");
      return `<details class="history-attempt" data-attempt-id="${escapeHtml(attempt.id)}"><summary><span><strong>Trial ${index + 1}</strong> · ${escapeHtml(materialsUsed.map((material) => material.label).join(", "))}</span><small>${stamp} · ${formatClock(attempt.elapsed || 0)}</small></summary><div class="history-settings"><span>Water head <strong>${Number(attempt.headCm).toFixed(0)} cm</strong></span><span>Material depth <strong>${Number(attempt.depthCm).toFixed(0)} cm</strong></span><span>Compaction <strong>${Number(attempt.compaction).toFixed(0)}%</strong></span><span>Elapsed <strong>${formatClock(attempt.elapsed || 0)}</strong></span></div><div class="history-material-list">${lines}</div><button type="button" class="history-export-button" data-export-trial="${escapeHtml(attempt.id)}">Download this trial’s data (CSV)</button></details>`;
    }).join("");
    list.querySelectorAll(".history-attempt").forEach((item) => { item.open = expandedAttempts.has(item.dataset.attemptId); });
  }

  function renderProgress() {
    const done = Math.min(3, state.completedMaterials.size);
    $("#task-progress-fill").style.width = `${done / 3 * 100}%`;
    $("#task-progress-label").textContent = `${done} / 3 materials tested`;
    const answered = questionBank.filter((q) => String(state.answers[q.id] ?? "").trim() !== "").length;
    $("#question-progress").textContent = answered;
    renderWorkflow();
  }

  function renderWorkflow() {
    const target = $("#workflow-list");
    if (!target) return;
    const testedThree = state.completedMaterials.size >= 3;
    const answered = (id) => String(state.answers[id] ?? "").trim() !== "";
    const statuses = [answered("q1"), answered("q2") && testedThree, testedThree && answered("q3"), answered("q4") && answered("q5") && answered("q6")];
    const currentIndex = statuses.findIndex((complete) => !complete);
    const stageIds = ["q1", "q2", "q3", "q4"];
    const titles = ["Predict", "Keep it fair", "Read the graph", "Explain & evaluate"];
    const answeredCount = statuses.filter(Boolean).length;
    $("#workflow-progress-label").textContent = `${answeredCount} of 4 steps`;
    $("#workflow-progress-fill").style.width = `${answeredCount / 4 * 100}%`;
    target.innerHTML = titles.map((title, index) => {
      const stateClass = statuses[index] ? "complete" : index === currentIndex ? "current" : "";
      const icon = statuses[index] ? "✓" : String(index + 1);
      return `<li class="workflow-step ${stateClass}"><span class="workflow-number" aria-hidden="true">${icon}</span><div class="workflow-copy"><strong>${title}</strong><p>${escapeHtml(state.workflowNotes[index] || defaultWorkflowNotes[index])}</p><button type="button" class="workflow-question-link" data-question-jump="${stageIds[index]}">Open related prompt</button></div></li>`;
    }).join("");
  }

  function updateExperimentStatus() {
    $("#run-trial").innerHTML = state.running ? `<span class="play-mark">Ⅱ</span><span>Pause trial</span>` : `<span class="play-mark">▶</span><span>${state.elapsed > 0 ? "Resume trial" : "Start trial"}</span>`;
    $("#run-trial").disabled = !state.running && state.hasRun && state.elapsed >= 120;
    $("#activity-status").textContent = state.running ? "Water is moving through the sample" : state.hasRun ? "Trial paused · evidence saved" : "Ready for a new trial";
    $("#volume-value").innerHTML = `${formatVolume(getSeriesVolume(state.selected))} <small>mL</small>`;
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, "0");
    $("#time-value").textContent = `${minutes}:${seconds}`;
    const scrubber = $("#trial-scrubber");
    const timeLimit = 120;
    scrubber.max = String(timeLimit);
    scrubber.value = String(Math.min(Number(scrubber.max), Math.floor(state.elapsed)));
    scrubber.disabled = state.running;
    $("#advance-trial").disabled = state.running || state.elapsed >= timeLimit;
    $("#trial-time-output").textContent = formatClock(state.elapsed);
    $("#trial-time-end").textContent = `${timeLimit} sec`;
    const selected = getMaterial();
    const flow = flowBand(hydraulics(selected).qMlMin);
    const pore = porosityBand(effectivePorosity(selected));
    $("#material-note").textContent = selected.note;
    const materialHelp = $("#material-help");
    const materialMeaning = glossary[`material-${selected.id}`];
    materialHelp.dataset.glossary = `material-${selected.id}`;
    materialHelp.dataset.tooltip = `${materialMeaning.meaning} Example: ${materialMeaning.example}`;
    const activeIds = activeMaterialIds();
    const comparing = activeIds.length > 1;
    const stage = $("#activity-stage");
    stage.classList.toggle("is-comparing", comparing);
    stage.style.setProperty("--sample-count", String(activeIds.length));
    $("#visual-material-label").textContent = comparing ? `${activeIds.length} samples · same setup` : `${selected.label} sample`;
    $("#visual-flow-label").textContent = comparing ? "stacked for comparison" : `${flow.toLowerCase()} flow`;
    $("#flow-band").textContent = comparing ? `Comparing ${activeIds.length} materials` : `${flow} flow`;
    $("#porosity-band").textContent = pore;
    $("#material-swatch").style.background = selected.color;
    if (comparing) renderComparisonSamples(activeIds);
    else renderActivitySvg($("#activity-visual"), selected, state.headCm, state.running, false, state);
  }

  function renderControls() {
    renderMaterialOptions();
    renderCompareChips();
    $("#head-range").value = String(state.headCm);
    $("#depth-range").value = String(state.depthCm);
    $("#compact-range").value = String(state.compaction);
    $("#head-output").textContent = `${state.headCm} cm`;
    $("#depth-output").textContent = `${state.depthCm} cm`;
    $("#compact-output").textContent = `${state.compaction}%`;
    renderAdvanced();
  }

  function renderQuestions() {
    const list = $("#question-list");
    $("#lesson-title").textContent = state.lessonTitle || "Water moves through soil";
    $("#lesson-intention-title").textContent = state.lessonIntentions ? "What am I learning?" : "Learning intention";
    $("#active-learning-intention").textContent = state.lessonIntentions || defaultLearningIntention;
    $("#lesson-task-title").textContent = state.lessonTitle || "Investigation task";
    $("#lesson-task-description").textContent = state.lessonDescription;
    list.innerHTML = questionBank.map((question, index) => {
      const savedAnswer = state.answers[question.id];
      const prompt = state.questionPrompts[index] || question.prompt;
      const feedback = state.submitted && String(savedAnswer ?? "").trim() ? "Draft saved on this device. Use your class form for assessed responses." : "";
      return `<article class="question-card ${String(savedAnswer ?? "").trim() ? "answered" : ""}" data-question-card="${question.id}"><div class="question-top"><span class="question-number">${String(index + 1).padStart(2, "0")}</span><div class="question-body"><div class="question-type">${question.stage}</div><p class="question-prompt">${escapeHtml(prompt)}</p><p class="question-hint">${escapeHtml(question.hint)}</p><textarea class="answer-short" data-question="${question.id}" maxlength="700" rows="2" aria-label="Your thinking for ${question.stage.toLowerCase()}" placeholder="Add your thinking here…">${escapeHtml(savedAnswer ?? "")}</textarea></div></div>${feedback ? `<div class="answer-feedback pending">${escapeHtml(feedback)}</div>` : ""}</article>`;
    }).join("");
    renderProgress();
  }

  function renderTeacher() {
    const record = activeClass();
    if (!record) return;
    $("#lesson-name").value = state.lessonTitle;
    $("#lesson-intentions").value = state.lessonIntentions;
    $("#lesson-description").value = state.lessonDescription;
    $("#question-editor").value = state.questionPrompts.join("\n");
    $("#workflow-editor").value = state.workflowNotes.join("\n");
    $("#publish-status").textContent = state.published ? "PUBLISHED · 6 PROMPTS" : "DRAFT · 6 PROMPTS";
    $("#publish-status").classList.toggle("published", state.published);
    $("#active-class-label").textContent = record.name;
    $("#active-class-subtitle").textContent = `${record.students.length} ${record.students.length === 1 ? "learner" : "learners"} on the list`;
    $("#join-code-display").textContent = record.code;
    $("#teacher-recovery-code-display").textContent = record.teacherCode;
    $("#sidebar-class-name").textContent = record.name;
    $("#sidebar-class-code").textContent = record.code;
    $("#sidebar-class-code").setAttribute("aria-label", `Class code ${record.code}`);
    $("#topbar-class-name").textContent = record.name;
    $("#header-view-identity").textContent = currentStudent()?.name || "Teacher View";
    $("#header-class-code").textContent = record.code;
    $("#footer-class-name").textContent = record.name;
    $("#roster-class-title").textContent = record.name;
    $("#roster-class-code").textContent = record.code;
    $("#active-class-select").innerHTML = state.classRecords.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === record.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
    $("#teacher-recover-code").value = "";
    $("#teacher-recover-class-code").value = "";
    $("#teacher-recover-status").textContent = "Both codes reopen a class saved in this browser. Cross-device recovery needs shared storage.";
    $("#lesson-history-count").textContent = `${state.classRecords.length} saved ${state.classRecords.length === 1 ? "class" : "classes"}`;
    $("#lesson-history-list").innerHTML = state.classRecords.map((item) => {
      const savedActivity = item.activity || {};
      const trialCount = Array.isArray(savedActivity.history) ? savedActivity.history.length : 0;
      const learnerCount = Array.isArray(item.students) ? item.students.length : 0;
      const savedAt = Number(item.updatedAt || item.createdAt || 0);
      const date = savedAt ? new Date(savedAt).toLocaleString() : "Saved in this browser";
      return `<article class="lesson-history-item"><div><strong>${escapeHtml(item.lessonTitle || item.name)}</strong><span>${escapeHtml(item.name)} · code ${escapeHtml(item.code)}</span><small>${learnerCount} ${learnerCount === 1 ? "learner" : "learners"} · ${trialCount} saved ${trialCount === 1 ? "trial" : "trials"} · ${escapeHtml(date)}</small></div><button type="button" class="outline-button" data-recover-class="${escapeHtml(item.id)}" ${item.id === record.id ? "disabled" : ""}>${item.id === record.id ? "Active class" : "Use class code"}</button></article>`;
    }).join("") || `<p class="history-empty">Saved class and lesson records will appear here.</p>`;
    const studentLink = studentJoinUrl();
    $("#student-join-link").href = studentLink.href;
    $("#student-url-display").textContent = studentLink.href;
    const previewLink = studentJoinUrl({ teacherPreview: true, code: record.code });
    $("#preview-student-view").dataset.url = previewLink.href;
    const submitted = state.students.filter((student) => student.progress === "Submitted").length;
    $("#completion-stat").textContent = `${state.students.length ? Math.round((submitted / state.students.length) * 100) : 0}%`;
    $("#completion-caption").textContent = `${submitted} of ${state.students.length} learners submitted`;
    $("#roster-count").textContent = String(state.students.length);
    $("#class-status-caption").textContent = state.classClosed ? "Class is closed to new joins" : "Saved in this browser · roster sorted by name";
    $("#close-class").textContent = state.classClosed ? "Reopen class" : "Close class";
    $("#roster-body").innerHTML = [...state.students].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((student) => {
      const submittedStatus = student.progress === "Submitted";
      const inProgress = student.progress === "Working";
      const statusLabel = submittedStatus ? "Ready to review" : inProgress ? "In progress" : "Not started";
      return `<tr><td><button type="button" class="roster-profile-button" data-student-id="${escapeHtml(student.id)}"><span class="roster-name"><i class="roster-avatar">${escapeHtml(student.initials)}</i>${escapeHtml(student.name)}</span></button></td><td>${escapeHtml(student.progress)}</td><td><span class="status-pill ${inProgress || !submittedStatus ? "pending" : ""}"><i></i>${statusLabel}</span></td><td>${escapeHtml(student.score || "—")}</td></tr>`;
    }).join("");
    if (!state.students.length) $("#roster-body").innerHTML = `<tr><td colspan="4" class="empty-roster">No learners yet. Add names above to prepare the class list.</td></tr>`;
    const selectedReplay = state.selectedReplayStudentId;
    $("#replay-learner-select").innerHTML = `<option value="">Current activity</option>${state.students.map((student) => `<option value="${escapeHtml(student.id)}" ${student.id === selectedReplay ? "selected" : ""}>${escapeHtml(student.name)}</option>`).join("")}`;
    renderStudentAccess();
    updateReplayControls();
  }

  function applyActivitySnapshot(snapshot) {
    snapshot = snapshot || { selected: "gravel", comparison: [], headCm: 15, depthCm: 10, compaction: 0, elapsed: 0, hasRun: false, series: {}, completedMaterials: [], mode: "simple" };
    state.selected = materialById[snapshot.selected] ? snapshot.selected : state.selected;
    state.comparison = Array.isArray(snapshot.comparison) ? snapshot.comparison.filter((id) => materialById[id]).slice(0, 2) : [];
    state.headCm = Number.isFinite(snapshot.headCm) ? snapshot.headCm : 15;
    state.depthCm = Number.isFinite(snapshot.depthCm) ? snapshot.depthCm : 10;
    state.compaction = Number.isFinite(snapshot.compaction) ? snapshot.compaction : 0;
    state.elapsed = Number.isFinite(snapshot.elapsed) ? snapshot.elapsed : 0;
    state.hasRun = Boolean(snapshot.hasRun);
    state.series = snapshot.series && typeof snapshot.series === "object" ? snapshot.series : {};
    state.history = Array.isArray(snapshot.history) ? snapshot.history.slice(0, 15) : [];
    state.historyOverlays = Array.isArray(snapshot.historyOverlays) ? snapshot.historyOverlays : [];
    state.completedMaterials = new Set(Array.isArray(snapshot.completedMaterials) ? snapshot.completedMaterials : []);
    state.mode = snapshot.mode === "advanced" ? "advanced" : "simple";
    state.running = false;
  }

  function activateClass(id) {
    const target = state.classRecords.find((item) => item.id === id);
    if (!target || target.id === state.activeClassId) return;
    persist();
    state.activeClassId = target.id;
    state.currentStudentId = null;
    state.selectedReplayStudentId = "";
    state.students = target.students;
    state.lessonTitle = target.lessonTitle;
    state.lessonIntentions = target.lessonIntentions || defaultLearningIntention;
    state.lessonDescription = target.lessonDescription;
    state.questionPrompts = [...target.questionPrompts];
    state.workflowNotes = [...target.workflowNotes];
    state.published = Boolean(target.published);
    state.classClosed = Boolean(target.classClosed);
    state.events = Array.isArray(target.events) ? target.events.slice(-600) : [];
    state.answers = target.draftAnswers || {};
    state.submitted = false;
    applyActivitySnapshot(target.activity);
    renderAll();
    renderTeacher();
    persist();
    showToast(`${target.name} is now the active class.`);
  }

  function addClass(name) {
    const label = String(name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) return false;
    if (state.classRecords.some((record) => record.name.toLocaleLowerCase() === label.toLocaleLowerCase())) { showToast("A class with that name already exists."); return false; }
    const code = generateUniqueClassCode();
    const record = makeClass(label, code, []);
    record.createdAt = Date.now();
    record.updatedAt = record.createdAt;
    state.classRecords.push(record);
    state.activeClassId = record.id;
    state.currentStudentId = null;
    state.selectedReplayStudentId = "";
    state.students = record.students;
    if (!state.currentStudentId) { state.answers = activeClass()?.draftAnswers || {}; state.submitted = false; }
    state.events = [];
    state.lessonTitle = record.lessonTitle;
    state.lessonIntentions = record.lessonIntentions || defaultLearningIntention;
    state.lessonDescription = record.lessonDescription;
    state.questionPrompts = [...record.questionPrompts];
    state.workflowNotes = [...record.workflowNotes];
    state.published = false;
    state.classClosed = false;
    state.elapsed = 0;
    state.hasRun = false;
    state.series = {};
    state.completedMaterials = new Set();
    state.comparison = [];
    applyActivitySnapshot(record.activity);
    renderAll();
    renderTeacher();
    persist();
    return true;
  }

  function generateClassCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  }

  function generateTeacherRecoveryCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(10);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  }

  function generateUniqueClassCode(exceptClassId = null, previousCode = "") {
    let code;
    do { code = generateClassCode(); }
    while (code === previousCode || state.classRecords.some((item) => item.id !== exceptClassId && item.code?.toUpperCase() === code));
    return code;
  }

  function recoverTeacherClass(codeValue, teacherCodeValue) {
    const code = String(codeValue || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const teacherCode = String(teacherCodeValue || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const record = state.classRecords.find((item) => String(item.code || "").toUpperCase() === code && String(item.teacherCode || "").toUpperCase() === teacherCode);
    if (!record) {
      $("#teacher-recover-status").textContent = "The class and teacher codes did not match a saved class in this browser.";
      return false;
    }
    activateClass(record.id);
    $("#teacher-recover-status").textContent = `${record.name} is open. Its saved lesson details and learner records are restored.`;
    return true;
  }

  function renameClass(id, name) {
    const record = state.classRecords.find((item) => item.id === id);
    const label = String(name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!record || !label) return false;
    if (state.classRecords.some((item) => item.id !== id && item.name.toLocaleLowerCase() === label.toLocaleLowerCase())) { showToast("A class with that name already exists."); return false; }
    record.name = label;
    renderTeacher();
    persist();
    return true;
  }

  function openStudentProfile(id) {
    const student = state.students.find((item) => item.id === id);
    if (!student) return;
    state.selectedReplayStudentId = id;
    renderTeacher();
    const questions = questionBank.map((question, index) => {
      const answer = String(student.answers?.[question.id] || "").trim();
      const mark = student.marks?.[question.id] || "";
      const feedback = student.feedback?.[question.id] || "";
      return `<div class="profile-answer"><div class="profile-answer-title"><strong>${escapeHtml(question.stage)}</strong><label>Mark<select name="mark-${question.id}" class="text-input"><option value="" ${!mark ? "selected" : ""}>Not marked</option><option value="correct" ${mark === "correct" ? "selected" : ""}>Meets criteria</option><option value="partial" ${mark === "partial" ? "selected" : ""}>Partly meets</option><option value="not-yet" ${mark === "not-yet" ? "selected" : ""}>Not yet</option></select></label></div><p class="profile-prompt">${escapeHtml(state.questionPrompts[index] || question.prompt)}</p><p class="profile-student-answer">${answer ? escapeHtml(answer) : "No response yet."}</p><label class="field-label" for="feedback-${question.id}">Teacher feedback</label><textarea id="feedback-${question.id}" name="feedback-${question.id}" class="text-area" rows="2">${escapeHtml(feedback)}</textarea></div>`;
    }).join("");
    const eventItems = [...(student.events || [])].slice(-8).reverse().map((event) => `<li><time>${new Date(event.timestampMs || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>${escapeHtml(String(event.type || "activity").replace(/_/g, " "))}</span></li>`).join("") || `<li class="no-events">No saved activity yet.</li>`;
    openDialog(`Learner profile · ${student.name}`, `<form id="student-profile-form" data-student-id="${escapeHtml(student.id)}"><label class="field-label" for="profile-student-name">Learner name</label><input id="profile-student-name" name="student-name" class="text-input" maxlength="50" required value="${escapeHtml(student.name)}"/><div class="profile-summary"><span><strong>${escapeHtml(student.progress || "Not started")}</strong><small>Progress</small></span><span><strong>${Number(student.percent || 0)}%</strong><small>Complete</small></span><span><strong>${escapeHtml(student.score || "—")}</strong><small>Marking</small></span></div><h3 class="profile-section-title">Responses and marking</h3>${questions}<label class="field-label" for="profile-general-feedback">Note for this learner</label><textarea id="profile-general-feedback" class="text-area" name="general-feedback" rows="2">${escapeHtml(student.generalFeedback || "")}</textarea><div class="profile-events"><h3 class="profile-section-title">Recent activity</h3><ul>${eventItems}</ul></div><div class="profile-actions"><button type="button" class="quiet-button" data-student-replay="${escapeHtml(student.id)}">View session replay</button><button type="submit" class="small-primary">Save profile &amp; marks</button><button type="button" class="quiet-button danger-button" data-remove-student="${escapeHtml(student.id)}">Remove learner</button></div></form>`);
  }

  function saveStudentProfile(form) {
    const student = state.students.find((item) => item.id === form.dataset.studentId);
    if (!student) return;
    const name = cleanStudentName(form.elements["student-name"].value);
    if (!name) { showToast("Enter a learner name before saving."); return; }
    const collision = state.students.some((item) => item.id !== student.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (collision) { showToast("That learner is already on this class list."); return; }
    student.name = name;
    student.initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    questionBank.forEach((question) => {
      const mark = form.elements[`mark-${question.id}`]?.value || "";
      const feedback = form.elements[`feedback-${question.id}`]?.value.trim().slice(0, 500) || "";
      if (mark) student.marks[question.id] = mark; else delete student.marks[question.id];
      if (feedback) student.feedback[question.id] = feedback; else delete student.feedback[question.id];
    });
    student.generalFeedback = form.elements["general-feedback"]?.value.trim().slice(0, 1000) || "";
    const marked = Object.values(student.marks).filter(Boolean);
    student.score = marked.length ? `${marked.filter((mark) => mark === "correct").length} / ${marked.length} marked` : student.submitted ? `${questionBank.filter((question) => String(student.answers?.[question.id] || "").trim()).length} / 6 saved` : "—";
    persist();
    renderTeacher();
    closeDialog();
    showToast(`Saved ${student.name}’s profile and marks.`);
  }

  function removeStudent(id) {
    const student = state.students.find((item) => item.id === id);
    if (!student || !window.confirm(`Remove ${student.name} and their saved responses, marks and activity from this class?`)) return;
    state.students = state.students.filter((item) => item.id !== id);
    if (state.selectedReplayStudentId === id) state.selectedReplayStudentId = "";
    if (state.currentStudentId === id) {
      state.currentStudentId = null;
      sessionStorage.removeItem(STUDENT_SESSION_KEY);
    }
    state.answers = {};
    state.submitted = false;
    persist(); renderAll(); renderTeacher(); closeDialog();
    showToast(`${student.name} was removed from the class list.`);
  }

  function renderMaterialsTable() {
    $("#materials-body").innerHTML = materials.map((material) => {
      const flow = flowBand(hydraulics(material).qMlMin);
      return `<tr><td><span class="material-key"><i class="material-dot" style="background:${material.color}"></i>${escapeHtml(material.label)}</span></td><td>${porosityBand(material.porosity)}</td><td>${flow}</td><td>${escapeHtml(material.note)}</td></tr>`;
    }).join("");
  }

  function renderAll() {
    renderControls();
    updateExperimentStatus();
    renderChart();
    renderActivityHistory();
    renderProgress();
    renderMaterialsTable();
    renderQuestions();
    $("#grain-model-range").value = String(state.grainModel);
    $("#path-model-range").value = String(state.pathModel);
    renderPoreModel();
    renderIntroStep(state.introStep);
    renderStudentAccess();
  }

  function formatClock(seconds) {
    const rounded = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
  }

  function replayEvents() {
    if (state.selectedReplayStudentId) {
      const student = state.students.find((item) => item.id === state.selectedReplayStudentId);
      return student?.events || [];
    }
    return state.events;
  }

  function reconstructAt(index, events = replayEvents()) {
    const replay = { selected: "gravel", comparison: [], headCm: 15, depthCm: 10, compaction: 0, running: false, hasRun: false, mode: "simple", elapsed: 0, series: {} };
    for (let i = 0; i <= index && i < events.length; i += 1) {
      const event = events[i];
      const data = event.payload || {};
      if (event.type === "material_selected") {
        replay.selected = data.material || replay.selected;
        replay.comparison = replay.comparison.filter((id) => id !== replay.selected);
      }
      if (event.type === "head_changed") replay.headCm = data.value || replay.headCm;
      if (event.type === "depth_changed") replay.depthCm = data.value || replay.depthCm;
      if (event.type === "compaction_changed") replay.compaction = Number.isFinite(data.value) ? data.value : replay.compaction;
      if (event.type === "mode_changed") replay.mode = data.mode || replay.mode;
      if (event.type === "compare_added" && materialById[data.material] && !replay.comparison.includes(data.material)) replay.comparison.push(data.material);
      if (event.type === "compare_removed") replay.comparison = replay.comparison.filter((id) => id !== data.material);
      if (event.type === "flow_started") {
        replay.selected = data.selected || replay.selected;
        replay.comparison = Array.isArray(data.comparison) ? data.comparison.filter((id) => materialById[id]) : replay.comparison;
        replay.headCm = Number.isFinite(data.headCm) ? data.headCm : replay.headCm;
        replay.depthCm = Number.isFinite(data.depthCm) ? data.depthCm : replay.depthCm;
        replay.compaction = Number.isFinite(data.compaction) ? data.compaction : replay.compaction;
        replay.running = true; replay.hasRun = true;
      }
      if (event.type === "flow_paused") replay.running = false;
      if (event.type === "trial_reset") { replay.running = false; replay.hasRun = false; replay.elapsed = 0; replay.series = {}; }
      if (event.type === "state_snapshot") {
        replay.selected = data.selected || replay.selected;
        replay.headCm = data.headCm || replay.headCm;
        replay.depthCm = data.depthCm || replay.depthCm;
        replay.compaction = Number.isFinite(data.compaction) ? data.compaction : replay.compaction;
        replay.mode = data.mode || replay.mode;
        replay.comparison = Array.isArray(data.comparison) ? data.comparison.filter((id) => materialById[id]) : replay.comparison;
        replay.series = data.series && typeof data.series === "object" ? structuredCloneSafe(data.series) : replay.series;
        replay.hasRun = true;
      }
      if (data.series && typeof data.series === "object") {
        replay.series = structuredCloneSafe(data.series);
        replay.hasRun = replay.hasRun || Object.values(replay.series).some((series) => (series.points?.length || 0) > 1);
      }
      if (event.type === "time_seeked") replay.hasRun = Boolean(data.hasRun ?? (Number(data.elapsed) > 0));
      replay.elapsed = Number.isFinite(event.elapsed) ? event.elapsed : replay.elapsed;
    }
    Object.values(replay.series).forEach((series) => {
      const points = series.points || [];
      if (!points.length || replay.elapsed <= points[0].t) { series.cursorVolume = 0; return; }
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        if (replay.elapsed <= points[pointIndex].t) {
          const previous = points[pointIndex - 1], next = points[pointIndex];
          const span = next.t - previous.t;
          series.cursorVolume = span > 0 ? previous.v + (next.v - previous.v) * ((replay.elapsed - previous.t) / span) : next.v;
          return;
        }
      }
      series.cursorVolume = points[points.length - 1].v;
    });
    replay.timeLimit = 120;
    return replay;
  }

  function updateReplayControls() {
    const slider = $("#replay-scrubber");
    if (!slider) return;
    const events = replayEvents();
    const max = Math.max(0, events.length - 1);
    slider.max = String(max);
    if (Number(slider.value) > max) slider.value = String(max);
    if (!events.length) {
      $("#replay-time").textContent = "00:00";
      const learner = state.students.find((item) => item.id === state.selectedReplayStudentId);
      $("#replay-caption").textContent = learner ? `${learner.name} has no saved activity yet.` : "Start a trial in the lab to create a local replay.";
      $("#replay-frame").innerHTML = "";
      return;
    }
    renderReplay(Number(slider.value));
  }

  function renderReplay(index) {
    const events = replayEvents();
    if (!events.length) return;
    index = Math.max(0, Math.min(index, events.length - 1));
    const event = events[index];
    const replay = reconstructAt(index, events);
    const material = getMaterial(replay.selected);
    const firstTime = events[0]?.timestampMs || event.timestampMs;
    $("#replay-time").textContent = formatClock((event.timestampMs - firstTime) / 1000);
    const payload = event.payload || {};
    const messages = {
      material_selected: `Selected ${material.label}.`,
      head_changed: `Changed water head to ${payload.value} cm.`,
      depth_changed: `Changed sample depth to ${payload.value} cm.`,
      compaction_changed: `Changed compaction to ${payload.value}%.`,
      mode_changed: `Switched to ${payload.mode} mode.`,
      flow_started: `Started the flow trial using ${material.label}.`,
      flow_paused: `Paused the trial after ${replay.elapsed.toFixed(0)} seconds.`,
      compare_added: `Added ${getMaterial(payload.material).label} to the comparison.`,
      compare_removed: `Removed a material from the comparison.`,
      question_answered: `Answered ${payload.question || "a lesson question"}.`,
      idle_start: "Learner paused interaction; idle time begins.",
      idle_end: "Learner returned to the activity.",
      state_snapshot: `Restored a saved simulator state at ${replay.elapsed.toFixed(0)} seconds.`,
      time_seeked: `Moved the model to ${formatClock(payload.elapsed || 0)}.`,
      trial_reset: "Reset the simulator to start a new trial.",
      trial_saved: "Saved the completed trial and its measurements in Activity History."
    };
    const learner = state.students.find((item) => item.id === state.selectedReplayStudentId);
    $("#replay-caption").textContent = `${learner ? `${learner.name} · ` : ""}${index + 1} / ${events.length} · ${messages[event.type] || "Activity state updated."}`;
    renderReplayDashboard(replay, material);
  }

  function renderReplayDashboard(replay, selectedMaterial) {
    const frame = $("#replay-frame");
    const ids = [replay.selected, ...(Array.isArray(replay.comparison) ? replay.comparison : [])]
      .filter((id, index, list) => materialById[id] && list.indexOf(id) === index);
    const materialsInReplay = ids.length ? ids.map((id) => getMaterial(id)) : [selectedMaterial];
    const elapsed = Math.max(0, Number(replay.elapsed) || 0);
    const settings = [
      { label: "Water head", value: Number(replay.headCm) || 15, min: 5, max: 30, unit: "cm" },
      { label: "Sample depth", value: Number(replay.depthCm) || 10, min: 5, max: 30, unit: "cm" },
      { label: "Compaction", value: Number(replay.compaction) || 0, min: 0, max: 100, unit: "%" }
    ];
    const sliderMarkup = settings.map((setting) => {
      const position = Math.max(0, Math.min(100, (setting.value - setting.min) / (setting.max - setting.min) * 100));
      return '<div class="replay-setting"><div><span>' + setting.label + '</span><output>' + setting.value + setting.unit + '</output></div><div class="replay-track" role="img" aria-label="' + setting.label + ': ' + setting.value + setting.unit + ', view only"><i style="width:' + position + '%"></i></div><small><span>' + setting.min + setting.unit + '</span><span>' + setting.max + setting.unit + '</span></small></div>';
    }).join("");
    const materialMarkup = materialsInReplay.map((material, index) => {
      const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
      const porosity = effectivePorosity(material, replay.compaction);
      const k = effectiveK(material, replay.compaction);
      const power = Math.floor(Math.log10(k));
      const permeability = power <= -7 ? "Very low" : power <= -5 ? "Low" : power <= -3 ? "Moderate" : "High";
      const permeabilityPosition = ({ "Very low": 12.5, Low: 37.5, Moderate: 62.5, High: 87.5 })[permeability];
      return '<article class="replay-material-card" style="--replay-material:' + color + '"><strong><i></i>' + escapeHtml(material.label) + '</strong><div class="replay-property"><span>Porosity <output>' + porosity.toFixed(0) + '%</output></span><div class="replay-track" role="meter" aria-label="' + escapeHtml(material.label) + ' porosity, ' + porosity.toFixed(0) + ' percent" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + porosity.toFixed(0) + '"><i style="width:' + porosity + '%"></i></div><small><span>0%</span><span>100%</span></small></div><div class="replay-property"><span>Permeability <output>' + permeability + '</output></span><div class="replay-track" role="img" aria-label="' + escapeHtml(material.label) + ' illustrative permeability category: ' + permeability + '"><i style="width:' + permeabilityPosition + '%"></i></div><small><span>Very low</span><span>High</span></small></div></article>';
    }).join("");
    const valuesMarkup = materialsInReplay.map((material, index) => {
      const series = replay.series && replay.series[material.id];
      const volume = Number.isFinite(series && series.cursorVolume) ? series.cursorVolume : Number(series && series.volume) || 0;
      const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
      return '<div class="replay-volume-row"><span><i style="background:' + color + '"></i>' + escapeHtml(material.label) + '</span><strong>' + formatVolume(volume) + ' <small>mL</small></strong></div>';
    }).join("");
    const visualMarkup = materialsInReplay.length > 1
      ? '<div id="replay-comparison-visual" class="replay-sample-visual"></div>'
      : '<div id="replay-activity-visual" class="replay-sample-visual"></div>';
    frame.classList.toggle("is-comparing", materialsInReplay.length > 1);
    frame.classList.add("replay-investigation");
    frame.setAttribute("aria-label", "Reconstructed Permeability Lab at " + formatClock(elapsed) + " with " + materialsInReplay.map((item) => item.label).join(", ") + ".");
    frame.innerHTML =
      '<div class="replay-investigation-head"><span>PERMEABILITY LAB <i>REPLAY VIEW</i></span><strong>' + formatClock(elapsed) + '</strong></div>' +
      '<div class="replay-investigation-grid">' +
      '<aside class="replay-settings-panel"><div class="replay-panel-heading"><span>INVESTIGATION SETTINGS</span><small>View only</small></div>' + sliderMarkup +
      '<div class="replay-material-heading"><span>SELECTED MATERIALS</span><small>Model property scales</small></div><div class="replay-material-scales">' + materialMarkup + '</div></aside>' +
      '<section class="replay-sample-panel"><div class="replay-panel-heading"><span>SIMULATED SOIL SAMPLE</span><small>' + (replay.running ? "Flowing at this event" : replay.hasRun ? "Trial state" : "Ready") + '</small></div>' +
      visualMarkup + '<div class="replay-data-readout"><div><span>ELAPSED</span><strong>' + formatClock(elapsed) + '</strong></div><div class="replay-volume-readout"><span>COLLECTED</span>' + valuesMarkup + '</div></div></section>' +
      '<section class="replay-evidence-panel"><div class="replay-panel-heading"><span>YOUR EVIDENCE</span><small>Shared linear axes</small></div><h3>Water collected over time</h3>' +
      '<svg id="replay-volume-chart" viewBox="0 0 520 260" role="img" aria-label="Reconstructed cumulative water graph"></svg><div id="replay-chart-legend" class="replay-chart-legend"></div>' +
      '<p class="replay-chart-note">Solid line: recorded result to this point. Dotted line: estimate from the settings shown. Every material uses the same linear axes.</p></section></div>';
    if (materialsInReplay.length > 1) {
      renderComparisonSamples(materialsInReplay.map((item) => item.id), $("#replay-comparison-visual"), replay);
    } else {
      renderActivitySvg($("#replay-activity-visual"), materialsInReplay[0], replay.headCm, replay.running, false, replay);
    }
    renderReplayChart(replay, materialsInReplay);
  }

  function renderReplayChart(replay, materialsInReplay) {
    const chart = $("#replay-volume-chart");
    if (!chart) return;
    const W = 520, H = 260, left = 66, right = 14, top = 18, bottom = 42;
    const plotW = W - left - right, plotH = H - top - bottom;
    const xMax = 120, visibleTime = Math.min(xMax, Math.max(0, Number(replay.elapsed) || 0));
    const xStep = 30;
    const x = (time) => left + Math.min(xMax, Math.max(0, time)) / xMax * plotW;
    const projections = materialsInReplay.map((material) => {
      const series = replay.series && replay.series[material.id];
      const collected = Number.isFinite(series && series.cursorVolume) ? series.cursorVolume : Number(series && series.volume) || 0;
      const rate = hydraulics(material, replay).qMlSec;
      return { material, series, collected, rate, endVolume: replay.hasRun ? collected + rate * (xMax - visibleTime) : rate * xMax };
    });
    const values = [0, ...projections.map((item) => item.endVolume), ...projections.flatMap((item) => (item.series && item.series.points || []).filter((point) => point.t <= visibleTime).map((point) => point.v))];
    const dataMax = Math.max(...values, .00001);
    const yStep = niceStep(dataMax / 5);
    const yMax = Math.max(yStep, Math.ceil(dataMax / yStep) * yStep);
    const y = (value) => top + plotH - Math.min(yMax, Math.max(0, value)) / yMax * plotH;
    let svg = '<title>Shared linear graph at ' + formatClock(visibleTime) + '</title>';
    for (let value = 0; value <= yMax + yStep * 1e-8; value += yStep) {
      const yy = y(value);
      svg += '<line class="chart-grid" x1="' + left + '" y1="' + yy + '" x2="' + (W - right) + '" y2="' + yy + '"/><text class="chart-label" x="' + (left - 7) + '" y="' + (yy + 3) + '" text-anchor="end">' + formatAxis(value, yStep) + '</text>';
    }
    for (let value = 0; value <= xMax; value += xStep) {
      const xx = x(value);
      svg += '<line class="chart-grid chart-time-grid" x1="' + xx + '" y1="' + top + '" x2="' + xx + '" y2="' + (top + plotH) + '"/><text class="chart-label" x="' + xx + '" y="' + (top + plotH + 15) + '" text-anchor="middle">' + value + '</text>';
    }
    svg += '<line class="chart-axis" x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + (top + plotH) + '"/><line class="chart-axis" x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (W - right) + '" y2="' + (top + plotH) + '"/>';
    projections.forEach(({ material, series, collected, rate }, index) => {
      const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
      if (replay.hasRun && series) {
        const points = (series.points || [{ t: 0, v: 0 }]).filter((point) => point.t <= visibleTime).map((point) => ({ t: point.t, v: point.v }));
        const last = points[points.length - 1];
        if (!last || last.t < visibleTime) points.push({ t: visibleTime, v: collected });
        const path = points.map((point, i) => (i ? "L" : "M") + " " + x(point.t).toFixed(1) + " " + y(point.v).toFixed(1)).join(" ");
        svg += '<path class="chart-line" stroke="' + color + '" d="' + path + '"/>';
        if (visibleTime < xMax) svg += '<path class="chart-line forecast" stroke="' + color + '" d="M ' + x(visibleTime) + ' ' + y(collected) + ' L ' + x(xMax) + ' ' + y(collected + rate * (xMax - visibleTime)) + '"/>';
      } else {
        svg += '<path class="chart-line forecast" stroke="' + color + '" d="M ' + x(0) + ' ' + y(0) + ' L ' + x(xMax) + ' ' + y(rate * xMax) + '"/>';
      }
    });
    svg += '<text class="chart-axis-title" x="16" y="' + (top + plotH / 2) + '" text-anchor="middle" transform="rotate(-90 16 ' + (top + plotH / 2) + ')">WATER COLLECTED (mL)</text><text class="chart-axis-title" x="' + (left + plotW / 2) + '" y="' + (H - 3) + '" text-anchor="middle">TIME (seconds)</text>';
    chart.innerHTML = svg;
    chart.setAttribute("aria-label", "Reconstructed cumulative water collected against time on one shared linear scale: " + projections.map((item) => item.material.label + ": " + formatVolume(item.collected) + " millilitres").join("; ") + ".");
    $("#replay-chart-legend").innerHTML = projections.map(({ material, collected }, index) => '<span class="replay-legend-item"><i style="background:' + GRAPH_COLORS[index % GRAPH_COLORS.length] + '"></i>' + escapeHtml(material.label) + ' <strong>' + formatVolume(collected) + ' mL</strong></span>').join("");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function showView(view) {
    const targetId = `view-${view}`;
    if (!$(`#${targetId}`)) return;
    state.view = view;
    $$(".view").forEach((section) => { section.hidden = section.id !== targetId; section.classList.toggle("active-view", section.id === targetId); });
    $$(".nav-item[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    renderStudentAccess();
    if (view === "teacher") renderTeacher();
    if (view === "lesson") renderQuestions();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "join") setTimeout(() => $("#join-code").focus(), 40);
  }

  function openDialog(title, content) {
    $("#dialog-title").textContent = title;
    $("#dialog-content").innerHTML = content;
    $("#info-dialog").hidden = false;
    $("#dialog-done").focus();
  }
  function closeDialog() { $("#info-dialog").hidden = true; }

  function downloadCsv() {
    const header = ["student", "class", "class_code", "lesson", "completion", "percent_complete", "score", ...questionBank.flatMap((question, index) => [`Q${index + 1}_response`, `Q${index + 1}_mark`, `Q${index + 1}_feedback`]), "teacher_note"];
    const rows = [...state.students].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((student) => [student.name, activeClass()?.name, activeClass()?.code, state.lessonTitle, student.progress, `${student.percent || 0}%`, student.score || "", ...questionBank.flatMap((question) => [student.answers?.[question.id] || "", student.marks?.[question.id] || "", student.feedback?.[question.id] || ""]), student.generalFeedback || ""]);
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeClass()?.name || "fieldnotes-class").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-report.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Class report downloaded as CSV.");
  }

  function downloadTrialCsv(attemptId) {
    const attempt = state.history.find((item) => item.id === attemptId);
    if (!attempt) return;
    const rows = [["elapsed_seconds", "material", "water_head_cm", "soil_depth_cm", "compaction_percent", "collected_ml", "pore_space_percent"]];
    (attempt.materials || [attempt.selected]).forEach((id) => {
      const material = getMaterial(id);
      const series = attempt.series?.[id];
      (series?.points || []).forEach((point) => {
        const event = [...(series.events || [])].reverse().find((item) => item.t <= point.t);
        const settings = event?.settings || attempt;
        const compaction = Number(settings.compaction) || 0;
        const porosity = Math.max(1, material.porosity - (compaction / 100) * 18);
        rows.push([point.t, material.label, settings.headCm, settings.depthCm, compaction, point.v, porosity]);
      });
    });
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fieldnotes-trial-${new Date(attempt.savedAt).toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    showToast("Trial data downloaded as CSV.");
  }

  function toggleHistoryOverlay(key) {
    if (state.historyOverlays.includes(key)) state.historyOverlays = state.historyOverlays.filter((item) => item !== key);
    else {
      if (state.historyOverlays.length >= 4) { showToast("Remove a saved line before adding another to the graph."); return; }
      state.historyOverlays.push(key);
    }
    renderActivityHistory(); renderChart(); persist();
  }

  function touchActivity() {
    state.lastActivity = Date.now();
    if (state.idle) {
      state.idle = false;
      logEvent("idle_end", {});
    }
  }

  function renderInitialSavedAnswers() {
    if (state.submitted) {
      $("#submit-message").hidden = false;
      $("#submit-message").textContent = "Your draft answers are saved in this browser. Copy your assessed responses to the class form before leaving.";
    }
  }

  function completeIntro(skipped) {
    state.introDone = true;
    logEvent("intro_completed", { skipped });
    persist();
    showView("explore");
  }

  let teacherTourStep = 0;
  const teacherTour = [
    ["1 of 4 · Set the lesson", "Name the investigation, set a learning intention and add a short task. Each class keeps its own lesson wording."],
    ["2 of 4 · Edit the prompts", "Open ‘Edit student questions and steps’ to change the six scaffolded prompts or the short guidance beside each step. One prompt or note per line; the order follows predict, test, interpret and evaluate."],
    ["3 of 4 · Model the activity", "Use Investigate to choose three materials, keep the setup steady, and read the graph alongside the particle picture. Advanced mode is optional and exposes illustrative model values."],
    ["4 of 4 · Prepare the class", "Add a class and paste learner names into its roster. Share the class code and student join link. Open a learner’s name to read answers, add marks or feedback, and choose their event replay. This browser preview saves locally; separate student devices need shared storage when the site is connected."]
  ];
  function showTeacherTour(index) {
    teacherTourStep = Math.max(0, Math.min(index, teacherTour.length - 1));
    const [title, copy] = teacherTour[teacherTourStep];
    openDialog("Teacher desk · " + title, `<p>${escapeHtml(copy)}</p><div class="tour-actions"><button class="quiet-button" type="button" data-tour-back ${teacherTourStep === 0 ? "disabled" : ""}>Back</button><button class="small-primary" type="button" data-tour-next>${teacherTourStep === teacherTour.length - 1 ? "Finish" : "Next"}</button><button class="quiet-button" type="button" data-tour-skip>Skip tour</button></div>`);
  }

  // Navigation and mode controls
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => {
    touchActivity();
    if (button.dataset.view === "join" && !state.currentStudentId && (button.classList.contains("header-join-button") || state.view === "teacher")) state.teacherPreview = true;
    showView(button.dataset.view);
  }));
  $$("[data-intro-step]").forEach((button) => button.addEventListener("click", () => { renderIntroStep(button.dataset.introStep); touchActivity(); }));
  $("#skip-intro").addEventListener("click", () => completeIntro(true));
  $("#start-investigation").addEventListener("click", () => completeIntro(false));
  $("#grain-model-range").addEventListener("input", renderPoreModel);
  $("#path-model-range").addEventListener("input", renderPoreModel);
  $("#grain-model-range").addEventListener("change", persist);
  $("#path-model-range").addEventListener("change", persist);
  $("#workflow-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-question-jump]");
    if (!button) return;
    showView("lesson");
    const card = $(`[data-question-card="${button.dataset.questionJump}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    $("[data-question]", card)?.focus({ preventScroll: true });
  });
  $("#simple-mode").addEventListener("click", () => {
    if (state.mode === "simple") return;
    state.mode = "simple"; logEvent("mode_changed", { mode: state.mode }); renderControls(); touchActivity(); persist();
  });
  $("#advanced-mode").addEventListener("click", () => {
    if (state.mode === "advanced") return;
    state.mode = "advanced"; logEvent("mode_changed", { mode: state.mode }); renderControls(); touchActivity(); persist();
  });

  wirePicker("material-picker", "material-picker-menu", "material-picker-trigger", "material-select", (id, select) => {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  wirePicker("compare-picker", "compare-picker-menu", "compare-picker-trigger", "compare-select", (id, select) => {
    select.value = id;
    renderMaterialOptions();
  });

  document.addEventListener("click", (event) => {
    [["material-picker", "material-picker-menu", "material-picker-trigger"], ["compare-picker", "compare-picker-menu", "compare-picker-trigger"]].forEach(([wrapper, menu, trigger]) => {
      if (!$(`#${wrapper}`).contains(event.target)) setPickerOpen(wrapper, menu, trigger, false);
    });
  });

  $("#material-select").addEventListener("change", (event) => {
    touchActivity();
    const next = event.target.value;
    if (restartTrialForSettingsChange("material changed")) showToast("Material changed. Start a new fair comparison.");
    const previous = state.selected;
    state.selected = next;
    if (state.comparison.includes(next)) state.comparison = state.comparison.filter((id) => id !== next);
    logEvent("material_selected", { material: next, previous });
    persist(); renderAll();
  });

  $("#add-compare").addEventListener("click", () => {
    touchActivity();
    const next = $("#compare-select").value;
    if (!next) { showToast("Choose a material to compare first."); return; }
    if (state.comparison.length >= 2) { showToast("You can compare up to three materials at once."); return; }
    if (restartTrialForSettingsChange("comparison changed")) showToast("Comparison changed. Start a new fair trial.");
    state.comparison.push(next);
    logEvent("compare_added", { material: next });
    persist(); renderAll();
  });
  $("#compare-chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-compare]");
    if (!button) return;
    const id = button.dataset.removeCompare;
    if (restartTrialForSettingsChange("comparison changed")) showToast("Comparison changed. Start a new fair trial.");
    state.comparison = state.comparison.filter((item) => item !== id);
    logEvent("compare_removed", { material: id });
    persist(); renderAll(); touchActivity();
  });

  let settleTimer;
  function wireRange(selector, key, eventType, outputSelector, unit) {
    $(selector).addEventListener("input", (event) => {
      if (state.running) settleClock(performance.now());
      if (state.hasRun && state.elapsed < recordedUntil() - 1e-6) {
        event.target.value = String(state[key]);
        showToast("Return to the latest recorded time before changing the trial settings.");
        return;
      }
      state[key] = Number(event.target.value);
      if (state.hasRun) activeMaterialIds().forEach(addSimulationEvent);
      $(outputSelector).textContent = `${state[key]}${unit}`;
      renderAdvanced(); updateExperimentStatus(); renderChart(); renderMaterialsTable();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        logEvent(eventType, { value: state[key], series: structuredCloneSafe(state.series) });
        persist();
      }, 320);
      touchActivity();
    });
  }
  wireRange("#head-range", "headCm", "head_changed", "#head-output", " cm");
  wireRange("#depth-range", "depthCm", "depth_changed", "#depth-output", " cm");
  wireRange("#compact-range", "compaction", "compaction_changed", "#compact-output", "%");
  $("#run-trial").addEventListener("click", () => { touchActivity(); setRunning(!state.running); });
  $("#reset-trial").addEventListener("click", () => { touchActivity(); resetTrial(); });
  [$("#activity-history-list"), $("#chart-legend")].forEach((container) => container.addEventListener("click", (event) => {
    const overlay = event.target.closest("[data-history-overlay]");
    const exportButton = event.target.closest("[data-export-trial]");
    if (overlay) { toggleHistoryOverlay(overlay.dataset.historyOverlay); return; }
    if (exportButton) downloadTrialCsv(exportButton.dataset.exportTrial);
  }));
  $("#trial-scrubber").addEventListener("input", (event) => seekTrialTo(event.target.value, false));
  $("#trial-scrubber").addEventListener("change", (event) => { seekTrialTo(event.target.value, true); touchActivity(); });
  $("#advance-trial").addEventListener("click", () => {
    const slider = $("#trial-scrubber");
    const next = Math.min(Number(slider.max), Number(slider.value) + 10);
    slider.value = String(next);
    seekTrialTo(next, true);
    touchActivity();
  });

  // Lesson responses are saved as the learner works; short responses stay pending review.
  $("#question-list").addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("input[type=radio]")) {
      state.answers[target.name] = target.value;
      logEvent("question_answered", { question: target.name, answer: target.value });
      renderQuestions(); persist(); touchActivity();
      const restore = $(`input[name="${target.name}"][value="${target.value}"]`);
      restore?.focus();
    } else if (target.matches("[data-question]")) {
      state.answers[target.dataset.question] = target.value;
      logEvent("question_answered", { question: target.dataset.question, answer: target.value.slice(0, 80) });
      renderProgress(); persist(); touchActivity();
    }
  });
  $("#question-list").addEventListener("input", (event) => {
    const target = event.target;
    if (!target.matches("[data-question]")) return;
    state.answers[target.dataset.question] = target.value;
    renderProgress();
    clearTimeout(target.persistTimer);
    target.persistTimer = setTimeout(() => {
      logEvent("question_answered", { question: target.dataset.question, answer: target.value.slice(0, 80) });
      persist();
    }, 500);
    touchActivity();
  });
  $("#submit-lesson").addEventListener("click", () => {
    touchActivity();
    state.submitted = true;
    logEvent("attempt_submitted", {});
    $("#submit-message").hidden = false;
    $("#submit-message").textContent = "Your draft answers are saved in this browser. Copy your assessed responses to the class form before leaving.";
    renderQuestions();
    persist();
    showToast("Check-in saved on this device.");
  });

  // Teacher preview: local roster, authored lesson, event reconstruction and CSV.
  $("#lesson-name").addEventListener("input", (event) => { state.lessonTitle = event.target.value.slice(0, 100); renderQuestions(); persist(); });
  $("#lesson-intentions").addEventListener("input", (event) => { state.lessonIntentions = event.target.value.slice(0, 500); renderQuestions(); persist(); });
  $("#lesson-description").addEventListener("input", (event) => { state.lessonDescription = event.target.value.slice(0, 500); renderQuestions(); persist(); });
  $("#question-editor").addEventListener("input", (event) => { state.questionPrompts = event.target.value.split(/\r?\n/).slice(0, questionBank.length).map((line, index) => line.trim().slice(0, 400) || questionBank[index].prompt); persist(); });
  $("#workflow-editor").addEventListener("input", (event) => { state.workflowNotes = event.target.value.split(/\r?\n/).slice(0, defaultWorkflowNotes.length).map((line, index) => line.trim().slice(0, 300) || defaultWorkflowNotes[index]); persist(); });
  $("#save-teacher-edits").addEventListener("click", () => { renderQuestions(); renderProgress(); persist(); showToast("Question and step wording saved in this preview."); });
  $("#restore-defaults").addEventListener("click", () => {
    state.questionPrompts = questionBank.map((question) => question.prompt);
    state.workflowNotes = [...defaultWorkflowNotes];
    $("#question-editor").value = state.questionPrompts.join("\n");
    $("#workflow-editor").value = state.workflowNotes.join("\n");
    renderQuestions(); persist(); showToast("Default scaffold restored.");
  });
  $("#publish-lesson").addEventListener("click", () => {
    state.published = true;
    logEvent("lesson_published", { title: state.lessonTitle });
    renderTeacher(); persist(); showToast("Lesson published in this preview.");
  });
  $("#export-class").addEventListener("click", downloadCsv);
  $("#teacher-tour-start").addEventListener("click", () => showTeacherTour(0));
  $("#active-class-select").addEventListener("change", (event) => activateClass(event.target.value));
  $("#teacher-recover-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const opened = recoverTeacherClass($("#teacher-recover-class-code").value, $("#teacher-recover-code").value);
    if (opened) showToast("Saved class reopened. Lesson details and roster restored.");
  });
  $("#copy-teacher-recovery-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(activeClass()?.teacherCode || "");
      $("#copy-teacher-recovery-code").textContent = "Copied";
      setTimeout(() => { $("#copy-teacher-recovery-code").textContent = "Copy code"; }, 1800);
    } catch { showToast("Select and copy the teacher recovery code above."); }
  });
  $("#lesson-history-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-recover-class]");
    const record = state.classRecords.find((item) => item.id === button?.dataset.recoverClass);
    if (!record) return;
    $("#teacher-recover-class-code").value = record.code;
    $("#teacher-recover-code").focus();
    $("#teacher-recover-form").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#new-class").addEventListener("click", () => openDialog("Add a class", `<form id="new-class-form"><label class="field-label" for="new-class-name">Class name</label><input id="new-class-name" name="class-name" class="text-input" maxlength="80" required placeholder="e.g. Period 2 Science"/><div class="profile-actions"><button type="button" class="quiet-button" data-dialog-cancel>Cancel</button><button type="submit" class="small-primary">Create class</button></div></form>`));
  $("#rename-class").addEventListener("click", () => openDialog("Rename class", `<form id="rename-class-form"><label class="field-label" for="rename-class-name">Class name</label><input id="rename-class-name" name="class-name" class="text-input" maxlength="80" required value="${escapeHtml(activeClass()?.name || "")}"/><div class="profile-actions"><button type="button" class="quiet-button" data-dialog-cancel>Cancel</button><button type="submit" class="small-primary">Save name</button></div></form>`));
  $("#delete-class").addEventListener("click", () => {
    if (state.classRecords.length <= 1) { showToast("Keep at least one class in the workspace."); return; }
    const record = activeClass();
    if (!window.confirm(`Delete “${record.name}” and its local roster, answers and activity records?`)) return;
    persist();
    state.classRecords = state.classRecords.filter((item) => item.id !== record.id);
    const next = state.classRecords[0];
    state.activeClassId = next.id;
    state.currentStudentId = null;
    state.selectedReplayStudentId = "";
    state.students = next.students;
    state.lessonTitle = next.lessonTitle;
    state.lessonIntentions = next.lessonIntentions || defaultLearningIntention;
    state.lessonDescription = next.lessonDescription;
    state.questionPrompts = [...next.questionPrompts];
    state.workflowNotes = [...next.workflowNotes];
    state.published = next.published;
    state.classClosed = next.classClosed;
    state.events = [...(next.events || [])];
    state.answers = next.draftAnswers || {};
    state.submitted = false;
    applyActivitySnapshot(next.activity);
    renderAll(); renderTeacher(); persist();
    showToast(`Deleted ${record.name}.`);
  });
  $("#randomize-code").addEventListener("click", () => {
    const record = activeClass();
    if (!record) return;
    const previousCode = record.code;
    record.code = generateUniqueClassCode(record.id, previousCode);
    persist();
    renderTeacher();
    $("#student-link-copy").textContent = `Code changed to ${record.code}. The student link now pre-fills it; the previous code no longer works.`;
    showToast(`New code for ${record.name}: ${record.code}`);
  });
  $("#copy-student-link").addEventListener("click", () => {
    const link = studentJoinUrl();
    if (!navigator.clipboard?.writeText) { $("#student-link-copy").textContent = "Select the link shown above to copy it."; return; }
    navigator.clipboard.writeText(link.href).then(() => {
      $("#student-link-copy").textContent = "Student link copied";
      setTimeout(() => { $("#student-link-copy").textContent = ""; }, 2500);
    }).catch(() => { $("#student-link-copy").textContent = "Select the link shown above to copy it."; });
  });
  $("#header-qr-code").addEventListener("click", () => {
    const link = studentJoinUrl();
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&format=svg&margin=8&data=${encodeURIComponent(link.href)}`;
    openDialog("Student website QR code", `<div class="student-qr-dialog"><p>Scan this code with a phone camera to open the student join page.</p><img id="student-qr-image" src="${escapeHtml(qrImage)}" alt="QR code for ${escapeHtml(link.href)}" /><p id="student-qr-error" class="student-qr-error" hidden>The QR image could not load. Use the student link below.</p><code class="student-qr-url">${escapeHtml(link.href)}</code><button id="copy-qr-student-link" type="button" class="outline-button">Copy student link</button></div>`);
    $("#student-qr-image").addEventListener("error", () => { $("#student-qr-image").hidden = true; $("#student-qr-error").hidden = false; });
    $("#copy-qr-student-link").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link.href);
        $("#copy-qr-student-link").textContent = "Link copied";
      } catch {
        $("#copy-qr-student-link").textContent = "Select the link above to copy it.";
      }
    });
  });
  $("#preview-student-view").addEventListener("click", (event) => {
    const preview = window.open(event.currentTarget.dataset.url, "_blank");
    if (!preview) showToast("Allow pop-ups to open the learner preview.");
    else preview.opener = null;
  });
  $("#return-teacher-view").addEventListener("click", () => {
    if (!state.teacherPreview) return;
    if (state.currentStudentId) {
      persist();
      sessionStorage.removeItem(STUDENT_SESSION_KEY);
    }
    state.currentStudentId = null;
    state.teacherPreview = false;
    state.selectedReplayStudentId = "";
    const record = activeClass();
    state.students = record.students;
    state.events = Array.isArray(record.events) ? record.events.slice(-600) : [];
    state.answers = record.draftAnswers || {};
    state.submitted = false;
    applyActivitySnapshot(record.activity);
    state.view = "teacher";
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    renderAll();
    renderTeacher();
    showView("teacher");
    persist();
  });
  $("#add-students").addEventListener("click", () => {
    const raw = $("#bulk-students").value;
    const names = raw.split(/\r?\n/).flatMap((line, rowIndex) => {
      if (line.includes("\t")) {
        const columns = line.split("\t").map((value) => value.trim());
        if (rowIndex === 0 && /^(first|given|learner|student|name)/i.test(columns[0]) && /^(last|family|surname)/i.test(columns[1] || "")) return [];
        return [columns.slice(0, 2).filter(Boolean).join(" ")];
      }
      return line.split(/[;,]+/);
    }).map(cleanStudentName).filter(Boolean);
    const known = new Set(state.students.map((student) => student.name.toLocaleLowerCase()));
    const added = [];
    const skipped = [];
    names.forEach((name) => {
      const key = name.toLocaleLowerCase();
      if (known.has(key)) { skipped.push(name); return; }
      known.add(key);
      const student = makeStudent(name);
      state.students.push(student);
      added.push(name);
    });
    $("#bulk-students").value = "";
    renderTeacher(); persist();
    showToast(added.length ? `Added ${added.length} ${added.length === 1 ? "learner" : "learners"}${skipped.length ? `; skipped ${skipped.length} duplicate${skipped.length === 1 ? "" : "s"}` : ""}.` : skipped.length ? "Those names are already on the roster." : "Enter one or more learner names first.");
  });
  $("#roster-body").addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-id]");
    if (button) openStudentProfile(button.dataset.studentId);
  });
  $("#dialog-content").addEventListener("click", (event) => {
    if (event.target.closest("[data-tour-next]")) {
      if (teacherTourStep === teacherTour.length - 1) closeDialog();
      else showTeacherTour(teacherTourStep + 1);
    } else if (event.target.closest("[data-tour-back]")) showTeacherTour(teacherTourStep - 1);
    else if (event.target.closest("[data-tour-skip]")) closeDialog();
    else if (event.target.closest("[data-dialog-cancel]")) closeDialog();
    else if (event.target.closest("[data-remove-student]")) removeStudent(event.target.closest("[data-remove-student]").dataset.removeStudent);
    else if (event.target.closest("[data-student-replay]")) {
      state.selectedReplayStudentId = event.target.closest("[data-student-replay]").dataset.studentReplay;
      $("#replay-learner-select").value = state.selectedReplayStudentId;
      updateReplayControls();
      closeDialog();
      $(".replay-card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  $("#dialog-content").addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "student-profile-form") { saveStudentProfile(event.target); return; }
    if (event.target.id === "new-class-form") {
      if (addClass(event.target.elements["class-name"].value)) { closeDialog(); showToast("Class created and saved in this browser."); }
    }
    if (event.target.id === "rename-class-form") {
      if (renameClass(state.activeClassId, event.target.elements["class-name"].value)) { closeDialog(); showToast("Class name saved."); }
    }
  });
  $("#close-class").addEventListener("click", () => {
    state.classClosed = !state.classClosed;
    renderTeacher(); persist(); showToast(state.classClosed ? "Class closed to new joins." : "Class reopened.");
  });
  $("#replay-scrubber").addEventListener("input", (event) => renderReplay(Number(event.target.value)));
  $("#replay-learner-select").addEventListener("change", (event) => { state.selectedReplayStudentId = event.target.value; $("#replay-scrubber").value = "0"; updateReplayControls(); });
  let replayTimer = null;
  $("#replay-play").addEventListener("click", () => {
    if (!replayEvents().length) { showToast("Choose a learner with saved activity, or start a trial to create a replay."); return; }
    if (replayTimer) {
      clearInterval(replayTimer); replayTimer = null; $("#replay-play").textContent = "▶"; return;
    }
    $("#replay-play").textContent = "Ⅱ";
    replayTimer = setInterval(() => {
      const slider = $("#replay-scrubber");
      const events = replayEvents();
      let next = Number(slider.value) + 1;
      if ($("#skip-idle").checked) {
        while (next < events.length - 1 && ["idle_start", "idle_end"].includes(events[next]?.type)) next += 1;
      }
      if (next >= events.length) {
        clearInterval(replayTimer); replayTimer = null; $("#replay-play").textContent = "▶"; return;
      }
      slider.value = String(next); renderReplay(next);
    }, 800 / Number($("#replay-speed").value));
  });
  $("#replay-speed").addEventListener("change", () => {
    if (!replayTimer) return;
    clearInterval(replayTimer); replayTimer = null; $("#replay-play").click();
  });

  // Student join is matched to a teacher-prepared name in the selected local class.
  if (joiningFromLink && routeParams.get("code")) $("#join-code").value = routeParams.get("code").toUpperCase().replace(/[^A-Z0-9]/g, "");
  $("#join-form").addEventListener("submit", (event) => {
    event.preventDefault(); touchActivity();
    const code = $("#join-code").value.trim().toUpperCase();
    const name = cleanStudentName($("#join-name").value);
    const record = state.classRecords.find((item) => item.code.toUpperCase() === code);
    if (!record) { $("#join-error").textContent = "This code is not available in this browser. Check the latest student link or code. Cross-device joining needs shared class storage, which is not connected in this preview yet."; $("#join-error").hidden = false; return; }
    if (record.classClosed) { $("#join-error").textContent = "This class is closed. Please ask your teacher for help."; $("#join-error").hidden = false; return; }
    if (!name) { $("#join-error").textContent = "Please enter your first, or first and last name"; $("#join-error").hidden = false; return; }
    if (record.id !== state.activeClassId) activateClass(record.id);
    const needle = name.toLocaleLowerCase();
    const exact = state.students.find((student) => student.name.toLocaleLowerCase() === needle);
    const firstMatches = state.students.filter((student) => student.name.split(/\s+/)[0].toLocaleLowerCase() === needle);
    const existing = exact || (firstMatches.length === 1 ? firstMatches[0] : null);
    if (!existing) { $("#join-error").textContent = "Please enter your first, or first and last name"; $("#join-error").hidden = false; return; }
    $("#join-error").hidden = true;
    state.currentStudentId = existing.id;
    sessionStorage.setItem(STUDENT_SESSION_KEY, existing.id);
    window.history.replaceState({}, "", `${window.location.pathname}?mode=join`);
    if (state.teacherPreview) {
      const learnerPreviewUrl = new URL(window.location.href);
      learnerPreviewUrl.searchParams.set("teacherPreview", "1");
      learnerPreviewUrl.searchParams.set("code", record.code);
      window.history.replaceState({}, "", learnerPreviewUrl.pathname + learnerPreviewUrl.search);
    }
    state.answers = existing.answers || {};
    state.submitted = Boolean(existing.submitted);
    state.events = Array.isArray(existing.events) ? existing.events.slice(-600) : [];
    applyActivitySnapshot(existing.activity || activeClass().activity);
    logEvent("student_joined", { name: existing.name });
    persist(); renderAll(); renderTeacher(); showView("explore");
    showToast(`Welcome back, ${existing.name}. Your work is saved in this browser.`);
  });
  $("#join-code").addEventListener("input", (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });

  // Short, student-facing explanations for the chart and model assumptions.
  $("#what-is-darcy").addEventListener("click", () => openDialog("What makes water move?", `<p>Water moves through a porous material when there is a difference in water pressure. In this activity, the water head creates that push.</p><p><strong>Darcy’s law</strong> connects the material’s hydraulic conductivity (K), the sample area, and the pressure gradient (head difference ÷ sample length) to the discharge (Q).</p><p>On the graph, Q appears as the <strong>slope</strong>: a steeper line means more water is moving each second. If you change one setting at a time, you can see which part of the setup changed that slope.</p>`));
  $("#formula-help").addEventListener("click", () => openDialog("What do these numbers mean?", `<p><strong>K</strong> describes how readily the material transmits water. <strong>A</strong> is the sample’s cross-sectional area (0.0008 m²). <strong>Δh</strong> is the water head, and <strong>L</strong> is the sample depth.</p><p>The model uses Q = K × A × (Δh ÷ L). Porosity is displayed separately because more pore space does not automatically mean faster flow.</p>`));
  $("#why-slow").addEventListener("click", () => openDialog("Why might this sample flow slowly?", `<p>Water pathways depend on pore size and how well those pores connect. Clay can have a high total fraction of pore space but tiny pores that resist flow.</p><p>The animation is a teaching illustration. It does not model individual water molecules or claim to be a physical-scale experiment.</p>`));
  $("#about-model").addEventListener("click", () => openDialog("About this classroom model", `<p>Flow is calculated with Darcy’s law, using one representative hydraulic conductivity for each material. Porosity is an independent material property.</p><p>Compaction reduces effective porosity and conductivity using a simplified teaching curve. Natural soils and rocks vary widely; see the Material Library for source notes and limitations.</p><p>This interactive is a browser-only classroom preview. Its sample roster, lesson and activity history stay on this device.</p>`));
  document.addEventListener("click", (event) => {
    const term = event.target.closest("[data-glossary]");
    if (!term) return;
    const item = glossary[term.dataset.glossary];
    if (!item) return;
    openDialog(item.title, `<p>${escapeHtml(item.meaning)}</p><p><strong>Example:</strong> ${escapeHtml(item.example)}</p>`);
  });
  $("#dialog-close").addEventListener("click", closeDialog);
  $("#dialog-done").addEventListener("click", closeDialog);
  $("#info-dialog").addEventListener("click", (event) => { if (event.target === $("#info-dialog")) closeDialog(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const remote = JSON.parse(event.newValue);
      if (!Array.isArray(remote.classes)) return;
      state.classRecords = remote.classes.filter((item) => item && typeof item === "object").map((item) => ({ ...item, students: (Array.isArray(item.students) ? item.students : []).map(normalizeStudent) }));
      let record = activeClass();
      if (!record) return;
      state.students = record.students;
      if (state.currentStudentId) {
        const learner = currentStudent();
        if (learner) {
          state.answers = learner.answers || {};
          state.submitted = Boolean(learner.submitted);
          state.events = Array.isArray(learner.events) ? learner.events.slice(-600) : [];
          applyActivitySnapshot(learner.activity || record.activity);
        }
      }
      state.lessonTitle = record.lessonTitle || state.lessonTitle;
      state.lessonIntentions = record.lessonIntentions || defaultLearningIntention;
      state.lessonDescription = record.lessonDescription || state.lessonDescription;
      state.questionPrompts = Array.isArray(record.questionPrompts) ? record.questionPrompts : state.questionPrompts;
      state.workflowNotes = Array.isArray(record.workflowNotes) ? record.workflowNotes : state.workflowNotes;
      state.published = Boolean(record.published);
      state.classClosed = Boolean(record.classClosed);
      renderAll();
      renderTeacher();
    } catch { /* Ignore another tab's incomplete local save. */ }
  });

  document.addEventListener("pointerdown", touchActivity, { passive: true });
  document.addEventListener("keydown", touchActivity);

  // Integrate between control changes, then sample one shared simulation clock.
  setInterval(() => {
    if (!state.running) return;
    settleClock(performance.now());
    updateExperimentStatus(); renderChart(); renderAdvanced();
    if (Math.floor(state.elapsed * 2) % 4 === 0) persist();
  }, 200);
  setInterval(() => {
    if (!state.idle && Date.now() - state.lastActivity > 30000 && (state.running || state.hasRun)) {
      state.idle = true; logEvent("idle_start", {});
    }
  }, 5000);

  // Restore the full material list before mode rendering: Simple and Advanced share it.
  renderAll();
  renderTeacher();
  renderInitialSavedAnswers();
  if (needsFirstClassCodeSave || needsTeacherCodeSave) persist();
  if (state.view !== "explore") showView(state.view);
  updateReplayControls();
})();
