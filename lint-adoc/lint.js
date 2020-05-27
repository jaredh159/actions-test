const http = require('https');
const fs = require('fs');
const { lint } = require('../fl/packages/adoc-lint/dist/index.js');

const modified = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/files_modified.json`).toString()
);
const added = JSON.parse(
  fs.readFileSync(`${process.env.HOME}/files_added.json`).toString()
);

const checkFiles = modified.concat(added).filter((f) => f.endsWith('.adoc'));
console.log({ checkFiles });

let annotations = [];
checkFiles.forEach((path) => {
  const lints = lint(fs.readFileSync(path).toString());
  console.log(lints);
  annotations = annotations.concat(lints.map((l) => toAnnotation(l, path)));
});

function toAnnotation(result, path) {
  const annotation = {
    path,
    start_line: result.line,
    end_line: result.line,
    annotation_level: result.type === 'error' ? 'failure' : result.type,
    message: result.message,
  };

  if (result.column !== false) {
    annotation.start_column = result.column;
    annotation.end_column = result.column + 1;
  }

  if (result.recommendation) {
    annotation.message += `\n\nRecommended fix:\n\n\`\`\`\n${result.recommendation}\n\`\`\``;
  }

  return annotation;
}

console.log({ token: process.env.GITHUB_TOKEN });

// GITHUB_REPOSITORY
let body = JSON.stringify({
  name: 'lint-adoc',
  head_sha: process.env.GITHUB_SHA,
  status: 'completed',
  conclusion: 'failure',
  output: {
    title: 'Asciidoc lint failure',
    summary: `Found ${annotations.length} problems`,
    annotations,
  },
});

console.log(JSON.parse(body));

let options = {
  hostname: 'api.github.com',
  path: `/repos/${process.env.GITHUB_REPOSITORY}/check-runs`,
  method: 'POST',
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.antiope-preview+json',
    'User-Agent': '@friends-library lint action',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

http
  .request(options, (res) => {
    let data = '';
    res.on('data', (d) => {
      data += d;
    });
    res.on('end', () => {
      console.log(data);
    });
  })
  .on('error', console.error)
  .end(body);
