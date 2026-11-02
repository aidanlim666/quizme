# QuizMe

Answer a college-level CS question before Instagram opens.

Every time you open Instagram on your iPhone, QuizMe shows you a question first. It might be on linear algebra, internet programming, machine architecture, operating systems, data structures and algorithms, discrete math, networking, or databases. Get it right and you're in. After 2 wrong tries, the answer and an explanation are shown, and you still have to enter the correct answer to continue.

## How it works

There's no App Store app. QuizMe is an **iOS Shortcuts automation** plus a **static web page**:

1. A Shortcuts automation runs **QuizMe Gate** whenever Instagram is opened.
2. If you didn't unlock in the last 30 seconds, Gate opens the quiz page in Safari.
3. A correct answer links to the **QuizMe Unlock** shortcut, which saves an unlock file and reopens Instagram. The automation fires again, sees the fresh file, and lets you through.

See [`shortcuts/README.md`](shortcuts/README.md) for the exact shortcut actions, and `web/setup.html` for the guide users follow.

## Project layout

```
web/                     static site (deploy this folder)
  index.html             quiz page
  setup.html             install guide
  styles.css
  src/
    config.js            shortcut name, attempt limit, iCloud links
    quiz.js              UI and state machine
    grading.js           pure grading: normalize, numeric, regex, MCQ
    select.js            pure question selection and shuffling
    render.js            tiny Markdown subset (math is typeset by KaTeX)
    storage.js           guarded localStorage
  questions/
    topics.json          topic manifest
    <topic>.json         one array of questions per topic
scripts/
  validate-questions.mjs schema and consistency checks for the bank
  serve.mjs              zero-dependency dev server
tests/                   node --test unit tests
shortcuts/README.md      shortcut build sheet and device test checklist
```

No dependencies and no build step. KaTeX and highlight.js load from cdnjs.

## Develop

```sh
npm run dev        # http://localhost:8080 (also prints a LAN URL for testing on your iPhone)
npm run check      # validate the question bank and run unit tests
```

## Add questions

Add objects to the right `web/questions/<topic>.json`, then run `npm run validate`.

```jsonc
{
  "id": "os-013",                 // <prefix>-<3 digits>, unique
  "topic": "operating-systems",   // must match the file's topic
  "difficulty": 2,                // 1–3
  "type": "text",                 // "mcq" or "text"
  "match": "numeric",             // text only: "exact" (default) | "numeric" | "regex"
  "tolerance": 0.01,              // numeric only (default 1e-6)
  "prompt": "Markdown: **bold**, `code`, ```fenced code```, $inline$ and $$display$$ math",
  "answer": ["4"],                // mcq: index into choices; text: accepted answers (or regexes)
  "display": "…",                 // required for regex; shown when the answer is revealed
  "explanation": "Why."
}
```

Guidelines:
- Text answers should be **short and deterministic**: a number, a single term, a status code. Grading ignores case, whitespace, quotes, trailing punctuation and hyphen-vs-space. Numeric matching also accepts `0x2F`, `0b101`, `3/4`, `1,000` and a trailing unit (`8 ms`).
- MCQ choices are **shuffled**, so don't write "All of the above". The validator rejects it.
- Have a person check every answer before it ships. The validator catches structural mistakes, not wrong facts.
- In JSON, LaTeX backslashes are doubled: `"$\\det(A)$"`, and a matrix row break is `\\\\`.

## Deploy

Any static host works. Serve the `web/` folder.

- **GitHub Pages:** push to GitHub, then Settings → Pages → Source: *GitHub Actions*. `.github/workflows/pages.yml` runs `npm run check` and then publishes `web/`.
- **Vercel / Netlify:** set the root/publish directory to `web` and leave the build command empty.

After deploying, set the Gate shortcut's URL to the site address and publish the iCloud links (see `shortcuts/README.md`).

## Known limitations

- Users can bypass QuizMe by turning off the automation. It's a commitment device, not parental control.
- The automation must be created by hand on each phone.
- Each quiz opens a new Safari tab, and Safari asks "Open in Shortcuts?" once per unlock.
- The page needs a connection to load questions. Instagram needs one too.
