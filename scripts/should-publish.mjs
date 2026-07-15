/**
 * Decide se com.emitfy:emitfy (Maven) de
ve publicar.
 * exit 0 = publish, 10 = skip, 
1 = erro (mudou sem bump)
 */
import { create
Hash } from 'node:crypto'
import {
  existsSy
nc,
  mkdirSync,
  mkdtempSync,
  readFileSyn
c,
  readdirSync,
  rmSync,
  statSync,
  wri
teFileSync
} from 'node:fs'
import { tmpdir }
 from 'node:os'
import { dirname, join, relat
ive } from 'node:path'
import { fileURLToPath
 } from 'node:url'
import { execSync } from '
node:child_process'

const root = join(dirnam
e(fileURLToPath(import.meta.url)), '..')
cons
t groupId = 'com.emitfy'
const artifactId = '
emitfy'
const userAgent = 'EmitfySDKPublish (
mailto=dev@emitfy.com)'

function walkFiles(d
ir, files = []) {
  for (const name of readdi
rSync(dir)) {
    const path = join(dir, name
)
    if (statSync(path).isDirectory()) {
   
   walkFiles(path, files)
    } else {
      
files.push(path)
    }
  }
  return files
}


function readLocalVersion() {
  const text = 
readFileSync(join(root, 'pom.xml'), 'utf8')
 
 const match = text.match(/<artifactId>emitfy
<\/artifactId>\s*<version>([^<]+)<\/version>/
s)
  if (!match) {
    const fallback = text.
match(/<version>([0-9][^<]*)<\/version>/)
   
 if (!fallback) {
      throw new Error('vers
ion missing in pom.xml')
    }
    return fal
lback[1]
  }
  return match[1]
}

function co
ntentHash(base) {
  const hash = createHash('
sha256')
  const pomPath = join(base, 'pom.xm
l')
  if (existsSync(pomPath)) {
    const te
xt = readFileSync(pomPath, 'utf8')
      .rep
laceAll('\r\n', '\n')
      .replace(
       
 /(<artifactId>emitfy<\/artifactId>\s*)<versi
on>[^<]+<\/version>/s,
        '$1<version>0.
0.0</version>'
      )
    hash.update('pom.x
ml\0')
    hash.update(text)
    hash.update(
'\0')
  }

  const srcDir = join(base, 'src')

  if (!existsSync(srcDir)) {
    throw new E
rror(`src/ missing in ${base}`)
  }

  const 
files = walkFiles(srcDir)
    .filter((f) => 
f.endsWith('.java'))
    .sort((a, b) => rela
tive(base, a).localeCompare(relative(base, b)
))

  for (const file of files) {
    const r
el = relative(base, file).replaceAll('\\', '/
')
    hash.update(rel)
    hash.update('\0')

    hash.update(readFileSync(file, 'utf8').r
eplaceAll('\r\n', '\n'))
    hash.update('\0'
)
  }
  return hash.digest('hex')
}

async fu
nction fetchMavenLatest() {
  const q = encod
eURIComponent(`g:${groupId} AND a:${artifactI
d}`)
  const response = await fetch(
    `htt
ps://search.maven.org/solrsearch/select?q=${q
}&rows=1&wt=json`,
    { headers: { 'User-Age
nt': userAgent } }
  )
  if (!response.ok) {

    throw new Error(`Maven search HTTP ${resp
onse.status}`)
  }
  const data = await respo
nse.json()
  const doc = data?.response?.docs
?.[0]
  if (!doc?.latestVersion) {
    return
 null
  }
  return String(doc.latestVersion)

}

const version = readLocalVersion()
const l
ocalHash = contentHash(root)
const remoteVers
ion = await fetchMavenLatest()

if (!remoteVe
rsion) {
  console.log(`no remote package —
 publish ${groupId}:${artifactId}:${version}`
)
  process.exit(0)
}

const pathGroup = grou
pId.replaceAll('.', '/')
const sourcesUrl = `
https://repo1.maven.org/maven2/${pathGroup}/$
{artifactId}/${remoteVersion}/${artifactId}-$
{remoteVersion}-sources.jar`
const work = mkd
tempSync(join(tmpdir(), 'emitfy-java-cmp-'))


try {
  const response = await fetch(sources
Url, {
    headers: { 'User-Agent': userAgent
 },
    redirect: 'follow'
  })

  if (!respo
nse.ok) {
    // Sem sources.jar: se versão 
local já é a latest, trate como "precisa bu
mp" se hash local ≠ vazio
    if (remoteVer
sion === version) {
      console.error(
    
    `SDK may have changed, but ${groupId}:${a
rtifactId}:${version} is already latest on Ma
ven Central. Bump pom.xml version (and publis
h sources jar).`
      )
      process.exit(1
)
    }
    console.log(
      `remote ${remo
teVersion} has no sources.jar — publish ${v
ersion}`
    )
    process.exit(0)
  }

  con
st archive = join(work, 'sources.jar')
  writ
eFileSync(archive, Buffer.from(await response
.arrayBuffer()))
  const extractDir = join(wo
rk, 'src/main/java')
  mkdirSync(extractDir, 
{ recursive: true })
  execSync(`tar -xf "${a
rchive}" -C "${extractDir}"`, { stdio: 'pipe'
 })

  // Hash só dos .java remotos + pom lo
cal version-stripped comparado a stub
  const
 remoteHash = (() => {
    const hash = creat
eHash('sha256')
    hash.update('pom.xml\0')

    hash.update('STUB\0')
    const files = w
alkFiles(extractDir)
      .filter((f) => f.e
ndsWith('.java'))
      .sort((a, b) => relat
ive(extractDir, a).localeCompare(relative(ext
ractDir, b)))
    for (const file of files) {

      const rel = `src/main/java/${relative(
extractDir, file).replaceAll('\\', '/')}`
   
   hash.update(rel)
      hash.update('\0')
 
     hash.update(readFileSync(file, 'utf8').r
eplaceAll('\r\n', '\n'))
      hash.update('\
0')
    }
    return hash.digest('hex')
  })(
)

  // Hash local só java (pom stub) para c
omparar apples-to-apples com sources.jar
  co
nst localJavaHash = (() => {
    const hash =
 createHash('sha256')
    hash.update('pom.xm
l\0')
    hash.update('STUB\0')
    const src
Dir = join(root, 'src/main/java')
    const f
iles = walkFiles(srcDir)
      .filter((f) =>
 f.endsWith('.java'))
      .sort((a, b) => r
elative(srcDir, a).localeCompare(relative(src
Dir, b)))
    for (const file of files) {
   
   const rel = `src/main/java/${relative(srcD
ir, file).replaceAll('\\', '/')}`
      hash.
update(rel)
      hash.update('\0')
      has
h.update(readFileSync(file, 'utf8').replaceAl
l('\r\n', '\n'))
      hash.update('\0')
    
}
    return hash.digest('hex')
  })()

  if 
(localJavaHash === remoteHash) {
    console.
log(
      `SDK unchanged vs ${groupId}:${art
ifactId}:${remoteVersion} — skip (${localJa
vaHash.slice(0, 12)})`
    )
    process.exit
(10)
  }

  if (remoteVersion === version) {

    console.error(
      `SDK changed, but ${
groupId}:${artifactId}:${version} already on 
Maven Central. Bump pom.xml version.`
    )
 
   process.exit(1)
  }

  console.log(
    `S
DK changed (${localJavaHash.slice(0, 8)} ≠ 
${remoteHash.slice(0, 8)}) — publish ${vers
ion}`
  )
  process.exit(0)
} finally {
  rmS
ync(work, { recursive: true, force: true })
}



