<!--
author:   MINT-the-GAP, Martin Lommatzsch, Jihad Hyadi
version:  1.1.0
language: en
edit: true
narrator: US English Female
comment:  LiaScript Textmarker — interactive text highlighting and marker-quiz plugin. Import-safe, no observer feedback loops, panel always in viewport.

script:   ./dist/index.js

TextmarkerQuiz: <span class="hlq-proxy"><span class="hlq-msg"></span><button class="hlq-btn" type="button" data-hlq-act="check">Check</button><button class="hlq-btn" type="button" data-hlq-act="solve">Solve</button><span class="hlq-lia">[[ 1 ]]</span></span>

markred:    <span class="lia-hl-target" data-hl-expected="red"    data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markblue:   <span class="lia-hl-target" data-hl-expected="blue"   data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markgreen:  <span class="lia-hl-target" data-hl-expected="green"  data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markyellow: <span class="lia-hl-target" data-hl-expected="yellow" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markpink:   <span class="lia-hl-target" data-hl-expected="pink"   data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markorange: <span class="lia-hl-target" data-hl-expected="orange" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>

mark: <span class="lia-hl-target" data-hl-expected="any" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>

markedred:    <span class="lia-hl-prefill" data-hl-prefill="red">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedblue:   <span class="lia-hl-prefill" data-hl-prefill="blue">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedgreen:  <span class="lia-hl-prefill" data-hl-prefill="green">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedyellow: <span class="lia-hl-prefill" data-hl-prefill="yellow">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedpink:   <span class="lia-hl-prefill" data-hl-prefill="pink">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedorange: <span class="lia-hl-prefill" data-hl-prefill="orange">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>

-->

# LiaScript Textmarker Plugin

          --{{0}}--
A LiaScript plugin that adds interactive text highlighting to courses. Students can highlight text in multiple colors using a toolbar. The plugin also supports marker-quiz exercises where specific text must be highlighted in a given color.

__Try it on LiaScript:__
https://liascript.github.io/course/?https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/main/README.md

__See the project on GitHub:__
https://github.com/MINT-the-GAP/lia-marker

           {{1}}
1. Load the macros via

   `import: https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/main/README.md`

   or pin to a specific version:

   `import: https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/0.0.1/README.md`

   The exterior solution-block syntax documented below requires `main` until
   a newer release tag is published. The pinned `0.0.1` import remains
   available for courses that require the original behavior.

2. Copy the definitions into your project

3. Clone this repository on GitHub

## Highlighting Tool

          --{{0}}--
A toolbar button appears in the navigation bar. Click it to open the color picker, then drag over text to highlight it. Click a highlight to remove it.

## Explain Word Mode

          --{{0}}--
The panel includes an `Explain Word` button between color selection and `Clear all`. Activate it, then select exactly one word in the text. A tooltip appears with a short dictionary explanation.

Language detection supports:

- German
Ich programmiere hier so rum und hoffe, dass meine Ergebnisse richtig sind.

- English
I'm just tinkering with the programming here, hoping my results are correct.

- Spanish
Estoy experimentando con la programación y espero que los resultados sean correctos.

- French
Je fais juste quelques essais avec la programmation et j'espère que mes résultats sont corrects.

- Russian
Я просто экспериментирую с программированием и надеюсь, что мои результаты верны.

- Latin
Modo cum programmatione hic ludo et spero mea eventa recta esse.

Optional/heuristic support:

- Czech
Jen si hraju s programováním a doufám, že mé výsledky budou správné.

- Polish
Po prostu bawię się programowaniem i mam nadzieję, że wyniki są poprawne.

### Data source, licensing, and privacy

- Source: Wiktionary via Wikimedia API endpoints (`*.wiktionary.org/w/api.php`)
- License: Dictionary content is from Wiktionary, typically under CC BY-SA (see source links in tooltip)
- Privacy: Only the selected word is sent to Wikimedia for lookup. No user profile, account, or course progress data is transmitted by this plugin.
- Cost: The integration uses publicly accessible Wikimedia endpoints without paid API keys.

## Marker Quiz Macros

          --{{0}}--
