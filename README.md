# metrale.ai

The source of [metrale.ai](https://metrale.ai), the Metrale website: the marketing pages and
the developer pages for the engine. SvelteKit on Vite, prerendered to static files with
`adapter-static`, built with [Bun](https://bun.sh) and served by Cloudflare Pages.

## Layout

| path | what it is |
| --- | --- |
| [`site/`](site/) | the site. Start with [`site/AGENTS.md`](site/AGENTS.md), then [`site/README.md`](site/README.md) |
| [`web-shared/`](web-shared/) | design tokens and components shared with the blog |
| [`assets/brand/`](assets/brand/) | the brand kit the site draws its artwork and palette from |
| [`.github/workflows/`](.github/workflows/) | the pull request checks, the deploy and the guide's Worker |

## Build it

The build reads its model list and its measurements from two public repositories, so
check them out beside this one first:

```sh
git clone https://github.com/Avarok-Cybersecurity/atlas-recipes.git
git clone --filter=blob:none https://github.com/Avarok-Cybersecurity/atlas.git

cd metrale.ai/site
bun install
export AVAROK_RECIPES_ROOT="$(cd ../../atlas-recipes/recipes && pwd)"
export AVAROK_ENGINE_ROOT="$(cd ../../atlas && pwd)"
export AVAROK_BASELINES_ROOT="$AVAROK_ENGINE_ROOT/tests/baselines"
bun x --bun vite build        # writes site/build
bun x --bun vite preview      # serves it on http://localhost:4173
```

CI checks out the engine at the commit in [`site/engine.ref`](site/engine.ref)
(`git -C ../../atlas checkout $(cat engine.ref)`); use the same commit locally to get the
same numbers. Moving it is a pull request like any other.

## How it ships

- Every pull request runs the checks in [`pr.yml`](.github/workflows/pr.yml): secret scan,
  lint, types, spelling, Markdown, links, unit and browser tests, the site guide's ledger,
  the build, and Lighthouse at 100 in every category on every public page. Pull requests
  from branches of this repository also get a preview deploy.
- Every merge to `main` builds the site again and deploys it to Cloudflare Pages with
  [`deploy.yml`](.github/workflows/deploy.yml). The deploy then checks that
  <https://metrale.ai/version.txt> carries the merged commit.

## License

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE). The
Metrale name, the wordmark and the artwork in `assets/brand/` are the company's marks and are
not licensed for reuse. Third-party logos, fonts and media under `site/static/` keep their
own terms, recorded beside them.
