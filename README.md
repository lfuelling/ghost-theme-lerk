# lerks-blog
A [ghost](https://ghost.org/) theme based on [ghost-wbkd](https://github.com/wbkd/ghost-wbkd).

**This repository is archived because I'm currently writing [my own blogging software](https://github.com/meowBlog/meowBlog). This theme will not be updated for Ghost releases >4!**

### Install

1. Clone the repo
2. Install dependencies: `npm install`
3. Build theme: `npx gulp build`
4. Upload the `ghost-theme-lerk.zip` file to your blog

#### Nav Links

There are a few hardcoded links at `partials/social-links.hbs`, those should be replaced in your setup.

You can use the [FontAwesome icon reference](https://fontawesome.com/icons) for which icons are available.

#### Search

For the search to work it's necessary to generate a custom integration in Ghost and inject the content key into the header like this:
```html
<script>
var search_key = 'INTEGRATION_CONTENT_KEY';
</script>
```

#### Development

To make development easier, the `dist` folder won't be deleted after a build.

This way, if you are developing like I've described it in [this blog post](https://lerks.blog/developing-ghost-themes-imho/), you can simple symlink the dist folder into your dev instance and won't have to upload the `.zip` file after each change.

**Keep in mind, that the asset paths and names in the `.hbs` files have to be the ones the files will have inside the `dist` folder!**