Use `@markCOLOR(text)` to define which text a student must highlight in a specific color. Pair with `@TextmarkerQuiz` to add Check / Solve buttons.

The quiz can be used without an explanatory solution:

```markdown
<div class="markerquiz">
@markred(Katze) @markblue(Schritt)
@TextmarkerQuiz
</div>
```

---

<div class="markerquiz">
@markred(Katze) @markblue(Schritt)
@TextmarkerQuiz
</div>

Or add a LiaScript-style explanatory solution after the closing `</div>`.
It stays hidden after a failed check and appears only after a correct check or
after the learner selects Resolve:

```markdown
<div class="markerquiz">
@markred(Katze) @markblue(Schritt)
@TextmarkerQuiz
</div>
**************
Musterlösungstext
**************
```

---

<div class="markerquiz">
@markred(Katze) @markblue(Schritt)
@TextmarkerQuiz
</div>
**************
Musterlösungstext
**************

The optional solution works with every target macro:
`@markred`, `@markblue`, `@markgreen`, `@markyellow`, `@markpink`,
`@markorange`, and the any-color variant `@mark`.

Use `@mark(text)` to accept any color:

```markdown
<div class="markerquiz">
@mark(Highlight this, using any color.)
@TextmarkerQuiz
</div>
```

---

<div class="markerquiz">
@mark(Highlight this, using any color.)
@TextmarkerQuiz
</div>


## Pre-filled Highlights

          --{{0}}--
Use `@markedCOLOR(text)` to show text pre-highlighted (read-only, for demonstration):

`@markedred(red)` → @markedred(red)

`@markedblue(blue)` → @markedblue(blue)

`@markedyellow(yellow)` → @markedyellow(yellow)

`@markedpink(pink)` → @markedpink(pink)

`@markedgreen(green)` → @markedgreen(green)

`@markedorange(orange)` → @markedorange(orange)

## Implementation

          --{{0}}--
If you prefer not to use `import:`, copy the following block directly into the header of your LiaScript document.

```markdown
script:   https://raw.githubusercontent.com/MINT-the-GAP/lia-marker/main/dist/index.js

TextmarkerQuiz: <span class="hlq-proxy"><span class="hlq-msg"></span><button class="hlq-btn" type="button" data-hlq-act="check">Check</button><button class="hlq-btn" type="button" data-hlq-act="solve">Solve</button><span class="hlq-lia">[[ 1 ]]</span></span>

markred:    <span class="lia-hl-target" data-hl-expected="red"    data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markblue:   <span class="lia-hl-target" data-hl-expected="blue"   data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markgreen:  <span class="lia-hl-target" data-hl-expected="green"  data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markyellow: <span class="lia-hl-target" data-hl-expected="yellow" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markpink:   <span class="lia-hl-target" data-hl-expected="pink"   data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markorange: <span class="lia-hl-target" data-hl-expected="orange" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>

mark: <span class="lia-hl-target" data-hl-expected="any" data-hl-quiz="default">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>

markedred:    <span class="lia-hl-prefill" data-hl-prefill="red">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedblue:   <span class="lia-hl-prefill" data-hl-prefill="blue">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedgreen:  <span class="lia-hl-prefill" data-hl-prefill="green">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedyellow: <span class="lia-hl-prefill" data-hl-prefill="yellow">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedpink:   <span class="lia-hl-prefill" data-hl-prefill="pink">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
markedorange: <span class="lia-hl-prefill" data-hl-prefill="orange">@0<span hidden data-hl-extra="@1|@2|@3|@4|@5|@6|@7|@8|@9"></span></span>
```

## Tests

`npm test` runs the type-check, rebuilds `dist/index.js`, and executes the
suite in Chromium, Firefox, and WebKit. `npm run test:browsers` additionally
uses installed Google Chrome and Microsoft Edge.

The functional tests normally intercept the public Raw-GitHub URLs with the
current working tree, so URL resolution is identical without requiring a push.
After publishing a commit, run the same suite against that immutable online
revision:

```powershell
$env:LIA_MARKER_TEST_REF = "<commit-sha>"
$env:LIA_MARKER_TEST_LIVE = "1"
npm run test:browsers
```
