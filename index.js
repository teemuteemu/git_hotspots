const path = require("path")
const nodegit = require("nodegit")

const nmrOfTopFiles = 20
const pathToRepo = path.resolve(".") // TODO set as a cmd line arg or so

const ignoreFiles = [
  'package.json',
  'package-lock.json',
  'yarn.lock',
  '.gitignore',
  '.nvmrc',
]
const changedFiles = {}

function markChange(path) {
  changedFiles[path] = changedFiles[path] > 0
    ? changedFiles[path] + 1
    : 1
}

async function printPatch(patch) {
  const path = patch.newFile().path()
  if (ignoreFiles.indexOf(path) < 0) {
    markChange(path)
  }
  /*
  const hunks = await patch.hunks()
  for (const hunk of hunks) {
    await printHunk(hunk)
  }
  */
}

async function printDiff(diff) {
  const patches = await diff.patches()

  for (const patch of patches) {
    await printPatch(patch)
  }
}

async function processCommit(commit) {
  // console.log(commit.sha(), " - ", commit.author().name(), " - ")
  const diffList = await commit.getDiff()

  for (const diff of diffList) {
    await printDiff(diff)
  }
}

function printStats(files, nmrOfFiles) {
  const topFiles = Object.keys(files)
    .map(path => ({
      path,
      changes: files[path]
    }))
    .sort((a, b) => {
      return b.changes - a.changes
    })
    .slice(0, nmrOfFiles)
    .reduce((p, c) => {
      p[c.path] = c.changes
      return p
    }, {})

  console.log(`Top ${nmrOfFiles} hotspots:`)
  console.log(topFiles)
}

async function main() {
  console.log("Processing commits...")
  try {
    const repo = await nodegit.Repository.open(pathToRepo)
    const headCommit = await repo.getHeadCommit()
    const revwalk = nodegit.Revwalk.create(repo);
    revwalk.push(headCommit.sha())

    let reachedEnd = false
    while (!reachedEnd) {
      try {
        const oid = await revwalk.next();

        if (!oid) {
          reachedEnd = true;
          continue;
        }

        const commit = await nodegit.Commit.lookup(repo, oid);
        await processCommit(commit)
      } catch (err) {
        if (err.errno === -31) {
          reachedEnd = true;
          continue;
        }
        console.log(err)
      }
    }

    printStats(changedFiles, nmrOfTopFiles)
  } catch (err) {
    console.log(err)
  }
}

main()
