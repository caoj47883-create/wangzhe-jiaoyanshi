# Build script for the King's Study (WangZhe JiaoYanShi) APK.
# Requires: JDK 17, Android SDK build-tools 34, platform android-34。
# 可用环境变量：JAVA_HOME / ANDROID_HOME（或 ANDROID_BUILD_TOOLS）、WZJS_KS_PASS、WZJS_KS_ALIAS。
$ErrorActionPreference = 'Stop'

$root      = Split-Path $PSScriptRoot -Parent   # project root (contains toolchain/, site-local/, app/)
$jdk       = Join-Path $root 'toolchain\jdk-17.0.20.1+1'
$bt        = Join-Path $root 'toolchain\android-14'
$platform  = Join-Path $root 'toolchain\android-34'
$androidJar = Join-Path $platform 'android.jar'
$app       = Join-Path $root 'app'
$build     = Join-Path $root 'build'
$dist      = Join-Path $root 'dist'
$siteSrc   = Join-Path $root 'next\dist'   # Vite build output of the V2 app (web bundle)

$java    = Join-Path $jdk 'bin\java.exe'
$javac   = Join-Path $jdk 'bin\javac.exe'
$keytool = Join-Path $jdk 'bin\keytool.exe'
$jar     = Join-Path $jdk 'bin\jar.exe'
$aapt2   = Join-Path $bt 'aapt2.exe'
$d8Jar   = Join-Path $bt 'lib\d8.jar'
$zipalign = Join-Path $bt 'zipalign.exe'
$apksignerJar = Join-Path $bt 'lib\apksigner.jar'

$ksDir  = Join-Path $app 'keystore'
$ksFile = Join-Path $ksDir 'wangzhe.jks'
$ksAlias = if ($env:WZJS_KS_ALIAS) { $env:WZJS_KS_ALIAS } else { 'wangzhe' }
$ksPass = $env:WZJS_KS_PASS
if (-not $ksPass) { throw '请设置环境变量 WZJS_KS_PASS（签名密码），或在 GitHub Actions 中由 secrets 注入' }

function Step($msg) { Write-Host ("==> " + $msg) }

# ---------------------------------------------------------------- clean
Step 'Cleaning build dirs'
Remove-Item $build -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $build, $dist,
    (Join-Path $build 'gen'), (Join-Path $build 'classes'), (Join-Path $build 'dex') | Out-Null

# ---------------------------------------------------------------- assets
Step 'Copying bundled web app into assets'
if (-not (Test-Path (Join-Path $siteSrc 'index.html'))) {
    throw ('V2 web build not found: ' + $siteSrc + ' — run the Vite build in next/ first')
}
$assets = Join-Path $app 'assets'
Remove-Item $assets -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item $siteSrc (Join-Path $assets 'site') -Recurse
$assetCount = (Get-ChildItem $assets -Recurse -File).Count
Write-Host ("    assets files: " + $assetCount)

# ---------------------------------------------------------------- raw site zip
Step 'Packing web app into res/raw/site.zip (primary, pure-local mode)'
$rawDir = Join-Path $app 'res\raw'
Remove-Item $rawDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
$siteZip = Join-Path $rawDir 'site.zip'
& $jar cMf $siteZip -C $siteSrc .
if ($LASTEXITCODE -ne 0) { throw 'jar packing site.zip failed' }
Write-Host ("    site.zip: " + (Get-Item $siteZip).Length + " bytes")

# ---------------------------------------------------------------- keystore
if (-not (Test-Path $ksFile)) {
    Step 'Generating signing keystore'
    New-Item -ItemType Directory -Force -Path $ksDir | Out-Null
    & $keytool -genkeypair -v -keystore $ksFile -alias $ksAlias -keyalg RSA -keysize 2048 `
        -validity 10000 -storepass $ksPass -keypass $ksPass `
        -dname 'CN=WangZhe JiaoYanShi, OU=Android, O=Jchok, L=Beijing, ST=Beijing, C=CN'
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}

# ---------------------------------------------------------------- resources
Step 'Compiling resources (aapt2)'
& $aapt2 compile --dir (Join-Path $app 'res') -o (Join-Path $build 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Step 'Linking resources + manifest + assets (aapt2 link)'
& $aapt2 link -o (Join-Path $build 'unaligned.apk') `
    -I $androidJar `
    --manifest (Join-Path $app 'AndroidManifest.xml') `
    -A $assets `
    --java (Join-Path $build 'gen') `
    --min-sdk-version 23 --target-sdk-version 34 `
    --auto-add-overlay `
    (Join-Path $build 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

# ---------------------------------------------------------------- java
Step 'Compiling Java sources'
$sources = @(Get-ChildItem (Join-Path $app 'src') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
$rJava = (Get-ChildItem (Join-Path $build 'gen') -Recurse -Filter 'R.java' | Select-Object -First 1).FullName
$allSources = @($rJava) + $sources
& $javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $androidJar `
    -Xlint:-deprecation -Xlint:-options `
    -d (Join-Path $build 'classes') $allSources
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

# ---------------------------------------------------------------- dex
Step 'Dexing with d8'
$classFiles = @(Get-ChildItem (Join-Path $build 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
& $java -Xmx2g -cp $d8Jar com.android.tools.r8.D8 --release --min-api 23 `
    --lib $androidJar --output (Join-Path $build 'dex') $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Step 'Adding classes.dex into APK (append, keep asset zip entries intact)'
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$apkForUpdate = Join-Path $build 'unaligned.apk'
$dexFile = Join-Path $build 'dex\classes.dex'
$zipArchive = [System.IO.Compression.ZipFile]::Open($apkForUpdate, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $old = $zipArchive.GetEntry('classes.dex')
    if ($old -ne $null) { $old.Delete() }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zipArchive, $dexFile, 'classes.dex',
        [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally {
    $zipArchive.Dispose()
}

# ---------------------------------------------------------------- align + sign
Step 'Zip-aligning'
& $zipalign -f -p 4 (Join-Path $build 'unaligned.apk') (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

Step 'Signing APK'
$unsigned = Join-Path $build 'aligned.apk'
$apk = Join-Path $dist 'wangzhe-jiaoyanshi-v2.1.1.apk'
& $java -jar $apksignerJar sign --ks $ksFile --ks-key-alias $ksAlias `
    --ks-pass ('pass:' + $ksPass) --key-pass ('pass:' + $ksPass) `
    --out $apk $unsigned
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

# ---------------------------------------------------------------- verify
Step 'Verifying APK (apksigner)'
& $java -jar $apksignerJar verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed' }

Step 'Verifying APK (badging)'
& $aapt2 dump badging $apk

$hash = (Get-FileHash $apk -Algorithm SHA256).Hash
$size = (Get-Item $apk).Length
Write-Host ''
Write-Host ('APK   : ' + $apk)
Write-Host ('Size  : ' + [math]::Round($size / 1MB, 2) + ' MB (' + $size + ' bytes)')
Write-Host ('SHA256: ' + $hash)
