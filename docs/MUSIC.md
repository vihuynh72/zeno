# Focus music: sources and licenses

Vi asked on Nov 2 for chill, working or study music during focus. The rule was open-license tracks only, at least
25 of them, each download approved first. Every track below is CC0 or public domain, so no credit is required. Zeno
credits them anyway, in the Music picker.

| Station | Track(s) | Author | License | Source | How Zeno plays it |
| --- | --- | --- | --- | --- | --- |
| Lo-fi | City In The Rearview, Families, Opinions, Old Age, Dream Pop, Autumn ("Chill Beats") | Holizna (HoliznaCC0) | CC0 ("This Music is public domain Cc0, so use it how you want!") | https://opengameart.org/content/chill-beats-collection (chill_beats.zip, 80.9 MB) | `public/music/lofi-*.mp3` |
| Lo-fi | Lofi Hip Hop loop | omfgdude (OMF-Games) | CC0 | https://opengameart.org/content/lofi-hip-hop-loop (LofiLoop_2.ogg, 1.4 MB) | `public/music/lofi-loop.mp3` |
| Piano | Gymnopédie No. 1 (Erik Satie) | Musopen, uploaded by Robin Alciatore | Public domain | https://commons.wikimedia.org/wiki/File:Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg (3.5 MB) | `public/music/piano-satie-gymnopedie-1.mp3` |
| Piano | The Open Goldberg Variations, 32 pieces (J. S. Bach) | Kimiko Ishizaka | CC0 1.0 | https://archive.org/details/The_Open_Goldberg_Variations-11823 | Streamed from archive.org; nothing bundled |
| Brown noise | Made in the browser (`src/lib/music.ts` brownNoise) | n/a | n/a | n/a | Web Audio, a 10-second loop |

Processing (Nov 2, 2026): the downloads were saved to an isolated scratch folder and only the audio files were taken
from the zip. ffmpeg 8.1 converted them to MP3 at 44.1 kHz with loudness levelled (lo-fi at -18 LUFS, 96 kbps; the
loop mono at 64 kbps; Satie at -20 LUFS, 96 kbps). Metadata was stripped. The bundled tracks total about 17 MB.
SHA-256 of the originals: LofiLoop_2.ogg `e57ba821…eab`, the Satie .ogg `419e3765…53e`.
