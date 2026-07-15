/**
 * Decide se com.emitfy:emitfy (Maven) deve publicar.
 * exit 0 = publish, 10 = skip, 1 = erro (mudou sem bump)
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const groupId = 'com.emitfy'
const artifactId = 'emitfy'
const userAgent = 'EmitfySDKPublish (mailto=dev@emitfy.com)'

function walkFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walkFiles(path, files)
    } else {
      files.push(path)
    }
  }
  return files
}

function readLocalVersion() {
  const text = readFileSync(join(root, 'pom.xml'), 'utf8')
  const match = text.match(/<artifactId>emitfy<\/artifactId>\s*<version>([^<]+)<\/version>/s)
  if (!match) {
    const fallback = text.match(/<version>([0-9][^<]*)<\/version>/)
    if (!fallback) {
      throw new Error('version missing in pom.xml')
    }
    return fallback[1]
  }
  return match[1]
}

function contentHash(base) {
  const hash = createHash('sha256')
  const pomPath = join(base, 'pom.xml')
  if (existsSync(pomPath)) {
    const text = readFileSync(pomPath, 'utf8')
      .replaceAll('\r\n', '\n')
      .replace(
        /(<artifactId>emitfy<\/artifactId>\s*)<version>[^<]+<\/version>/s,
        '$1<version>0.0.0</version>'
      )
    hash.update('pom.xml\0')
    hash.update(text)
    hash.update('\0')
  }

  const srcDir = join(base, 'src')
  if (!existsSync(srcDir)) {
    throw new Error(`src/ missing in ${base}`)
  }

  const files = walkFiles(srcDir)
    .filter((f) => f.endsWith('.java'))
    .sort((a, b) => relative(base, a).localeCompare(relative(base, b)))

  for (const file of files) {
    const rel = relative(base, file).replaceAll('\\', '/')
    hash.update(rel)
    hash.update('\0')
    hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function fetchMavenLatest() {
  const q = encodeURIComponent(`g:${groupId} AND a:${artifactId}`)
  const response = await fetch(
    `https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`,
    { headers: { 'User-Agent': userAgent } }
  )
  if (!response.ok) {
    throw new Error(`Maven search HTTP ${response.status}`)
  }
  const data = await response.json()
  const doc = data?.response?.docs?.[0]
  if (!doc?.latestVersion) {
    return null
  }
  return String(doc.latestVersion)
}

const version = readLocalVersion()
const localHash = contentHash(root)
const remoteVersion = await fetchMavenLatest()

if (!remoteVersion) {
  console.log(`no remote package — publish ${groupId}:${artifactId}:${version}`)
  process.exit(0)
}

const pathGroup = groupId.replaceAll('.', '/')
const sourcesUrl = `https://repo1.maven.org/maven2/${pathGroup}/${artifactId}/${remoteVersion}/${artifactId}-${remoteVersion}-sources.jar`
const work = mkdtempSync(join(tmpdir(), 'emitfy-java-cmp-'))

try {
  const response = await fetch(sourcesUrl, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow'
  })

  if (!response.ok) {
    // Sem sources.jar: se versão local já é a latest, trate como "precisa bump" se hash local ≠ vazio
    if (remoteVersion === version) {
      console.error(
        `SDK may have changed, but ${groupId}:${artifactId}:${version} is already latest on Maven Central. Bump pom.xml version (and publish sources jar).`
      )
      process.exit(1)
    }
    console.log(
      `remote ${remoteVersion} has no sources.jar — publish ${version}`
    )
    process.exit(0)
  }

  const archive = join(work, 'sources.jar')
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  const extractDir = join(work, 'src/main/java')
  mkdirSync(extractDir, { recursive: true })
  execSync(`tar -xf "${archive}" -C "${extractDir}"`, { stdio: 'pipe' })

  // Hash só dos .java remotos + pom local version-stripped comparado a stub
  const remoteHash = (() => {
    const hash = createHash('sha256')
    hash.update('pom.xml\0')
    hash.update('STUB\0')
    const files = walkFiles(extractDir)
      .filter((f) => f.endsWith('.java'))
      .sort((a, b) => relative(extractDir, a).localeCompare(relative(extractDir, b)))
    for (const file of files) {
      const rel = `src/main/java/${relative(extractDir, file).replaceAll('\\', '/')}`
      hash.update(rel)
      hash.update('\0')
      hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
      hash.update('\0')
    }
    return hash.digest('hex')
  })()

  // Hash local só java (pom stub) para comparar apples-to-apples com sources.jar
  const localJavaHash = (() => {
    const hash = createHash('sha256')
    hash.update('pom.xml\0')
    hash.update('STUB\0')
    const srcDir = join(root, 'src/main/java')
    const files = walkFiles(srcDir)
      .filter((f) => f.endsWith('.java'))
      .sort((a, b) => relative(srcDir, a).localeCompare(relative(srcDir, b)))
    for (const file of files) {
      const rel = `src/main/java/${relative(srcDir, file).replaceAll('\\', '/')}`
      hash.update(rel)
      hash.update('\0')
      hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
      hash.update('\0')
    }
    return hash.digest('hex')
  })()

  if (localJavaHash === remoteHash) {
    console.log(
      `SDK unchanged vs ${groupId}:${artifactId}:${remoteVersion} — skip (${localJavaHash.slice(0, 12)})`
    )
    process.exit(10)
  }

  if (remoteVersion === version) {
    console.error(
      `SDK changed, but ${groupId}:${artifactId}:${version} already on Maven Central. Bump pom.xml version.`
    )
    process.exit(1)
  }

  console.log(
    `SDK changed (${localJavaHash.slice(0, 8)} ≠ ${remoteHash.slice(0, 8)}) — publish ${version}`
  )
  process.exit(0)
} finally {
  rmSync(work, { recursive: true, force: true })
}
