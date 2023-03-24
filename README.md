## Welcome to Slick RSS by users
### The news reader extension for Google Chrome.

#### I took over the development of Slick RSS and it is published on [chrome web store](https://chrome.google.com/webstore/detail/slick-rss-by-users/lloonpjjgockligalihhebapcafgbgef).

You can help me with pull request, issue, translation, ...
If you are web developer, refresh UI would be good to start.

### Try last version or develop own version: Installing the Codebase as an Extension
1. Open a tab in chromium browser and go to extensions manager.
2. From the page on GitHub, download the repo as a ZIP and unzip into a folder on your desktop or clone repo from `GIT` or `GitHub Desktop`.
3. Enable `Developer Mode`.
4. Use action `Load unpackaged extension` and select the unzipped folder. You should now see the extension appear with an `Unpacked Extension` flag on its logo.
5. Click the new icon for this extension in your browser's top menu to finish setting up your desired RSS feeds.

#### I'm not web developper. I refactor and add some functions. It will take time before having a clean code.

### API to send suggested url from other extension:
Request : {recipient: "Slick RSS", feedUrl: "url", feedTitle: "", feedGroup: ""}
Request : {recipient: "Slick RSS", feedList: [{feedUrl: "url", feedTitle: "", feedGroup: ""},{feedUrl: "url", feedTitle: "", feedGroup: ""}]}
feedUrl is mandatory.
Return can be :
- "refused"
- "already exists"
- "bad request"
- "nothing"
- "ok"
- "ok:  Reading..."

Original and actual license is MIT License.
http://opensource.org/licenses/MIT

Using :
- https://github.com/NaturalIntelligence/fast-xml-parser
- https://github.com/localForage/localForage
- https://jquery.com
- https://github.com/emn178/js-sha256
