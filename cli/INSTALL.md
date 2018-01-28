# Installation guide

You need:

- [Node.js](https://nodejs.org/) 8.x or greater
- Ideally, a recent Chromium or Chrome copy with session data for the sites you want to export (i.e. you are logged in)
- A **complete** checkout of https://github.com/eloquence/freeyourstuff.cc -- do not delete the content of the parent directories `extension/` or `service/`

On a Linux system, from this directory, run:

```bash
npm install # will trigger a ~100MB download
cp -R ~/.config/chromium ~/.chromium-testing-profile # but see section below!
bin/freeyourstuff
```

A typical export would work like this:

```bash
bin/freeyourstuff imdb
```

and should look like this:

![freeyourstuff CLI animation](https://raw.githubusercontent.com/eloquence/freeyourstuff.cc/master/cli/cli.gif)

# Location of your Chrome/Chromium profile

The directory to copy may vary, e.g., depending on whether you're using Chrome or Chromium. You can find the directory in chrome://version , under "Profile directory", **minus** the part at the end (typically "Default").

This copy lets the CLI find your session data. You need to work with a copy, because the version of Chromium used by the CLI is likely more recent than yours, which can result in profile corruption.


A symbolic link to your copy of the "freeyourstuff" script can be created in, e.g., `/usr/local/bin` for easy access.

To change some of the default directory names, do this:

```bash
cd config
cp default.json5 local.json5
vi local.json5
```

# Troubleshooting

## I don't seem to be getting any stuff!

Are you logged into the site you're trying to download from in Chrome/Chromium,
and have you made a recent copy of the Chromium profile that can be located
by the extension?

If you don't want to use Chromium session data, you can also specify a profile
URL for some sites, but this won't always work. For example, Goodreads actually
has a nice CSV export, which we use, but which is only available to the logged
in user. (Most sites don't have such export features, of course.)

## This seems to mostly work, but one specific site is broken

Possibilities, in rough order of decreasing probability:

- you have no supported contributions on the site you're trying to download
  from. For most sites we download reviews; for Quora we download answers.

- you do have supported contributions, but you're running into a bug with the
  extraction code that may be specific to your content.
  Please [report a bug](https://github.com/eloquence/freeyourstuff.cc/issues/new)
  and be sure to include both the specific command you're using and a link to
  your profile URL.

- the plugin may have recently broken. This unavoidably happens every few weeks
  when sites change their user interface. We test regularly, of course, but we
  may have missed a change. Please report a bug and let us know.

  In odd edge cases, sites A/B test design changes in ways we can't reproduce,
  or users use custom scripts we don't have, but we'll try our best to track
  down the cause.

- the site itself may be experiencing issues. Some sites have been known
  to throw intermittent 504 errors, "We're having a problem right now" messages,
  and so on. Plugins do their best to keep trying, but if the site is broken,
  there's not much we can do.

## I'm getting weird error messages :-(

Generally, the browser extension is more careful to catch errors and explain
what's going on, while the CLI will just glare angrily at you in red letters.
This is because the CLI is more oriented towards plugin developers and testers.
Compare what's going on with the browser extension, which you can install
here:

https://freeyourstuff.cc/

## Okay, I got my stuff, how do I publish it to freeyourstuff.cc?

We don't support publishing via the CLI yet. There's an issue for it here:

https://github.com/eloquence/freeyourstuff.cc/issues/87

If you're interested, please subscribe to it. If you'd like to work on it,
please reply to it. :-)

For now, to publish, please use the browser extension instead of the CLI.
