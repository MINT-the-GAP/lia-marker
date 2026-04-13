<!--
author:   MINT-the-GAP
version:  0.0.1
language: en
edit: true
narrator: US English Female
comment:  LiaScript Textmarker — interactive text highlighting and marker-quiz plugin. Import-safe, no observer feedback loops, panel always in viewport.

script:   ./dist/index.js

TextmarkerQuiz: <span class="hlq-proxy"><span class="hlq-msg"></span><button class="hlq-btn" type="button" data-hlq-act="check">Prüfen</button><button class="hlq-btn" type="button" data-hlq-act="solve">Auflösen</button><span class="hlq-lia">[[ 1 ]]</span></span>

markred:    <span class="lia-hl-target" data-hl-expected="red"    data-hl-quiz="default">@0</span>
markblue:   <span class="lia-hl-target" data-hl-expected="blue"   data-hl-quiz="default">@0</span>
markgreen:  <span class="lia-hl-target" data-hl-expected="green"  data-hl-quiz="default">@0</span>
markyellow: <span class="lia-hl-target" data-hl-expected="yellow" data-hl-quiz="default">@0</span>
markpink:   <span class="lia-hl-target" data-hl-expected="pink"   data-hl-quiz="default">@0</span>
markorange: <span class="lia-hl-target" data-hl-expected="orange" data-hl-quiz="default">@0</span>

mark: <span class="lia-hl-target" data-hl-expected="any" data-hl-quiz="default">@0</span>

markedred:    <span class="lia-hl-prefill" data-hl-prefill="red">@0</span>
markedblue:   <span class="lia-hl-prefill" data-hl-prefill="blue">@0</span>
markedgreen:  <span class="lia-hl-prefill" data-hl-prefill="green">@0</span>
markedyellow: <span class="lia-hl-prefill" data-hl-prefill="yellow">@0</span>
markedpink:   <span class="lia-hl-prefill" data-hl-prefill="pink">@0</span>
markedorange: <span class="lia-hl-prefill" data-hl-prefill="orange">@0</span>

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

2. Copy the definitions into your project

3. Clone this repository on GitHub

## Highlighting Tool

          --{{0}}--
A toolbar button appears in the navigation bar. Click it to open the color picker, then drag over text to highlight it. Click a highlight to remove it.

## Marker Quiz Macros

          --{{0}}--
Use `@markCOLOR(text)` to define which text a student must highlight in a specific color. Pair with `@TextmarkerQuiz` to add Check / Solve buttons.

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

Use `@mark(text)` to accept any color:

```markdown
<div class="markerquiz">
@mark(highlight this in any color)
@TextmarkerQuiz
</div>
```

---

<div class="markerquiz">
@mark(highlight this in any color)
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
script:   https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-marker@0.0.1/dist/index.js

TextmarkerQuiz: <span class="hlq-proxy"><span class="hlq-msg"></span><button class="hlq-btn" type="button" data-hlq-act="check">Prüfen</button><button class="hlq-btn" type="button" data-hlq-act="solve">Auflösen</button><span class="hlq-lia">[[ 1 ]]</span></span>

markred:    <span class="lia-hl-target" data-hl-expected="red"    data-hl-quiz="default">@0</span>
markblue:   <span class="lia-hl-target" data-hl-expected="blue"   data-hl-quiz="default">@0</span>
markgreen:  <span class="lia-hl-target" data-hl-expected="green"  data-hl-quiz="default">@0</span>
markyellow: <span class="lia-hl-target" data-hl-expected="yellow" data-hl-quiz="default">@0</span>
markpink:   <span class="lia-hl-target" data-hl-expected="pink"   data-hl-quiz="default">@0</span>
markorange: <span class="lia-hl-target" data-hl-expected="orange" data-hl-quiz="default">@0</span>

mark: <span class="lia-hl-target" data-hl-expected="any" data-hl-quiz="default">@0</span>

markedred:    <span class="lia-hl-prefill" data-hl-prefill="red">@0</span>
markedblue:   <span class="lia-hl-prefill" data-hl-prefill="blue">@0</span>
markedgreen:  <span class="lia-hl-prefill" data-hl-prefill="green">@0</span>
markedyellow: <span class="lia-hl-prefill" data-hl-prefill="yellow">@0</span>
markedpink:   <span class="lia-hl-prefill" data-hl-prefill="pink">@0</span>
markedorange: <span class="lia-hl-prefill" data-hl-prefill="orange">@0</span>
```
