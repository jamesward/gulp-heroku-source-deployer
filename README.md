# Gulp Heroku Source Deployer

## Usage

1. Add `gulp-heroku-source-deployer` to `devDependencies`
1. To deploy an app:

        gulp.src('test/app/index.php')
          .pipe(tar('app.tar'))
          .pipe(gzip())
          .pipe(herokuSourceDeployer.deploy(apiToken, appName))

There is a `buildComplete` pipeline stage:

    .pipe(herokuSourceDeployer.buildComplete(apiToken, appName))


## Dev Info

Run the tests:

    ./gulp test

Release:

    git tag v0.0.1
    git push --tags
    npm publish
    # bump the version in `package.json` and `README.md`
