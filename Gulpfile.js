const {series, parallel, src, dest} = require('gulp');
const sass = require('gulp-sass');
const del = require('del');
const minify = require('gulp-minify');
const fs = require('fs');
const cleanCSS = require('gulp-clean-css');
const zip = require('gulp-zip');
const jsImport = require('gulp-js-import-file');


function transpileAndMinifySass() {
    return src('assets/scss/style.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(dest('dist/assets/css/'));
}

function minifyJs() {
    return src(['assets/js/*.js'])
        .pipe(jsImport({
            hideConsole: true,
            importStack: true,
            es6import: true
        }))
        .pipe(minify({
            noSource: true,
            ext: {
                min: '.min.js'
            }
        }))
        .pipe(dest('dist/assets/js'));
}

function copyBaseFiles() {
    return src(['./README.md', './package.json', './LICENSE', './*.hbs']).pipe(dest('dist/'));
}

function copyPartials() {
    return src('./partials/*.hbs').pipe(dest('dist/partials'));
}

function copyFonts() {
    return src('./assets/fonts/*').pipe(dest('dist/assets/fonts'));
}

function clean() {
    return del(['dist/*']).then(() => {
        const folders = [
            'dist',
            'dist/partials',
            'dist/assets',
            'dist/assets/fonts',
            'dist/assets/css',
            'dist/assets/js',
        ];

        folders.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
        });
    });
}

function packageTheme() {
    return src('dist/**')
        .pipe(zip('ghost-theme-lerk.zip'))
        .pipe(dest('./'));
}

exports.build = series(clean, parallel(transpileAndMinifySass, minifyJs, parallel(copyBaseFiles, copyFonts, copyPartials)), packageTheme);
