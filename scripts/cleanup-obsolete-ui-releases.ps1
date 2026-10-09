param([switch]$Execute)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot = 'C:\Users\49978\Desktop\CS2-Pro-Tracker-Complete-Source\CS2-Pro-Tracker-Source'
if ($projectRoot -ne $expectedRoot) { throw 'Unexpected project root' }
$evidenceRoot = Join-Path $projectRoot 'outputs\release-20261008-reading'
$production = Get-Content -LiteralPath (Join-Path $evidenceRoot 'production.json') -Raw | ConvertFrom-Json
if ($production.site -ne 'https://cs2pro.pages.dev' -or $production.deployment -ne '6978e5d7-20c8-4b3d-9ba4-0f7560d4349f') { throw 'Verified production release is required before cleanup' }
$keepNames = @('.cf-pages-release-cs2pro-20261008-lab-final', '.cf-pages-release-cs2pro-20261008-reading-final')
$inventory = @(Get-Content -LiteralPath (Join-Path $evidenceRoot 'cleanup-inventory.json') -Raw | ConvertFrom-Json)
$targets = @($inventory | ForEach-Object { $_.Path }) + (Join-Path $projectRoot '.cf-pages-release-cs2pro-20261008-reading')
$validated = @()
foreach ($target in $targets) {
  $absolute = [IO.Path]::GetFullPath($target)
  $name = [IO.Path]::GetFileName($absolute)
  if ([IO.Path]::GetDirectoryName($absolute) -ne $projectRoot -or $name -notlike '.cf-pages-release-cs2pro-*' -or $name -in $keepNames) { throw "Unsafe cleanup target: $absolute" }
  $entry = Get-Item -LiteralPath $absolute -Force
  $children = if ($entry.PSIsContainer) { @(Get-ChildItem -LiteralPath $absolute -Recurse -Force) } else { @() }
  foreach ($item in (@($entry) + $children)) {
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked path cannot be removed: $($item.FullName)" }
  }
  $tracked = @(git -C $projectRoot ls-files -- $name)
  if ($LASTEXITCODE -ne 0 -or $tracked.Count -gt 0) { throw "Tracked files in cleanup target: $absolute" }
  $files = if ($entry.PSIsContainer) { @($children | Where-Object { -not $_.PSIsContainer }) } else { @($entry) }
  $validated += [pscustomobject]@{ Path=$absolute; Files=$files.Count; Bytes=($files | Measure-Object Length -Sum).Sum }
}
if (($validated.Path | Select-Object -Unique).Count -ne $validated.Count) { throw 'Duplicate cleanup targets' }
$protectedFiles = @()
$trackedSource = @(git -C $projectRoot ls-files)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate protected source' }
foreach ($relative in $trackedSource) {
  $absolute = Join-Path $projectRoot $relative
  if (Test-Path -LiteralPath $absolute -PathType Leaf) { $protectedFiles += $absolute }
}
foreach ($name in $keepNames) { $protectedFiles += @(Get-ChildItem -LiteralPath (Join-Path $projectRoot $name) -Recurse -Force -File | ForEach-Object FullName) }
foreach ($relative in @('app','worker','scripts','docs','skills')) { $protectedFiles += @(Get-ChildItem -LiteralPath (Join-Path $projectRoot $relative) -Recurse -Force -File | ForEach-Object FullName) }
$protectedFiles += @(Get-ChildItem -LiteralPath $projectRoot -Force -File | Where-Object { $_.Name -like '.env*' } | ForEach-Object FullName)
$hashes = @($protectedFiles | Sort-Object -Unique | ForEach-Object { Get-FileHash -LiteralPath $_ -Algorithm SHA256 })
$plan = [pscustomobject]@{ CheckedAt=(Get-Date).ToUniversalTime().ToString('o'); Project=$projectRoot; Production=$production.deployment; Targets=$validated; TargetCount=$validated.Count; Bytes=($validated | Measure-Object Bytes -Sum).Sum; PreservedPackages=$keepNames; ProtectedFiles=$hashes.Count; Executed=[bool]$Execute }
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'cleanup-plan.json') -Encoding utf8
if (-not $Execute) { $plan | Select-Object TargetCount,Bytes,ProtectedFiles,Executed | ConvertTo-Json; exit 0 }
foreach ($item in $validated) { Remove-Item -LiteralPath $item.Path -Recurse -Force }
foreach ($hash in $hashes) {
  if (-not (Test-Path -LiteralPath $hash.Path -PathType Leaf) -or (Get-FileHash -LiteralPath $hash.Path -Algorithm SHA256).Hash -ne $hash.Hash) { throw "Protected file changed: $($hash.Path)" }
}
foreach ($item in $validated) { if (Test-Path -LiteralPath $item.Path) { throw "Target remains: $($item.Path)" } }
$receipt = [pscustomobject]@{ FinishedAt=(Get-Date).ToUniversalTime().ToString('o'); Project=$projectRoot; Removed=$validated; RemovedCount=$validated.Count; BytesFreed=$plan.Bytes; PreservedPackages=$keepNames; ProtectedFilesVerified=$hashes.Count }
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'cleanup-receipt.json') -Encoding utf8
$receipt | Select-Object RemovedCount,BytesFreed,ProtectedFilesVerified,PreservedPackages | ConvertTo-Json
