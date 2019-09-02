// Copyright 2019 SmugMug, Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var buffer = require('./buffer');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var debug = require('debug')('yakbak:record');

/**
 * Read and pre-compile the tape template.
 * @type {Function}
 * @private
 */

var render = ejs.compile(fs.readFileSync(path.resolve(__dirname, '../src/tape.ejs'), 'utf8'));
var renderJS = ejs.compile(fs.readFileSync(path.resolve(__dirname, '../src/tape-json.ejs'), 'utf8'));

/**
 * Record the http interaction between `req` and `res` to disk.
 * The format is a vanilla node module that can be used as
 * an http.Server handler.
 * @param {http.ClientRequest} req
 * @param {http.IncomingMessage} res
 * @param {String} filename
 * @param {(String) => String} bodyEditor
 * @returns {Promise.<String>}
 */

module.exports = function (req, res, filename, bodyEditor) {
  return buffer(res).then(function (body) {
    try {
    if (res.headers["location"] !== undefined) {
      res.headers["location"] = bodyEditor(res.headers["location"])
    }
    if (res.headers["cookie"] !== undefined) {
      res.headers["cookie"] = bodyEditor(res.headers["cookie"])
    }
    if (res.headers["set-cookie"] !== undefined) {
      console.log(res.headers["set-cookie"])
      res.headers["set-cookie"] = res.headers["set-cookie"].map(c => bodyEditor(c)).map(c => c.replace(" secure;", ""))
    }
    if (res.headers["access-control-allow-origin"] !== undefined) {
      res.headers["access-control-allow-origin"] = bodyEditor(res.headers["access-control-allow-origin"])
    }
    if ((res.headers["content-type"] || "").startsWith("application/json")) {
      delete res.headers["content-length"]
      let data = body.join("")
      const jsonData = JSON.parse(bodyEditor(data))
      return renderJS({ req: req, res: res, data: jsonData});
    }
    return render({ req: req, res: res, body: body });
  } catch (e) {
    console.error(`[ERROR] ${filename}:\n\t${body}`)
    throw e
  }
  }).then(function (data) {
    return write(filename, data);
  }).then(function () {
    return filename;
  });
};

/**
 * Write `data` to `filename`. Seems overkill to "promisify" this.
 * @param {String} filename
 * @param {String} data
 * @returns {Promise}
 */

function write(filename, data) {
  return Promise.fromCallback(function (done) {
    debug('write', filename);
    fs.writeFile(filename, data, done);
  });
}
