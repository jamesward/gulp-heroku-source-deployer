'use strict';

const gutil = require('gulp-util'),
  PluginError = gutil.PluginError,
  through2 = require('through2'),
  rp = require('request-promise');

const PLUGIN_NAME = 'gulp-heroku-source-deployer';

function deploy(apiToken, appName) {

  if (!apiToken) {
    throw new PluginError(PLUGIN_NAME, 'Missing apiToken');
  }

  if (!appName) {
    throw new PluginError(PLUGIN_NAME, 'Missing appName');
  }

  const heroku = new (require('heroku-client'))({ token: apiToken });

  return through2.obj(function(file, enc, cb) {
    const self = this;

    // create the sources endpoints
    heroku.post(`/apps/${appName}/sources`).then(sourceInfo => {
      const doUpload = options => {

        // upload the file
        rp(options).then(() => {

          // create a build
          heroku.post(`/apps/${appName}/builds`, {
            body: {
              source_blob: {
                url: sourceInfo.source_blob.get_url
              },
            },
          }).then(buildInfo => {
            // push the buildInfo into the stream
            self.push(buildInfo);
            cb();
          }).catch(err => {
            self.emit('error', new PluginError(PLUGIN_NAME, 'Could not create the build:' + err.body.message));
            return cb();
          });

        }).catch(err => {
          self.emit('error', new PluginError(PLUGIN_NAME, 'Could not upload source: ' + err));
          return cb();
        });
      };

      // upload the file this way, cause if it is piped then it is chunked and S3 doesn't handle chunks
      const rpOptions = {
        method: 'PUT',
        url: sourceInfo.source_blob.put_url
      };

      if (file.isBuffer()) {
        rpOptions.body = file.contents;
        doUpload(rpOptions);
      }
      else if (file.isStream()) {
        const bufs = [];
        file.contents.on('data', data => bufs.push(data));
        file.contents.on('end', () => {
          rpOptions.body = Buffer.concat(bufs);
          doUpload(rpOptions);
        });
      }
      else {
        self.emit('error', new PluginError(PLUGIN_NAME, 'Unexpected file type:' + file.toString()));
        return cb();
      }

    }).catch(err => {
      self.emit('error', new PluginError(PLUGIN_NAME, 'Could not create the sources endpoints: ' + err.body.message));
      return cb();
    });
  });

}


function buildComplete(apiToken, appName) {

  if (!apiToken) {
    throw new PluginError(PLUGIN_NAME, 'Missing apiToken');
  }

  if (!appName) {
    throw new PluginError(PLUGIN_NAME, 'Missing appName');
  }

  const heroku = new (require('heroku-client'))({ token: apiToken });

  return through2.obj(function(buildInfo, enc, cb) {
    const self = this;

    // get the build result every 5 seconds until it is completed
    // todo: max retries
    const statusPolling = setInterval(() => {
      heroku.get(`/apps/${appName}/builds/${buildInfo.id}`).then(buildResult => {
        if (buildResult.status != 'pending') {
          clearInterval(statusPolling);
        }

        if (buildResult.status == 'succeeded') {
          self.push(buildResult);
          cb();
        }
        else if (buildResult.status == 'failed') {
          const lines = buildResult.lines.reduce((accumulator, currentValue) => accumulator + currentValue + '\n');
          self.emit('error', new PluginError(PLUGIN_NAME, 'Build failed: ' + lines));
          return cb();
        }
      }).catch(err => {
        clearInterval(statusPolling);
        self.emit('error', new PluginError(PLUGIN_NAME, 'Could not get the build result: ' + err.body.message));
        return cb();
      });
    }, 5000);

  });
}

module.exports = {
  deploy: deploy,
  buildComplete: buildComplete
};
