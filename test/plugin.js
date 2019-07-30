'use strict';

const assert = require('chai').assert,
  gulp = require('gulp'),
  through2 = require('through2'),
  tar = require('gulp-tar'),
  gzip = require('gulp-gzip'),
  herokuSourceDeployer = require('../');

const apiToken = process.env.HEROKU_ACCESS_TOKEN;

describe('gulp-heroku-source-deployer', () => {

  const heroku = new (require('heroku-client'))({ token: apiToken });

  var appName;

  before(done => {
    heroku.post('/apps').then(data => {
      appName = data.name;
      done();
    }).catch(err => done(err));
  });

  it('deploy should fail with an invalid appName', done => {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy(apiToken, 'foo').on('error', err => {
        if (err.message.indexOf('You do not have access to the app foo') >= 0) done();
        else done(err);
      }))
      .pipe(through2.obj(() => {
        done('Stream should have thrown an error');
      }));
  });

  it('deploy should fail with an invalid apiToken', done => {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy('foo', appName).on('error', err => {
        if (err.message.indexOf('Invalid credentials provided') >= 0) done();
        else done(err);
      }))
      .pipe(through2.obj(() => {
        done('Stream should have thrown an error');
      }));
  });

  it('deploy should start with a valid file', done => {
    gulp.src('test/app/index.php')
      .pipe(herokuSourceDeployer.deploy(apiToken, appName).on('error', err => done(err)))
      .pipe(through2.obj(buildInfo => {
        assert.isDefined(buildInfo.created_at);
        done();
      }));
  });

  it('deploy should succeed with a valid tgz', done => {
    gulp.src('test/app/index.php')
      .pipe(tar('app.tar'))
      .pipe(gzip())
      .pipe(herokuSourceDeployer.deploy(apiToken, appName))
      .pipe(herokuSourceDeployer.buildComplete(apiToken, appName).on('error', err => done(err)))
      .pipe(through2.obj(buildResult => {
        assert.equal(buildResult.status, 'succeeded');
        done();
      }));
  });

  after(done => {
    heroku.delete(`/apps/${appName}`).then(() => done()).catch(err => done(err));
  });

});