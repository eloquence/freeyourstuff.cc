# freeyourstuff.cc

Liberate the content you've contributed to websites like IMDB, Yelp, Amazon.com, and others!

# Rationale

Websites come and go. If you don't want your contributions to disappear with them, it can be a good idea to keep your own backups. This Chrome/Chromium browser extension fetches a copy of your contributions to supported websites.

The [freeyourstuff.cc](http://freeyourstuff.cc/) web service also allows you publication of your contributions under the [CC-0](https://creativecommons.org/publicdomain/zero/1.0/) license, to enable easy re-use by anyone. This is a good idea, to mitigate the [network effect](https://en.wikipedia.org/wiki/Network_effect) which enables first movers to lock in a given market. This effect makes it harder for open source, non-profit, community-driven alternatives to emerge, which is the principal motivation for this project. It also lets the whole Internet backup your data for you.

In other words: Free your stuff! :-)

# Extension setup

You can install the extension directly from https://freeyourstuff.cc/. This will always be the latest version that's ready for wider use.

If you want to work with the development version, you need to manually [download](https://github.com/eloquence/freeyourstuff.cc/archive/master.zip) a copy of the latest version, then [load the unpacked extension](https://developer.chrome.com/extensions/getstarted#unpacked). In short: unpack the ZIP file anywhere, then navigate to your browser's extensions menu. Activate the "developer mode" checkbox, click "Load unpacked extension", and select the extension subdirectory in the folder where you unpacked the ZIP. That's it!

The extension shows a little icon in the address bar on supported sites, and lets you download your contributions as a single JSON file, or publish it with one click. See [sites.json](https://raw.githubusercontent.com/eloquence/freeyourstuff.cc/master/extension/sites.json) for the up-to-date list of currently supported sites and content.

# Development

There are three components:

- a Chrome/Chromium extension (directory `extension/`) for downloading content
- a web service (directory `service/`) for publishing content.
- a command line suite (directory `cli/`) for interacting with your content
  on the command line, by scripting Chromium via
  [Puppeteer](https://github.com/GoogleChrome/puppeteer) (experimental!).

It's a fully open JavaScript stack. We've put special emphasis on the plugin system to make it easy for anyone to add support for their favorite site. See the [plugin developer documentation](http://freeyourstuff.cc/plugins) for details.

# Mailing list and chat

* [Mailing list for developers and users](http://www.freelists.org/list/freeyourstuff)
* Chat: #freeyourstuff on irc.freenode.net ([web interface](https://webchat.freenode.net/?channels=freeyourstuff))

# Contributor notice

We'd love your help in making freeyourstuff.cc better. :-)

The extension, plugins and web service are licensed under the CC-0 License (see LICENSE file),
equivalent to the public domain. By submitting a pull request, you agree to license it
under the same terms.

This project has adopted a [code of conduct](./CODE_OF_CONDUCT.md) to make
sure all contributors feel welcome.
