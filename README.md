# lerks-blog
A [ghost](https://ghost.org/) theme based on [ghost-wbkd](https://github.com/wbkd/ghost-wbkd).

### Install

To install the theme, simply upload a zip file of this repo to your blog and activate it.

#### Nav Links

There are a few hardcoded links at `partials/header.hbs:27`, those should be replaced in your setup.

#### Search

For the search to work it's necessary to generate a custom integration in Ghost and inject the content key into the header like this:
```js
var search_key = 'INTEGRATION_CONTENT_KEY';
``` 