// Dump the contents of the MongoDB collections for all defined sites.
// Run from command line:
//
// $ node dumper.sh
//
// Requires the mongodump utility to exist in the PATH.
//
// TODO:
// - Don't overwrite by default, --force option to force it
// - Rotation feature
'use strict';

// External dependencies
const fs = require('fs');
const exec = require('child-process-promise').exec;

// Internal dependencies
const { schemas } = require('../load-schemas.js');
const config = require('../load-config.js');
const colors = require('colors/safe');

let tmpdir = `${__dirname}/../static/dumps/tmp`;
let isoDate = new Date().toISOString().match(/(.*)T/)[1];
let filename = `${__dirname}/../static/dumps/freeyourstuff-${isoDate}.tgz`;

try {
  fs.mkdirSync(tmpdir);
} catch (err) {
  if (err.code == 'EEXIST') {
    console.error(colors.red(`Temporary directory ${tmpdir} exists from previous run.`));
    console.error('Please inspect/remove it before starting a new run.');
  } else {
    console.error(`Problem creating temporary directory ${tmpdir}.`);
    console.error(colors.red(err));
  }
  process.exit(1);
}

let promises = [];

for (let coll of Object.keys(schemas)) {
  let cmd = `mongodump --db ${config.dbName} --collection ${coll} --out ${tmpdir}`;
  promises.push(exec(cmd));
}
Promise.all(promises).then(arr => {
  console.log(`Dump completed. Output was:`);
  arr.forEach(out => {
    console.log(colors.grey(out.stdout));
  });
  console.log(`Starting new archive: ${filename}`);
  exec(`tar cvfz ${filename} -C ${tmpdir} . --remove-files`)
    .catch(err => {
      console.error('An error occurred creating the archive:');
      console.error(colors.red(err.stderr));
    });
}).catch(err => {
  console.error('An error occurred dumping the database:');
  console.error(colors.red(err.stderr));
});
