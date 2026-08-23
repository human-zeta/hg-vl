# hg-vl · la puerta — brief

Built with `scrollsmith`. Step 0–3 artifacts before any HTML existed.

## Step 1 · Interview

Not asked of the user — recovered from primary sources: the live
`www.hg-vl.com` root and the `human-zeta/hg-vl` repo (branch `main`, last
commit Jun 11).

**The business.** HUMAN GLITCHE · VISUAL LAB. Buenos Aires, AR. Est. 2022.
A dual structure on one domain: *Visual Lab* is the commercial surface —
live visuals, mapping, shaders, 3D, post, generative AI pipelines, web for
artists. *Human Glitche* is the core — manifesto, diary, academy, community.
Their own words: **"Visual Lab en la superficie, Human Glitche en el núcleo.
Un dominio, una profundidad."** And about the core: *"Acá no se vende nada:
acá está el porqué."*

**The one action.** Enter. Not a waitlist, not a demo — the visitor picks a
door and goes in. This page is a threshold, and its only job is to make both
doors legible and make choosing feel like arriving somewhere.

Two exits, and they are not equal in kind:
- `ENTRAR AL ESTUDIO →` — the commercial site (`index.html`)
- `ENTRAR A LA COMUNIDAD →` — the core

**The thesis, in their words.** *"La realidad es una interfaz — diseñada por
alguien, en algún momento, con alguna intención."* And the closing line of the
existing site: **"QUIEN VE LA INTERFAZ, YA NO PUEDE DEJAR DE REDISEÑARLA."**

**What they own.** A WebGL shader engine already driving `index.html`
(`<canvas id="shader-canvas">`, real `gl_FragColor`, `createShader`, fbm-ish
noise). Their service copy says shaders are *"herramientas propias — como el
motor de este sitio."* Zero image or video assets in the repo — the entire
existing site is code-generated visuals.

**Brand hard rules**, read from the repo and not negotiated with:

| token | value |
|---|---|
| `--black` | `#050505` |
| `--white` | `#f0ede6` |
| `--acid` | `#b8ff00` |
| `--glitch` | `#ff2d55` |
| `--display` | Bebas Neue |
| `--body` | DM Sans |
| `--mono` | Space Mono |

This is not a pastel-holographic palette. It is harsh and electric. The
iridescence is built **from these four values**, not from generic vaporwave —
that is what keeps it theirs.

## Step 2 · Page grammar

**Continuous world.** One fixed stage, no section boundaries, travel inward,
a depth indicator, arrival.

`grammars.md` warns this off by default, and the warning is the right default:
it is the most expensive grammar and the one every AI-generated scroll page
reaches for, so it reads as generic despite the cost. Both objections are
inverted here.

- *The brief is literally "one continuous journey."* Not a metaphor someone
  reached for — the site's own tagline is **"el viaje al sol"** and its
  information architecture is concentric. Surface and core are the product's
  actual structure.
- *It is not expensive here and it is not generic.* The world is a procedural
  shader, not a generated diorama. Zero asset weight, infinite scrub
  resolution, and the page becomes a live demo of the thing the studio sells.

### Fingerprint

| dimension | this build |
|---|---|
| grammar | continuous world |
| navigation | depth gauge — distance to the core, in Space Mono |
| hero | no title card. The sun as a distant point, already in view |
| act shape | 9 acts, 13.3vh, one 3.0vh peak with 0.5vh of silence before it |
| close | two doors at the core, unequal by design |
| signature move | **the interface peel** |

### The signature move

Their manifesto says reality is an interface, and whoever sees it redesigns
it. So: the pointer **peels the render back to the interface underneath.**
Wherever the cursor is, the shader gives way to the wireframe — the grid, the
coordinates, the raw structure behind the image.

It starts subtle in outer orbit and gets easier the deeper you descend. At the
core it stops closing behind you: what you peeled stays peeled. The visitor
has done the thing the manifesto describes before reading the sentence that
describes it.

Touch gets it too, from the touch point. Keyboard gets a full static reading
that never depended on it.

## Step 3 · Feeling curve and scroll score

One line per act: the feeling, then what on screen causes it.

| # | feeling | caused by |
|---|---|---|
| 1 | small | a black field, one distant point, coordinates in the corner |
| 2 | pulled | the point resolves into a body with structure |
| 3 | oriented | VISUAL LAB names itself — the surface has a name |
| 4 | competent | the work passes as satellites, factual, no persuasion |
| 5 | **held** | silence. the sun fills more of the frame. nothing else |
| 6 | **overwhelmed** | PEAK — the fall through the corona |
| 7 | recognised | the thesis assembles line by line |
| 8 | arrived | HUMAN GLITCHE. the core. no price anywhere |
| 9 | decided | two doors |

Act 5 is authored silence and is marked `data-sc-hold` so verification does
not read it as dead scroll. Act 6 is the only act over 3vh.

### Scroll score

```
act 1   flow      1.0vh   órbita exterior · coordenadas
act 2   drift     0.8vh   el punto se resuelve
act 3   reveal    1.2vh   VISUAL LAB
act 4   pin       2.2vh   los servicios pasan como satélites
act 5   drift     0.5vh   SILENCIO                    [data-sc-hold]
act 6   scrub     3.0vh   PICO · la caída al núcleo
act 7   kinetic   1.8vh   "LA REALIDAD ES UNA INTERFAZ"
act 8   pin       1.6vh   HUMAN GLITCHE · el núcleo
act 9   flow      1.2vh   las dos puertas
                 ──────
                 13.3vh
```

Six device families — flow, drift, reveal, pin, scrub, kinetic — against a
minimum of four. No family runs twice in a row. Peak at act 6, silence
immediately before it.

## Step 4 · Assets

Two sources, deliberately doing different jobs.

**The shader does the universe.** Sun, corona, iridescence, starfield,
descent, the peel. Procedural, 0 credits, no bytes, scrubs at any resolution.

**Generated stills do what a shader is bad at: the real world.** The booth,
the projector beam in haze, hands on a controller, a mapped facade, a crowd lit
by projection. This is the complement that matters — the shader is the
simulation, the photographs are the humans running it, and the brand is called
*Human* Glitche. A page that was only shader would be a tech demo; a page that
was only photographs would be any studio's site.

Costs are preflighted with `get_cost: true` before anything is spent, and the
total goes to the user for an explicit yes. Stills are generated and approved
first; the clip is generated only against an approved look.

## Step 5 · Craft notes specific to this build

**Iridescence is a contrast problem.** A ground that cycles through the
spectrum has no stable luminance, so text over it fails somewhere in the cycle
even when the screenshot looks fine. The rule for this page: **iridescence
lives in the ground and the edges; type sits on flat ink over dark plates.**
No text is ever set directly on the moving spectrum.

`shoot.mjs`'s media sweep exists precisely for this class of failure and will
be run at every stage, not only at the end.

**Reduced motion must still be the journey.** The descent becomes a sequence
of still states rather than nothing — the sun at four distances, the copy in
its final position, both doors reachable. The shader stops animating; it does
not disappear.
