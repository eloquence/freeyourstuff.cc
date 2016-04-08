# freeyourstuff.cc

Liberate the content you've contributed to websites like IMDB, Yelp, Amazon.com, and others!

There are two components:

- a Chrome/Chromium extension (directory `extension/`) for downloading content
- a web service (directory `service/`) for publishing content.

To run the extension while we're in alpha, you need to manually [download](https://github.com/eloquence/freeyourstuff.cc/archive/master.zip) a copy of the latest version. Unpack the ZIP file anywhere, then navigate to your browser's [extensions](chrome://extensions/) menu. Activate the "developer mode" checkbox, click "Load unpacked extension", and select the extension subdirectory in the folder where you unpacked the ZIP. That's it!

The extension shows a little icon in the address bar on supported sites, and lets you download your contributions as a single JSON file, or publish it with one click. See [sites.json](https://raw.githubusercontent.com/eloquence/freeyourstuff.cc/master/extension/sites.json) for the up-to-date list of currently supported sites and content.

The web service allows you publication of your contributions under the [CC-0](https://creativecommons.org/publicdomain/zero/1.0/) license, to enable easy re-use by anyone. This is a good idea, to mitigate the [network effect](https://en.wikipedia.org/wiki/Network_effect) which enables first movers to lock in a given market. This effect makes it harder for open source, non-profit, community-driven alternatives to emerge, which is the principal motivation for this project.

In other words: Free your stuff! :-)
