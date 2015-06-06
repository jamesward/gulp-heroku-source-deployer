'use strict';

var assert = require('chai').assert,
  gulp = require('gulp'),
  through2 = require('through2'),
  tar = require('gulp-tar'),
  gzip = require('gulp-gzip'),
  herokuSourceDeployer = require('../');

var apiToken = process.env.HEROKU_ACCESS_TOKEN;

describe('gulp-heroku-source-deployer', function() {

  var heroku = new (require('heroku-client'))({ token: apiToken });

  var appName;

  before(function(done) {
    heroku.apps().create().then(function(data) {
      appName = data.name;
      done();
    }).catch(function(err) {
      done(err);
    });
  });

  it('deploy should fail with an invalid appName', function(done) {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy(apiToken, 'foo').on('error', function(err) {
        if (err.message.indexOf('You do not have access to the app foo') >= 0) done();
        else done(err);
      }))
      .pipe(through2.obj(function(file, enc, cb) {
        done('Stream should have thrown an error');
      }));
  });

  it('deploy should fail with an invalid apiToken', function(done) {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy('foo', appName).on('error', function(err) {
        if (err.message.indexOf('Invalid credentials provided') >= 0) done();
        else done(err);
      }))
      .pipe(through2.obj(function(file, enc, cb) {
        done('Stream should have thrown an error');
      }));
  });

  it('deploy should start with a valid file', function(done) {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy(apiToken, appName).on('error', function(err) {
        done(err);
      }))
      .pipe(through2.obj(function(buildInfo) {
        assert.isDefined(buildInfo.created_at);
        done();
      }));
  });

  it('deploy should succeed with a valid tgz', function(done) {
    gulp.src('test/app/index.php')
      .pipe(tar('app.tar'))
      .pipe(gzip())
      .pipe(herokuSourceDeployer.deploy(apiToken, appName))
      .pipe(herokuSourceDeployer.buildComplete(apiToken, appName).on('error', function(err) {
        done(err);
      }))
      .pipe(through2.obj(function(buildResult) {
        assert.equal(buildResult.build.status, 'succeeded');
        done();
      }));
  });

  after(function(done) {
    heroku.apps(appName).delete().then(function(data) {
      done();
    }).catch(function(err) {
      done(err);
    });
  });

});