# Logos on the wall

Every mark the front page and the company page show, self hosted so the site makes no third party request. The wall and the programs row render from `logoWall` in `src/lib/content/home.js`, through `src/lib/components/marketing/LogoWall.svelte`. A test in `src/lib/content/site.test.js` fails if a file here is not listed in this document.

Each mark is a trademark of its owner. They are used to name a prior employer of the team, or a program the company takes part in. None is an endorsement, and the note under the wall says so.

## Prior roles: company wordmarks

Vector masters from Wikimedia Commons. The wall greys them, and inverts them on the dark theme so a black wordmark reads white. Hover restores full opacity but not colour.

| file | source | terms as stated at the source |
| --- | --- | --- |
| `kraken.svg` | Commons, File:K-logo-wikipedia.svg | Public domain (not copyrightable). Trademark of its owner |
| `beyondgravity.svg` | Commons, File:Beyond Gravity company logo.svg | Public domain (not copyrightable). Trademark of its owner |
| `anaconda.svg` | Commons, File:Anaconda logo.svg | Public domain (not copyrightable). Trademark of its owner |
| `google.svg` | Commons, File:Google 2015 logo.svg | Public domain (not copyrightable). Trademark of its owner |
| `toyota.svg` | Commons, File:Toyota logo.svg (the wordmark, not the emblem) | Public domain (not copyrightable). Trademark of its owner. Added 2026-09-21 at the founders' request |

## Prior roles

The whole wall is switched off since 2026-09-23 (`logoWall.show` in `src/lib/content/home.js`), at the
owners' request, until after funding. The files stay for when it returns.

### The wordmark added last

| file | source | what was done to it |
| --- | --- | --- |
| `ups.svg` | Commons, File:UPS Logo Shield 2017.svg | Public domain (not copyrightable). Trademark of its owner. Added 2026-09-23 at the founders' request. Run through `svgo --multipass` |

### The command

| file | source | what was done to it |
| --- | --- | --- |
| `uscybercom.webp` | Commons, File:Seal of the United States Cyber Command.svg | Rendered at 160 px, saved as WebP. The vector master is 2.3 MB |

Official name, as the organisation writes it: **United States Cyber Command**. The Naval
Special Warfare Command emblem that stood beside it was taken down on 2026-09-23 at the
owners' request, file and all.

**Read this before launch.** The file is a work of the United States government, so nobody holds a copyright in it. That is not the same as being free to use. Department of Defense seals, emblems and insignia are protected, and a company may not use them in a way that could suggest the Department endorses it. Permission comes from the owning service's trademark and licensing office (for the Navy, the Navy Trademark Licensing Office). The wall names prior roles, says it is not an endorsement, and carries the Department's standard disclaimer, but none of that is permission.

So the emblems are a switch. Set `logoWall.emblems` to `false` in `src/lib/content/home.js` and the entry renders as set type ("U.S. Cyber Command"), which needs nobody's permission. Whoever owns the launch decision should either get the permission in writing or flip the switch.

## Programs and partners

Shown in their own colours. A logo drawn in dark ink has a second file for the dark theme. All SVGs were run through `svgo --multipass`.

| file | source | note |
| --- | --- | --- |
| `amd.svg`, `amd-dark.svg` | Commons, File:AMD Logo.svg | Public domain (not copyrightable), trademarked. The dark file is the same path filled white |
| `scale.svg`, `scale-dark.svg` | docs.scale-lang.com, `logo_white.svg` | Spectral Compute's mark for SCALE. The dark file is the original. The light file is the same path filled `#14171c`. The mark has no wordmark, so the name is set beside it |

The NVIDIA Inception badge is `static/nvidia-inception.webp`, the badge the program gives its members. `static/nvidia-inception-dark.webp` is the same badge for the dark theme: the green mark untouched and the lettering white at the same coverage, the way NVIDIA sets its logo on a dark ground.

## Adding a mark

Drop the file here, add it to `logoWall.items` (`file` for a wordmark, `emblem` for a round WebP) or to `logoWall.programs` (`file`, and `fileDark` if it is drawn in dark ink), and add a row to the right table above with where it came from and on what terms. Keep wordmarks as SVG. Run `bun x svgo --multipass` on anything over a few kilobytes.
