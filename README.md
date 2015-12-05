# freeyourstuff.cc

Liberate the content you've contributed to sites like IMDB, Yelp, and others!

There are two components:

- a Chrome/Chromium extension (directory `extension/`)
- a web service (directory `service/`).

The extension shows a little icon in the address bar on supported sites, and lets you download your contributions as a single JSON file, or publish it with one click.

The web service allows you publication of your contributions under the [CC-0](https://creativecommons.org/publicdomain/zero/1.0/) license, to enable easy re-use by anyone. This is a good idea, to mitigate the [network effect](https://en.wikipedia.org/wiki/Network_effect) which enables first movers to lock in a given market. This effect makes it harder for open source, non-profit, community-driven alternatives to emerge, which is the principal motivation for this project.

In other words: Free your stuff! :-)

This is still very much a work in progress. The extension is ready to play with -- just load it into Chrome/Chromium by switching on "Developer Mode" in your extensions tab. See the `extensions/src/plugins` directory for currently supported sites.
