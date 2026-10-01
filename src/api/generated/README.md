# Generated API contracts

This directory is owned by `openapi-typescript`. Do not edit `core.ts` or
`identity.ts` by hand.

Generate both contracts only from explicit, immutable Core and Identity
OpenAPI inputs:

```sh
npm run contracts:generate -- --core <versioned-file-or-url> --identity <versioned-file-or-url>
```

Remote inputs must use an unencoded HTTP(S) path and exactly one immutable form:

- a full `v1.2.3`/`1.2.3` semantic-version path segment or a complete 40- or
  64-character hexadecimal commit/digest path segment, with no query parameters;
  or
- exactly one query parameter named `version`, `commit`, `digest`, or `sha256`,
  with the corresponding complete semantic-version or digest value and no
  immutable path segment.

Mutable aliases (`latest`, `runtime`, `main`, `master`, `dev`, `develop`, `head`,
`current`, `snapshot`, and `nightly`) are rejected as standalone path tokens or
filename tokens such as `openapi-latest.json`. Dates, short versions/hashes,
extra or conflicting query parameters, encoded path characters, fragments,
credentials, and redirects are also rejected. Local files are read once and
generated from a private byte snapshot; remote response bytes use the same
snapshot rule.

Check committed output for byte-for-byte drift with the same inputs:

```sh
npm run contracts:check -- --core <versioned-file-or-url> --identity <versioned-file-or-url>
```

CI pins the exact inputs in [contracts/openapi-sources.json](../../../contracts/openapi-sources.json):
an immutable `gs://` URI plus SHA-256 for Core and for Identity. The quality
workflow downloads them with `scripts/fetch-api-contracts.mjs` and runs
`contracts:check` against the committed files; a missing or mismatched input,
a digest mismatch or byte drift fails the gate.

Hand-written adapters in `src/api` are not generated. Request payloads that
matter are checked against these schemas at compile time in
[contract-alignment.ts](../contract-alignment.ts).

## A web change that needs a new Core API

1. Make sure the Core change also updates its exported
   `contracts/openapi/v1/rozbirka-core.json`. Core checks drift with
   `scripts/check-openapi.sh` in its validation workflow and before publication. After it merges to `develop`, Core's `publish-openapi.yml`
   publishes the file under an immutable commit path.
2. Point `contracts/openapi-sources.json` at that path and digest, run
   `contracts:generate` with the same inputs and commit the output.
3. Remove the matching `Pending…` entry in `contract-alignment.ts` — typecheck
   fails until you do.
4. Only then merge the web change that sends the new fields.

The pinned generator currently declares a TypeScript 5 peer range, while this
project uses TypeScript 6. The repository-local `force=true` npm setting applies
to every npm command and could otherwise hide unrelated peer conflicts. The
mandatory `deps:check` gate therefore rejects every dependency-tree problem
except the exact `openapi-typescript@7.13.0` → TypeScript `^5.x` mismatch.
Generation tests and the project typecheck verify this combination. Remove the
repo-wide override and its health-check allowance when the generator's peer
range catches up.
