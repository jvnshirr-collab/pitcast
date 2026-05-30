# PitCast — JOSS submission & Zenodo DOI checklist

Everything preparable **without your accounts is done**: `paper.md`, `paper.bib`,
`METHODS-NOTE.md` (long-form), `.zenodo.json`, `CITATION.cff`. The remaining steps
need **your** ORCID / GitHub / Zenodo login and cannot be automated. Do them in order.

## 0. Fill in your details (the placeholders)
Before anything else, replace these — they are deliberately left blank, not guessed:
- `docs/preprint/paper.md` — `orcid:` (real ORCID), affiliation line, date.
- `docs/preprint/METHODS-NOTE.md` — affiliation, correspondence email.
- `.zenodo.json` — confirm the affiliation string.
- `CITATION.cff` — set `repository-code:` (public repo URL), `version:` (release tag),
  and `doi:` (after step 4).
- `paper.bib` — ✓ **done**: the four previously-flagged DOIs (deWaard1975, nyby2021,
  nyborg2010, nesic2007) are now confirmed via Crossref (exact metadata match). Nothing
  left here.

## 1. Make the repository public
JOSS and Zenodo both require a public repo under an OSI licence — you have Apache-2.0.
Push the PitCast tree to a public GitHub repo; put its URL in `CITATION.cff` and the
`paper.md` repo field.

## 2. Verify the JOSS bar (already met)
- Open-source, OSI licence — Apache-2.0 ✓
- Substantial scholarly effort — engines + reproducible benchmark + V&V records ✓
- Automated tests + CI gate — `benchmark/test-all.js`, enforced in `deploy.sh` ✓
- Documentation / examples — README, the in-console **Learn** track, `METHODS-NOTE.md` ✓
- `paper.md` + `paper.bib` — this folder ✓

## 3. Tag a release
`git tag v1.0.0 && git push --tags` (choose the version; mirror it in `CITATION.cff`).

## 4. Mint the Zenodo DOI  *(your login)*
1. Sign in at <https://zenodo.org> with your GitHub account.
2. Zenodo → Settings → GitHub: toggle the PitCast repo **ON**.
3. On GitHub, publish a release of the tag from step 3. Zenodo auto-archives it and
   issues a concept DOI + version DOI; it reads `.zenodo.json` for the metadata (ready).
4. Paste the DOI into `CITATION.cff` (`doi:`), commit, push.

## 5. Submit to JOSS  *(your login)*
1. <https://joss.theoj.org> → "Submit a paper".
2. Repository URL = your public repo; version = the tagged release; the paper is at
   `docs/preprint/paper.md`.
3. A reviewer is assigned via an open GitHub issue; address comments there. On
   acceptance JOSS mints the paper's own DOI.

## What I could not do (and why)
Creating the Zenodo / JOSS / ORCID accounts, authenticating, minting the DOI, and
clicking **submit** require logging in as you — a safety boundary I won't cross.
Everything up to those clicks is prepared and consistent across the five files above.
